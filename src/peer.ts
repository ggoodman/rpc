import { DisposableStore, Thenable } from 'ts-primitives';

import { createDeferred, thenableAlreadySettled, Deferred } from './util';
import { Codec, ErrorCodec, FunctionCodec } from './codec';
import { isIncomingInvocationMessage, isIncomingResponseMessage } from './types';
import { Transport } from './transport';
import { Decoder } from './decoder';
import { Encoder } from './encoder';
import { resolvedPromise } from './constants';

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

export class Peer<
  TRemoteApi extends { [method: string]: (...args: any[]) => any },
  TLocalApi extends { [method: string]: (...args: any[]) => any } | undefined = undefined
> {
  private readonly anonymousFunctions = new Map<number, (...args: any[]) => any>();
  private readonly functionCodec: FunctionCodec;
  private readonly codecs = new Map<string, Codec>();
  private readonly disposer = new DisposableStore();
  private readonly decoder = new Decoder(this.codecs);
  private readonly encoder = new Encoder(this.codecs);
  private nextAnonymousFunctionId = 1;
  private nextReqId = 1;
  private readonly pendingRemoteOperations = new Map<number, Deferred<unknown>>();

  constructor(
    private readonly transport: Transport,
    private readonly localApi?: TLocalApi,
    codecs: Codec[] = []
  ) {
    this.functionCodec = new FunctionCodec(
      this.registerAnonymousFunction.bind(this),
      this.invokeWithOptionalCompletionReceipt.bind(this)
    );

    this.addCodec(new ErrorCodec());
    this.addCodec(this.functionCodec);

    for (const codec of codecs) {
      this.addCodec(codec);
    }

    this.disposer.add(this.transport);

    this.transport.onMessage(({ data, sendMessage }) => {
      const boundSendMessage = sendMessage;

      // This is a request coming from the peer to call a function on the local API
      if (isIncomingInvocationMessage(data)) {
        const [reqId, methodNameOrAnonymousFunctionId, ...args] = data;

        const wrappedInvoke = () => {
          let localMethod: (...args: any) => any;

          if (typeof methodNameOrAnonymousFunctionId === 'number') {
            const anonymousFunction = this.anonymousFunctions.get(methodNameOrAnonymousFunctionId);

            /* $lab:coverage:off$ */
            if (!anonymousFunction) {
              throw new TypeError(
                `Unable to invoke unknown anonymous function '${methodNameOrAnonymousFunctionId}'`
              );
            }

            localMethod = anonymousFunction;
          } else {
            if (!this.localApi) {
              throw new TypeError('Unable to invoke method when no remote api has been defined');
            }

            const namedFunction = this.localApi[methodNameOrAnonymousFunctionId];

            if (!namedFunction) {
              throw new TypeError(`No such local method '${methodNameOrAnonymousFunctionId}'`);
            }

            localMethod = namedFunction;
          }

          const mappedArgs = args.map(arg => this.decoder.decode(arg));

          return localMethod(...mappedArgs);
        };

        return void resolvedPromise.then(wrappedInvoke).then(
          result => {
            if (reqId > 0) {
              boundSendMessage([-reqId, null, this.encoder.encode(result)]);
            }
          },
          err => {
            if (reqId > 0) {
              boundSendMessage([-reqId, this.encoder.encode(err)]);
            } else {
              throw err;
            }
          }
        );
      }

      // This is an incoming message the contains the outcome of a previous invocation.
      if (isIncomingResponseMessage(data)) {
        const [id, err, result] = data;
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

  remoteFunction<
    TMethodName extends keyof TRemoteApi,
    TFunction extends (...args: any[]) => any = TRemoteApi[TMethodName]
  >(
    method: TMethodName
  ): (...args: Parameters<TFunction>) => Thenable<UnwrapPromise<ReturnType<TFunction>>> {
    return (...args: Parameters<TFunction>) => {
      return this.invokeWithOptionalCompletionReceipt<UnwrapPromise<ReturnType<TFunction>>>(
        method as string,
        ...args
      );
    };
  }

  invoke<TMethodName extends keyof TRemoteApi>(
    method: TMethodName,
    ...args: Parameters<TRemoteApi[TMethodName]>
  ): Thenable<UnwrapPromise<ReturnType<TRemoteApi[TMethodName]>>> {
    return this.invokeWithOptionalCompletionReceipt<
      UnwrapPromise<ReturnType<TRemoteApi[TMethodName]>>
    >(method as string, ...args);
  }

  private invokeWithOptionalCompletionReceipt<T>(
    methodOrAnonymousFunctionId: number | string,
    ...args: any[]
  ): Thenable<T> {
    let reqId = 0;
    let dfd: Deferred<T> | undefined = undefined;

    // We will return a thenable and defer the execution of this function to the end of the microtick queue.
    // If the thenable is subscribed to by then, we'll return a promise and execute the request such that
    // we request an execution receipt. Otherwise, we will execute the request in such a way that the remote
    // peer won't attempt to respond with an execution receipt.
    const thenable: Thenable<T> = {
      then: (...args: Parameters<Thenable<T>['then']>) => {
        reqId = this.nextReqId++;
        dfd = createDeferred();

        this.pendingRemoteOperations.set(reqId, dfd);

        return dfd.promise.then(...args);
      },
    };

    // Here we need to schedule some work to run at the END of the next loop through the microtask queue.
    // In order to make that happen, we will nest our logic into a double wait on a resolved promise.
    resolvedPromise.then(() =>
      resolvedPromise.then(() => {
        thenable.then = thenableAlreadySettled as any;

        const mappedArgs = args.map(arg => this.encoder.encode(arg));
        this.transport.sendMessage([reqId, methodOrAnonymousFunctionId, ...mappedArgs]);
      })
    );

    return thenable;
  }

  private registerAnonymousFunction(fn: (...args: any[]) => any) {
    const id = this.nextAnonymousFunctionId++;

    this.anonymousFunctions.set(id, fn);

    return id;
  }
}
