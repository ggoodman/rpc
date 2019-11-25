# RPC

A fully-typed, transport-agnostic, bi-directional RPC framework that also supports passing functions as parameters and returning functions as results.

In JavaScript, passing around first-class functions is a basic part of writing idiomatic code. Unfortunately, as soon as a process (or context) boundary is introduced between the caller and callee, this breaks down. JavaScript `Function`s are not `Transferable` objects. This library aims to help with situations where two processes or contexts need to invoke functions between themselves and may even want to pass around callback functions.

## Installation

```sh
npm install @ggoodman/rpc
```

## Usage

Creating RPC instances uses a Builder Pattern.

### `expose(localApi): Builder<typeof localApi>`

Exposes a local API where `localApi` is a map of function names to function implementations. Returns a `Builder` instance.

You can then obtain an `API<RemoteApiType, typeof localApi>` instance by `connect`ing to a `Transport`:

```typescript
const api = expose(localApi).connect<RemoteApiType>(transport);
```

### `connect<RemoteApiType>(transport): API<RemoteApiType>`

Connects to a remote API over the given `transport` and returns an `API` instance.

### `API#invoke(methodName, ...args): Promise<ReturnType>`

Invoke `methodName` on the other side of the transport with args `...args`. This will _always_ return a `Promise`.

### `API#dispose()`

Frees up resources, disposes the transport and any installed `Codec`s.

## Example

Here is an example of one side of an RPC use-case. It is interesting in that we are passing around
functions like data. In JavaScript, this a basic part of how idiomatic code is written but becomes
tricky when function calls need to cross process boundaries.

```typescript
interface RemoteApi {
  /**
   * A function that will return a function that will, itself, return the argument
   * passed to the first function
   */
  ping<T>(value: T) => () => T;
}

// We're going to connect to the transport and define the shape of the remote
// api with the interface RemoteApi.
const api = connect<RemoteApi>(transport);
const now = Date.now();

// Let's invoke the `ping` function exposed by the other peer.
const pong = await api.invoke('ping', now);

// The peer sends us back a `pong` function. Calling it gives us
// back the `now` value that we originally called `ping` with.
const result = await pong();

// result === now
```
