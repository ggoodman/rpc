import { Transport } from '../../src';

const resolvedPromise = Promise.resolve();

class MockChannel implements Transport {
  constructor(
    private readonly fromHandlers = [] as ((msg: unknown[]) => void)[],
    private readonly toHandlers = [] as ((msg: unknown[]) => void)[]
  ) {
    this.onMessage = this.onMessage.bind(this);
  }

  dispose() {
    this.fromHandlers.length = 0;
  }

  onMessage(cb: (msg: unknown[]) => void) {
    this.fromHandlers.push(cb);

    return {
      dispose() {},
    };
  }

  sendMessage(msg: unknown[]) {
    // Simulate structural cloning
    msg = JSON.parse(JSON.stringify(msg));

    for (const handler of this.toHandlers) {
      resolvedPromise.then(() => {
        handler(msg);
      });
    }
  }
}

export class TransportBridge {
  private readonly id = TransportBridge.nextId++;
  private readonly leftHandlers = [] as ((msg: unknown[]) => void)[];
  private readonly rightHandlers = [] as ((msg: unknown[]) => void)[];

  public readonly left = new MockChannel(this.leftHandlers, this.rightHandlers);
  public readonly right = new MockChannel(this.rightHandlers, this.leftHandlers);

  constructor() {
    this.left.onMessage(msg => console.debug(`[R${this.id} -> L${this.id}]`, ...msg));
    this.right.onMessage(msg => console.debug(`[L${this.id} -> R${this.id}]`, ...msg));
  }

  dispose() {
    this.left.dispose();
    this.right.dispose();
  }

  private static nextId = 0;
}
