import { MessageChannel } from 'worker_threads';

import { Transport } from '../../src';

export class TransportBridge {
  private mc = new MessageChannel();

  public readonly left = Transport.fromNodeMessagePort(this.mc.port1);
  public readonly right = Transport.fromNodeMessagePort(this.mc.port2);

  constructor() {
    this.left.onMessage(msg => console.debug('[L -> R]', ...msg));
    this.right.onMessage(msg => console.debug('[R -> L]', ...msg));
  }

  dispose() {
    this.left.dispose();
    this.right.dispose();
  }
}
