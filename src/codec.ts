import { WrappedType, WrappedError, WrappedFunction } from './types';
import { Thenable } from 'ts-primitives';
import { resolvedPromise } from './constants';

export interface Codec<
  TName extends string = string,
  TValue = unknown,
  TEncoded extends WrappedType<TName> = WrappedType<TName>
> {
  readonly name: TName;
  canEncode(obj: unknown): boolean;
  encode(obj: TValue): TEncoded;
  decode(wrappedObj: TEncoded): TValue;
  dispose(): void;
}

export class ErrorCodec implements Codec<'Error', Error, WrappedError> {
  readonly name = 'Error';

  canEncode(obj: unknown) {
    return obj instanceof Error;
  }

  encode(obj: Error): WrappedError {
    return {
      $: 'Error',
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
    };
  }

  decode(obj: WrappedError) {
    return Object.assign(new Error(obj.message), obj);
  }

  dispose() {}
}

export class FunctionCodec implements Codec<'Function', (...args: any[]) => any, WrappedFunction> {
  readonly name = 'Function';

  private readonly _anonymousFunctions = new Map<number, (...args: any[]) => any>();
  private _nextReqId = 1;

  constructor(
    private readonly invokeRemoteAnonymousFunction: (
      anonymousFunctionId: number,
      ...args: unknown[]
    ) => Thenable<unknown>
  ) {}

  canEncode(obj: unknown) {
    return typeof obj === 'function';
  }

  encode(obj: (...args: any[]) => any): WrappedFunction {
    const anonymousFunctionId = this._nextReqId++;

    this._anonymousFunctions.set(anonymousFunctionId, obj);

    return {
      $: 'Function',
      id: anonymousFunctionId,
    };
  }

  decode(obj: WrappedFunction) {
    const id = obj.id;

    return (...args: unknown[]) => {
      return this.invokeRemoteAnonymousFunction(id, ...args);
    };
  }

  dispose() {
    this._anonymousFunctions.clear();
  }

  invokeAnonymousFunction(id: number, ...args: unknown[]) {
    return resolvedPromise.then(() => {
      const anonymousFunction = this._anonymousFunctions.get(id);

      /* $lab:coverage:off$ */
      if (!anonymousFunction) {
        throw new TypeError(`Unable to invoke unknown anonymous function ${id}`);
      }

      return anonymousFunction(...args);
    });
  }
}
