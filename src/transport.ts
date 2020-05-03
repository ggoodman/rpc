import { Emitter } from 'ts-primitives';

export type SendMessageFunction = (msg: unknown[]) => void;

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
  onMessage(
    handler: (msg: { data: unknown[]; sendMessage?: SendMessageFunction }) => void
  ): { dispose(): void };

  /**
   * Send an RPC message to the peer over this transport
   *
   * @param msg The array-encoded message that should be sent to the peer over the transport
   * @param transfer An optional array of objects that should be marked as transferrable when the transport supports it
   */
  sendMessage: SendMessageFunction;
}

class DomMessagePortTransport implements Transport {
  private readonly _boundOnMessageHandler = this._onMessageHandler.bind(this);
  private readonly _boundSendMessage = this.sendMessage.bind(this);
  private readonly _onMessage = new Emitter<{
    data: unknown[];
    sendMessage: SendMessageFunction;
  }>();

  constructor(private readonly port: MessagePort) {
    this.port.addEventListener('message', this._boundOnMessageHandler);
    this.port.start();
  }

  get onMessage() {
    return this._onMessage.event;
  }

  dispose() {
    this._onMessage.dispose();
    this.port.removeEventListener('message', this._boundOnMessageHandler);
    this.port.close();
  }

  sendMessage(msg: unknown[]) {
    this.port.postMessage(msg);
  }

  private _onMessageHandler(e: MessageEvent) {
    if (!e.data || !Array.isArray(e.data)) {
      return;
    }

    this._onMessage.fire({ data: e.data, sendMessage: this._boundSendMessage });
  }
}

class DomWorkerTransport implements Transport {
  private readonly _boundOnMessageHandler = this._onMessageHandler.bind(this);
  private readonly _boundSendMessage = this.sendMessage.bind(this);
  private readonly _onMessage = new Emitter<{
    data: unknown[];
    sendMessage: SendMessageFunction;
  }>();

  constructor(private readonly worker: Worker) {
    this.worker.addEventListener('message', this._boundOnMessageHandler);
  }

  get onMessage() {
    return this._onMessage.event;
  }

  dispose() {
    this._onMessage.dispose();
    this.worker.removeEventListener('message', this._boundOnMessageHandler);
  }

  sendMessage(msg: unknown[]) {
    this.worker.postMessage(msg);
  }

  private _onMessageHandler(e: MessageEvent) {
    if (!e.data || !Array.isArray(e.data)) {
      return;
    }

    this._onMessage.fire({ data: e.data, sendMessage: this._boundSendMessage });
  }
}

class NodeMessagePortTransport implements Transport {
  private readonly _boundOnMessageHandler = this._onMessageHandler.bind(this);
  private readonly _boundSendMessage = this.sendMessage.bind(this);
  private readonly _onMessage = new Emitter<{
    data: unknown[];
    sendMessage: SendMessageFunction;
  }>();

  constructor(private readonly port: import('worker_threads').MessagePort) {
    this.port.on('message', this._boundOnMessageHandler);
  }

  get onMessage() {
    return this._onMessage.event;
  }

  dispose() {
    this._onMessage.dispose();
    this.port.removeListener('message', this._boundOnMessageHandler);
  }

  sendMessage(msg: unknown[]) {
    this.port.postMessage(msg);
  }

  private _onMessageHandler(e: unknown) {
    if (!Array.isArray(e)) {
      return;
    }

    this._onMessage.fire({ data: e, sendMessage: this._boundSendMessage });
  }
}

export namespace Transport {
  export function fromNodeMessagePort(port: import('worker_threads').MessagePort): Transport {
    return new NodeMessagePortTransport(port);
  }
  export function fromDomWorker(worker: Worker): Transport {
    return new DomWorkerTransport(worker);
  }
  export function fromDomMessagePort(port: MessagePort): Transport {
    return new DomMessagePortTransport(port);
  }
}
