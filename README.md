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

### `API`

Represents an instance of a connected RPC API.

#### `invoke(methodName, ...args): Promise<ReturnType>`

Invoke `methodName` on the other side of the transport with args `...args`. This will _always_ return a `Promise`.

#### `dispose()`

Frees up resources, disposes the transport and any installed `Codec`s.

### `Transport`

Exposes factory functions for constructing `Transport`s for various use-cases. `Transport` is also an interface describing the required API for compatible transports that can be used with this library.

```typescript
/**
 * The interface for rpc-compatible transports.
 */
export interface Transport {
  /**
   * Dispose of this transport and free any allocated resources.
   */
  dispose(): void;

  /**
   * Register a RPC message listener with the transport
   *
   * @param handler A handler function to be called with each RPC message received from a peer
   */
  onMessage(handler: (msg: unknown[]) => void): { dispose(): void };

  /**
   * Send an RPC message to the peer over this transport
   *
   * @param msg The array-encoded message that should be sent to the peer over the transport
   * @param transfer An optional array of objects that should be marked as transferrable when the transport supports it
   */
  sendMessage(msg: unknown[], transfer?: unknown[]): void;
}
```

#### `fromNodeMessagePort(port): Transport`

Construct a `Transport` from a Node-compatible `MessagePort`.

#### `fromNodeDomPort(port): Transport`

Construct a `Transport` from a browser-compatible `MessagePort`.

#### `fromNodeDomWorker(worker): Transport`

Construct a `Transport` from a browser-compatible `Worker`.

## Example

Here is an example of one side of an RPC use-case. It is interesting in that we are passing around
functions like data. In JavaScript, this a basic part of how idiomatic code is written but becomes
tricky when function calls need to cross process boundaries.

```typescript
import { connect, Transport } from '@ggoodman/rpc';

interface RemoteApi {
  /**
   * A function that will return a function that will, itself, return the argument
   * passed to the first function
   */
  ping(value: number) => () => number;
}

// We're going to connect to the transport and define the shape of the remote
// api with the interface RemoteApi.
const api = connect<RemoteApi>(Transport.fromDomWorker(worker));
const now = Date.now();

// Let's invoke the `ping` function exposed by the other peer.
const pong = await api.invoke('ping', now);

// The peer sends us back a `pong` function. Calling it gives us
// back the `now` value that we originally called `ping` with.
const result = await pong();

// result === now
```
