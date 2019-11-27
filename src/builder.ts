import { Transport } from './transport';
import { Peer } from './peer';

type Primitive = string | number | boolean | undefined | null;
type AnyFunc = (...args: any[]) => any;
type AnyExposedFunc = (...args: (Primitive | AnyExposedFunc)[]) => Primitive | AnyExposedFunc;
type ExposedFunction<
  T extends AnyFunc = AnyFunc,
  TArgs = Parameters<T>,
  TReturn = ReturnType<T>
> = TArgs extends (Primitive | AnyExposedFunc)[]
  ? TReturn extends Primitive | AnyExposedFunc
    ? T
    : never
  : never;
type LocalApi = {
  [methodName: string]: ExposedFunction;
};
type RemoteApi = {
  [methodName: string]: ExposedFunction;
};

class Builder<TLocalApi extends LocalApi> {
  private localApi?: TLocalApi;

  connect<TRemoteApi extends RemoteApi>(transport: Transport) {
    return new Peer<TRemoteApi, TLocalApi>(transport, this.localApi);
  }

  static fromLocalApi<TLocalApi extends LocalApi>(localApi: TLocalApi) {
    const builder = new Builder<TLocalApi>();

    builder.localApi = localApi;

    return builder;
  }
}

export function connect<TRemoteApi extends RemoteApi>(transport: Transport) {
  return new Peer<TRemoteApi>(transport);
}

export function expose(localApi: LocalApi) {
  return Builder.fromLocalApi(localApi);
}
