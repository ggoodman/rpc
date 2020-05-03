import * as ZeroMQ from 'zeromq';

import { Transport } from '../../src';

export class ZeroMQSocketTransport implements Transport {
  private static nextId = 0;
  private queue = Promise.resolve();

  constructor(
    readonly socket: ZeroMQ.Socket & ZeroMQ.Readable & ZeroMQ.Writable,
    readonly id = ZeroMQSocketTransport.nextId++,
    readonly debug = false
  ) {}

  dispose() {
    this.socket.close();
  }

  onMessage(handler: Parameters<Transport['onMessage']>[0]) {
    let disposed = false;

    (async () => {
      for await (const msg of this.socket) {
        if (disposed) {
          break;
        }

        if (msg.length === 2) {
          const data = JSON.parse(msg[1].toString('utf8'));
          const ret = msg[0];

          if (this.debug) console.log('ZMQ[%s] MSG', this.id, data);

          handler({
            data,
            sendMessage: msg => {
              if (this.debug) console.log('ZMQ[%s] REPLY2', this.id, msg);
              this.queue = this.queue.then(() => this.socket.send([ret, JSON.stringify(msg)]));
            },
          });
        } else if (msg.length === 1) {
          const data = JSON.parse(msg[0].toString('utf8'));

          if (this.debug) console.log('ZMQ[%s] MSG', this.id, data);

          handler({
            data,
            sendMessage: msg => {
              if (this.debug) console.log('ZMQ[%s] REPLY1', this.id, msg);
              this.queue = this.queue.then(() => this.socket.send(JSON.stringify(msg)));
            },
          });
        }
      }
    })();

    return {
      dispose() {
        disposed = true;
      },
    };
  }
  sendMessage(msg: unknown[]) {
    if (this.debug) console.log('ZMQ[%s] SEND', this.id, msg);
    this.queue = this.queue.then(() => this.socket.send(JSON.stringify(msg)));
  }
}
