import { expect } from '@hapi/code';
import { script } from '@hapi/lab';
import { DisposableStore, Event } from 'ts-primitives';

import { TransportBridge } from './lib/testTransport';
import { connect, expose } from '../src';

export const lab = script();

const { describe, it } = lab;

describe('The end to end protocol', () => {
  it('Will work', async (flags: script.Flags) => {
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
    const left = expose(leftApi).connect<typeof rightApi>(bridge.left);
    const right = expose(rightApi).connect<typeof leftApi>(bridge.right);
    disposable.add(left);
    disposable.add(right);

    expect(await left.invoke('invokeRight')).to.equal('right');
    expect(await right.invoke('invokeLeft')).to.equal('left');
  });

  it('supports returning a callable function', async (flags: script.Flags) => {
    const disposable = new DisposableStore();
    flags.onCleanup = () => disposable.dispose();

    const bridge = new TransportBridge();
    disposable.add(bridge);

    const leftApi = {
      getFunction: () => flags.mustCall((n: number) => n + 1, 1),
    };

    const left = expose(leftApi).connect(bridge.left);
    const right = connect<typeof leftApi>(bridge.right);
    disposable.add(left);
    disposable.add(right);

    const increment = await right.invoke('getFunction');

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
          await log(i);
        }
      },
    };

    let counter = 0;

    const left = expose(leftApi).connect(bridge.left);
    const right = connect<typeof leftApi>(bridge.right);
    disposable.add(left);
    disposable.add(right);

    const log = flags.mustCall((n: number) => {
      expect(n).to.equal(counter++);
    }, times);
    await right.invoke('doWork', log);
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

    const left = expose(leftApi).connect(bridge.left);
    const right = connect<typeof leftApi>(bridge.right);
    disposable.add(left);
    disposable.add(right);

    await expect(await right.invoke('rollTheDice', 3)).to.equal(3);
    await expect(right.invoke('rollTheDice', 7)).to.reject(Error, 'Craps');
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

    const left = expose(leftApi).connect(bridge.left);
    const right = connect<typeof leftApi>(bridge.right);
    disposable.add(left);
    disposable.add(right);

    const now = Date.now();
    const pong = await right.invoke('ping', now);

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
        return right2.invoke('listEntries', cb);
      },
    };

    const left1 = expose(leftApi1).connect(bridge1.left);
    const right1 = connect<typeof leftApi1>(bridge1.right);
    disposable.add(left1);
    disposable.add(right1);

    const bridge2 = new TransportBridge();
    disposable.add(bridge2);

    const leftApi2 = {
      listEntries: (cb: (err: null | Error, entries: string[]) => void) => {
        // I happen to be a peer that _CAN_ implement listEntries
        return cb(null, ['hello', 'world']);
      },
    };

    const left2 = expose(leftApi2).connect(bridge2.left);
    const right2 = connect<typeof leftApi2>(bridge2.right);
    disposable.add(left2);
    disposable.add(right2);

    const invokePromise = right1.invoke(
      'listEntries',
      flags.mustCall((err: null | Error, entries: string[]) => {
        expect(err).to.be.null();
        expect(entries).to.equal(['hello', 'world']);
      }, 1)
    );

    expect(await invokePromise).to.be.undefined();
  });
});
