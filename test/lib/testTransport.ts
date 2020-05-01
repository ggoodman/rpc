import { Transport } from '../../src';

const resolvedPromise = Promise.resolve();

class MockChannel implements Transport {
  constructor(
    private readonly fromHandlers = [] as ((msg: {
      data: unknown[];
      sendMessage: (msg: unknown[]) => void;
    }) => void)[],
    private readonly toHandlers = [] as ((msg: {
      data: unknown[];
      sendMessage: (msg: unknown[]) => void;
    }) => void)[]
  ) {
    this.onMessage = this.onMessage.bind(this);
  }

  dispose() {
    this.fromHandlers.length = 0;
  }

  onMessage(cb: (msg: { data: unknown[]; sendMessage: (msg: unknown[]) => void }) => void) {
    this.fromHandlers.push(cb);

    return {
      dispose() {},
    };
  }

  sendMessage(data: unknown[]) {
    // Simulate structural cloning
    data = JSON.parse(JSON.stringify(data));

    for (const handler of this.toHandlers) {
      resolvedPromise.then(() => {
        handler({
          data: data,
          sendMessage: (data: unknown[]) => {
            for (const handler of this.fromHandlers) {
              handler({ data, sendMessage: this.sendMessage.bind(this) });
            }
          },
        });
      });
    }
  }
}

export class TransportBridge {
  private readonly id = TransportBridge.nextId++;
  private readonly leftHandlers = [] as ((msg: {
    data: unknown[];
    sendMessage: (msg: unknown[]) => void;
  }) => void)[];
  private readonly rightHandlers = [] as ((msg: {
    data: unknown[];
    sendMessage: (msg: unknown[]) => void;
  }) => void)[];

  public readonly left = new MockChannel(this.leftHandlers, this.rightHandlers);
  public readonly right = new MockChannel(this.rightHandlers, this.leftHandlers);

  constructor() {
    this.left.onMessage(msg => console.debug(`[R${this.id} -> L${this.id}]`, ...msg.data));
    this.right.onMessage(msg => console.debug(`[L${this.id} -> R${this.id}]`, ...msg.data));
  }

  dispose() {
    this.left.dispose();
    this.right.dispose();
  }

  private static nextId = 0;
}
