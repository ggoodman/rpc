export function dfdForReq<T>() {
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
