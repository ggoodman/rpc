import { DisposableStore } from 'ts-primitives';

import { dfdForReq } from './util';
import { Codec, ErrorCodec, FunctionCodec } from './codec';
import {
  isIncomingAnonymousFunctionInvocation,
  isIncomingInvocationMessage,
  isIncomingResponseMessage,
  isIncomingAnonymousFunctionResponse,
} from './types';
import { Transport } from './transport';
import { Decoder } from './decoder';
import { Encoder } from './encoder';

type AnyFunc = (...args: any[]) => any;
type AsyncReturnType<T> = T extends (...args: any[]) => infer U ? AsyncType<U> : never;
type AsyncType<T> = T extends AnyFunc
  ? (...args: Parameters<T>) => EnsurePromise<ReturnType<T>>
  : T;
type EnsurePromise<T> = T extends Promise<any> ? T : Promise<T>;

const resolvedPromise = Promise.resolve();

export class Peer<
  TRemoteApi extends { [method: string]: (...args: any[]) => any },
  TLocalApi extends { [method: string]: (...args: any[]) => any } | undefined = undefined
> {
  private readonly functionCodec: FunctionCodec;
  private readonly codecs = new Map<string, Codec>();
  private readonly disposer = new DisposableStore();
  private readonly decoder = new Decoder(this.codecs);
  private readonly encoder = new Encoder(this.codecs);
  private nextReqId = 1;
  private readonly pendingRemoteOperations = new Map<number, ReturnType<typeof dfdForReq>>();

  constructor(
    private readonly transport: Transport,
    private readonly localApi?: TLocalApi,
    codecs: Codec[] = []
  ) {
    this.functionCodec = new FunctionCodec(this.invokeAnonymous.bind(this));

    this.addCodec(new ErrorCodec());
    this.addCodec(this.functionCodec);

    for (const codec of codecs) {
      this.addCodec(codec);
    }

    this.disposer.add(this.transport);

    this.transport.onMessage(msg => {
      // This is a message comign from the peer to call a local anonymous function.
      // A local anonymous function would have been created by the function codec when
      // a function was passed as an argument to another invocation.
      if (isIncomingAnonymousFunctionInvocation(msg)) {
        const [, id, reqId, ...args] = msg;

        const wrappedInvoke = () => {
          const mappedArgs = args.map(arg => this.decoder.decode(arg));

          return this.functionCodec.invokeAnonymousFunction(id, ...mappedArgs);
        };

        return resolvedPromise.then(wrappedInvoke).then(
          result => {
            this.transport.sendMessage([0, -reqId, null, this.encoder.encode(result)]);
          },
          err => {
            this.transport.sendMessage([0, -reqId, this.encoder.encode(err)]);
          }
        );
      }

      if (isIncomingAnonymousFunctionResponse(msg)) {
        const [, reqId, err, result] = msg;
        const dfd = this.pendingRemoteOperations.get(-reqId);

        if (!dfd) {
          throw new TypeError(`Received a function response for an unknown function ${reqId}`);
        }

        this.pendingRemoteOperations.delete(-reqId);

        if (err) {
          return dfd.reject(this.decoder.decode(err) as Error);
        }

        return dfd.resolve(this.decoder.decode(result));
      }

      // This is a request coming from the peer to call a method on the local API
      if (isIncomingInvocationMessage(msg)) {
        const [id, methodName, ...args] = msg;

        const wrappedInvoke = () => {
          if (!this.localApi) {
            throw new TypeError('Unable to invoke method when no remote api has been defined');
          }

          const localMethod = this.localApi[methodName];

          if (!localMethod) {
            throw new TypeError(`No such local method ${methodName}`);
          }

          const mappedArgs = args.map(arg => this.decoder.decode(arg));

          return localMethod(...mappedArgs);
        };

        return void resolvedPromise.then(wrappedInvoke).then(
          result => {
            this.transport.sendMessage([-id, null, this.encoder.encode(result)]);
          },
          err => {
            this.transport.sendMessage([-id, this.encoder.encode(err)]);
          }
        );
      }

      // This is an incoming message the contains the outcome of a previous invocation.
      if (isIncomingResponseMessage(msg)) {
        const [id, err, result] = msg;
        const dfd = this.pendingRemoteOperations.get(-id);

        if (!dfd) {
          throw new TypeError(`Received a function response for an unknown function ${id}`);
        }

        this.pendingRemoteOperations.delete(-id);

        if (err) {
          return dfd.reject(this.decoder.decode(err) as Error);
        }

        return dfd.resolve(this.decoder.decode(result));
      }
    });
  }

  addCodec(codec: Codec) {
    if (this.codecs.has(codec.name)) {
      throw new TypeError(`A codec is already registered for ${codec.name}`);
    }

    this.codecs.set(codec.name, codec);
    this.disposer.add(codec);
  }

  dispose() {
    this.pendingRemoteOperations.clear();
    this.disposer.dispose();
  }

  invoke<TMethodName extends keyof TRemoteApi>(
    method: TMethodName,
    ...args: Parameters<TRemoteApi[TMethodName]>
  ) {
    const reqId = this.nextReqId++;
    const dfd = dfdForReq<AsyncReturnType<TRemoteApi[TMethodName]>>(reqId);

    this.pendingRemoteOperations.set(reqId, dfd);

    const mappedArgs = args.map(arg => this.encoder.encode(arg));
    this.transport.sendMessage([reqId, method, ...mappedArgs]);

    return dfd.promise as EnsurePromise<AsyncReturnType<TRemoteApi[TMethodName]>>;
  }

  private invokeAnonymous(anonymousFunctionId: number, ...args: unknown[]) {
    const reqId = this.nextReqId++;
    const dfd = dfdForReq<unknown>(reqId);

    this.pendingRemoteOperations.set(reqId, dfd);

    const mappedArgs = args.map(arg => this.encoder.encode(arg));
    this.transport.sendMessage([0, anonymousFunctionId, reqId, ...mappedArgs]);

    return dfd.promise;
  }
}
