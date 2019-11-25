import { MessageChannel } from 'worker_threads';

import { Transport } from '../../src';

export class TransportBridge {
  private readonly id = TransportBridge.nextId++;
  private mc = new MessageChannel();

  public readonly left = Transport.fromNodeMessagePort(this.mc.port1);
  public readonly right = Transport.fromNodeMessagePort(this.mc.port2);

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
