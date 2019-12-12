import { expect } from '@hapi/code';
import { script } from '@hapi/lab';
import { DisposableStore, Event } from 'ts-primitives';

import { TransportBridge } from './lib/testTransport';
import { connect, expose } from '../src';

export const lab = script();

const { describe, it } = lab;

describe('The end to end protocol', () => {
  it('Includes a simple transport', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();

    disposable.add(bridge);

    const message = [0, 1, 2];
    const leftMsgPromise = Event.toPromise(bridge.left.onMessage);

    bridge.right.sendMessage(message);

    const receivedMessage = await leftMsgPromise;

    expect(receivedMessage).to.equal(message);
  });

  it('supports bi-directional function calling', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      invokeLeft: () => 'left' as const,
    };
    const rightApi = {
      invokeRight: () => 'right' as const,
    };
    const leftPeer = expose(leftApi).connect<typeof rightApi>(bridge.left);
    const rightPeer = expose(rightApi).connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const invokeRight = leftPeer.remoteFunction('invokeRight');
    const invokeLeft = rightPeer.remoteFunction('invokeLeft');

    expect(await invokeRight()).to.equal('right');
    expect(await invokeLeft()).to.equal('left');
  });

  it('supports returning a callable function', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      getFunction: () => flags.mustCall((n: number) => n + 1, 1),
    };

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const increment = await rightPeer.invoke('getFunction');

    expect(await increment(1)).to.equal(2);
  });

  it('supports passing a callable function as an argument', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const times = 5;
    const leftApi = {
      doWork: async (log: (n: number) => void) => {
        for (let i = 0; i < times; i++) {
          log(i);
        }
      },
    };

    let counter = 0;

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const log = flags.mustCall((n: number) => {
      expect(n).to.equal(counter++);
    }, times);
    await rightPeer.invoke('doWork', log);
  });

  it('supports catching errors', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      rollTheDice: (roll: number) => {
        if (roll === 7) {
          throw new Error('Craps');
        }

        return roll;
      },
    };

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    await expect(await rightPeer.invoke('rollTheDice', 3)).to.equal(3);
    await expect(rightPeer.invoke('rollTheDice', 7)).to.reject(Error, 'Craps');
  });

  it('supports the ping-pong example', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      ping: (value: number) => {
        return function pong() {
          return value;
        };
      },
    };

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const now = Date.now();
    const pong = await rightPeer.invoke('ping', now);

    expect(await pong()).to.equal(now);
  });

  it('supports invoking methods on one peer through another peer', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge1 = new TransportBridge();
    disposable.add(bridge1);

    const leftApi1 = {
      listEntries: (cb: (err: null | Error, entries: string[]) => void) => {
        // Ooops, while I implement this API, I can't actually fulfill it
        // but I'm connected to another Peer that _CAN_.
        return right2Peer.invoke('listEntries', cb);
      },
    };

    const left1Peer = expose(leftApi1).connect(bridge1.left);
    const right1Peer = connect<typeof leftApi1>(bridge1.right);
    disposable.add(left1Peer);
    disposable.add(right1Peer);

    const bridge2 = new TransportBridge();
    disposable.add(bridge2);

    const leftApi2 = {
      listEntries: (cb: (err: null | Error, entries: string[]) => void) => {
        // I happen to be a peer that _CAN_ implement listEntries
        return cb(null, ['hello', 'world']);
      },
    };

    const left2Peer = expose(leftApi2).connect(bridge2.left);
    const right2Peer = connect<typeof leftApi2>(bridge2.right);
    disposable.add(left2Peer);
    disposable.add(right2Peer);

    const invokePromise = right1Peer.invoke(
      'listEntries',
      flags.mustCall((err: null | Error, entries: string[]) => {
        expect(err).to.be.null();
        expect(entries).to.equal(['hello', 'world']);
      }, 1)
    );

    expect(await invokePromise).to.be.undefined();
  });

  it('will throw an error if the lazy execution receipt api is misused on invocations', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      ping: (value: any) => {
        return value;
      },
    };

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const ret = rightPeer.invoke('ping', 'pong');
    const invalidLazyPromise = new Promise(resolve =>
      setImmediate(() => {
        resolve(ret);
      })
    );

    await expect(invalidLazyPromise).to.reject(TypeError, /delivery receipt/);
  });

  it('will throw an error if the lazy execution receipt api is misused on anonymous function invocations', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      ping: async <T>(value: T, cb: (err: null, value: T) => void) => {
        const ret = cb(null, value);

        await new Promise(resolve =>
          setImmediate(
            flags.mustCall(() => {
              resolve(ret);
            }, 1)
          )
        );
      },
    };

    const leftPeer = expose(leftApi).connect(bridge.left);
    const rightPeer = connect<typeof leftApi>(bridge.right);
    disposable.add(leftPeer);
    disposable.add(rightPeer);

    const ret = rightPeer.invoke(
      'ping',
      'pong',
      flags.mustCall((err, value) => {
        expect(err).to.be.null();
        expect(value).to.equal('pong');
      }, 1)
    );

    await expect(ret).to.reject(Error, /delivery receipt/);
  });
});
