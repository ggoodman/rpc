import { WrappedType, WrappedError, WrappedFunction } from './messages';
import { Thenable } from 'ts-primitives';
import { SendMessageFunction } from './transport';

export interface Codec<
  TName extends string = string,
  TValue = unknown,
  TEncoded extends WrappedType<TName> = WrappedType<TName>
> {
  readonly name: TName;
  canEncode(obj: unknown): boolean;
  encode(obj: TValue): TEncoded;
  decode(wrappedObj: TEncoded, ctx: { sendMessage: SendMessageFunction }): TValue;
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

  constructor(
    private readonly registerAnonymousFunction: (fn: (...args: any[]) => any) => number,
    private readonly invokeRemoteAnonymousFunction: (
      anonymousFunctionId: number,
      ...args: unknown[]
    ) => Thenable<unknown>
  ) {}

  canEncode(obj: unknown) {
    return typeof obj === 'function';
  }

  encode(fn: (...args: any[]) => any): WrappedFunction {
    const anonymousFunctionId = this.registerAnonymousFunction(fn);

    return {
      $: this.name,
      id: anonymousFunctionId,
    };
  }

  decode(obj: WrappedFunction) {
    const id = obj.id;

    return (...args: unknown[]) => {
      return this.invokeRemoteAnonymousFunction(id, ...args);
    };
  }

  dispose() {}
}
