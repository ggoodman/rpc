export type AnonymousFunctionInvocation = [0, number, number, ...unknown[]];
export type AnonymousFunctionResponse = [0, number, null | WrappedError, unknown[]];
export type InvocationMessage = [number, string, ...unknown[]];
export type ResponseMessage = [number, null | WrappedError, unknown];
export type WrappedType<T extends string> = { $: T };

export interface WrappedError extends WrappedType<'Error'> {
  message: string;
  name?: string;
  stack?: string;
}
export interface WrappedFunction extends WrappedType<'Function'> {
  id: number;
}

export function isIncomingAnonymousFunctionInvocation(
  msg: unknown[]
): msg is AnonymousFunctionInvocation {
  return (
    msg[0] === 0 &&
    typeof msg[1] === 'number' &&
    Number.isInteger(msg[1]) &&
    msg[1] >= 0 &&
    typeof msg[2] === 'number' &&
    Number.isInteger(msg[2])
  );
}

export function isIncomingAnonymousFunctionResponse(
  msg: unknown[]
): msg is AnonymousFunctionResponse {
  return (
    msg[0] === 0 &&
    typeof msg[1] === 'number' &&
    Number.isInteger(msg[1]) &&
    msg[1] < 0 &&
    (msg[2] === null || isWrappedError(msg[2]))
  );
}

export function isIncomingInvocationMessage(msg: unknown[]): msg is InvocationMessage {
  const [id, methodName] = msg;

  return typeof id === 'number' && Number.isInteger(id) && id > 0 && typeof methodName === 'string';
}

export function isIncomingResponseMessage(msg: unknown[]): msg is ResponseMessage {
  const [id, err] = msg;

  return (
    typeof id === 'number' &&
    Number.isInteger(id) &&
    id < 0 &&
    (err === null || isWrappedError(err))
  );
}

export function isWrappedError(err: unknown): err is WrappedError {
  return (
    isWrappedTypeOfKind(err, 'Error') &&
    typeof (err as any)['message'] === 'string' &&
    (typeof (err as any)['name'] === 'string' || typeof (err as any)['name'] === 'undefined') &&
    (typeof (err as any)['stack'] === 'string' || typeof (err as any)['stack'] === 'undefined')
  );
}

export function isWrappedType(obj: unknown): obj is WrappedType<string> {
  return obj && typeof obj === 'object' && typeof (obj as any)['$'] === 'string';
}

export function isWrappedTypeOfKind<T extends string>(
  obj: unknown,
  type: T
): obj is WrappedType<T> {
  return isWrappedType(obj) && obj.$ === type;
}

type Primitive = string | number | boolean | null | undefined | void;
type ExposedFunction<
  T extends (...args: any[]) => any,
  TArgs = Parameters<T>,
  TReturn = ReturnType<T>
> = TArgs extends Primitive[] ? (TReturn extends Primitive ? T : never) : never;

type Test = (n: number) => number;
type Result = ExposedFunction<Test>;
