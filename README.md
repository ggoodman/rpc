# RPC

A fully-typed, transport-agnostic, bi-directional RPC framework that also supports passing functions as parameters and returning functions as results.

In JavaScript, passing around first-class functions is a basic part of writing idiomatic code. Unfortunately, as soon as a process (or context) boundary is introduced between the caller and callee, this breaks down. JavaScript `Function`s are not `Transferable` objects. This library aims to help with situations where two processes or contexts need to invoke functions between themselves and may even want to pass around callback functions.

## Example

Here is an example of one side of an RPC use-case. Imagine we are writing an in-browser editor (something like the [Velcro Playground](https://ggoodman.github.io/velcro)) where we have some expensive logic we want to delegate to a Worker. Here, let's imagine we want to ask the worker to acquire all typings files for a set of dependencies. For each dependency that is found, we provide a callback that should be falled with a `{ path, content }` object.

> Note: It is interesting to point out that even though this logic is crossing a process boundary, we are freely passing callback functions in the arguments. The local peer passes a callback and the remote peer receives a function while the library handles piping the two together.

**`workerClient.ts`**:

```typescript
import { connect, Transport } from '@ggoodman/rpc';

import { WorkerApi } from './workerImpl';

// Let's imagine we're using https://github.com/GoogleChromeLabs/worker-plugin in a Webpack setup
const worker = new Worker('./workerImpl', { type: 'module' });

// Expose our local api and connect to the peer in the worker over a DOM worker transport. We
// indicate the shape of the API the peer exposes as a template type to the connect function.
// This gives us full intellisense on calls to `Peer#invoke()` later.
const workerPeer = connect<WorkerApi>(Transport.fromDomWorker(worker));

/**
 * Acquire types for a set of dependencies
 *
 * @param dependencies The mapping of dependency modules names to semver ranges
 * @param onDependency A callback function that will be fired for each discovered typing file
 */
export function acquireTypes(
  dependencies: Record<string, string>,
  onDependency: (file: { path: string; content: string }) => void
) {
  // We're going to delegate this call to the worker. Note that we're passing in the `onDependency`
  // function without any gymnastics. The RPC library makes this sort of workflow frictionless.
  return workerPeer.invoke('acquireTypes', dependencies, onDependency);
}
```

**`workerImpl.ts`**:

```typescript
import { connect, Transport } from '@ggoodman/rpc';

const workerApi = {
  acquireTypes: async (
    dependencies: Record<string, string>,
    onDependency: (file: { path: string; content: string }) => void
  ) => {
    // Actually acquire types here. Let's pretend that this logic makes sense even though it is
    // total nonsense.
    for (const dependency in dependencies) {
      // onDependency is a reference to a function on the other peer (the main thread). Since
      // we don't *use* the Thenable returned by the following function, no completion receipt
      // will be requested and this call will behave like a fire-and-forget.
      // If we wanted to ensure delivery, we need to `await` or otherwise invoke the `.then`
      // method of the object returned by this function *in the current turn of the microtask
      // queue*.
      onDependency({
        path: `/node_modules/${dependency}/index.d.ts`,
        content: `declare module "${dependency}" {}`,
      });
    }
  },
};
```

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
