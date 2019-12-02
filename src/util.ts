import { Thenable } from 'ts-primitives';

export interface Deferred<T> {
  resolve(result: T | Promise<T> | Thenable<T>): void;
  reject(err: Error): void;
  promise: Promise<T>;
}

export function createDeferred<T>(): Deferred<T> {
  let settled = false;

  const op = {
    resolve: (undefined as unknown) as (result: any) => void,
    reject: (undefined as unknown) as (err: Error) => void,
    promise: (undefined as unknown) as Promise<T>,
  };

  op.promise = new Promise<T>((resolve, reject) => {
    op.resolve = (...args: any[]) => {
      if (!settled) {
        settled = true;
        resolve(...args);
      }
    };
    op.reject = (...args: any[]) => {
      if (!settled) {
        settled = true;
        reject(...args);
      }
    };
  });

  return op;
}

export function thenableAlreadySettled() {
  throw new TypeError(
    'Attempted to wait on the outcome of an rpc request after it was sent without requesting a delivery receipt'
  );
}
