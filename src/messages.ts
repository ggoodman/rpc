export type InvocationMessage = [number, string | number, ...unknown[]];
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

export function isIncomingInvocationMessage(msg: unknown[]): msg is InvocationMessage {
  const [id, methodName] = msg;

  return (
    typeof id === 'number' &&
    Number.isInteger(id) &&
    id >= 0 &&
    (typeof methodName === 'string' ||
      (typeof methodName === 'number' && Number.isInteger(methodName) && methodName > 0))
  );
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
