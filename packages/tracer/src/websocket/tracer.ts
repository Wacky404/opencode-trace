import type { 
  WebSocketConnectionEvent, 
  WebSocketMessageEvent, 
  WebSocketErrorEvent,
  WebSocketConfig,
  WebSocketMetrics,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';
import { MessageHandler } from './message-handler.js';
import { ConnectionManager } from './connection-manager.js';

export interface TracingWebSocketConfig extends WebSocketConfig {
  sessionId: string;
  logger: JSONLLogger;
  url: string;
  protocols?: string | string[];
}

export class TracingWebSocket extends EventTarget {
  private ws: WebSocket | null = null;
  private config: TracingWebSocketConfig;
  private messageHandler: MessageHandler;
  private connectionManager: ConnectionManager;
  private metrics: WebSocketMetrics;
  private connectionStartTime: number = 0;

  // WebSocket-like properties
  public readonly CONNECTING = 0;
  public readonly OPEN = 1;  
  public readonly CLOSING = 2;
  public readonly CLOSED = 3;

  constructor(config: TracingWebSocketConfig) {
    super();
    this.config = {
      ...config,
      captureMessages: config.captureMessages ?? true,
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB default
      sanitizeData: config.sanitizeData ?? true,
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true
    };

    this.messageHandler = new MessageHandler(this.config);
    this.connectionManager = new ConnectionManager(this.config);
    
    this.metrics = {
      connectionCount: 0,
      messagesInbound: 0,
      messagesOutbound: 0,
      bytesInbound: 0,
      bytesOutbound: 0,
      averageLatency: 0,
      connectionDuration: 0,
      errors: 0
    };

    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      this.connectionStartTime = Date.now();
      
      await this.logConnectionEvent('connecting');
      
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventListeners();
      
      this.metrics.connectionCount++;
      
    } catch (error) {
      await this.logErrorEvent(`Connection failed: ${error}`, 0, 'Connection failed');
      this.metrics.errors++;
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = async (event) => {
      const timing = this.calculateTiming(this.connectionStartTime);
      await this.logConnectionEvent('open', timing);
      this.metrics.connectionDuration = timing.duration;
      
      // Forward event
      this.dispatchEvent(new Event('open'));
    };

    this.ws.onmessage = async (event) => {
      const messageStartTime = Date.now();
      
      if (this.config.captureMessages) {
        await this.messageHandler.handleIncomingMessage(event.data, messageStartTime);
      }
      
      this.updateInboundMetrics(event.data);
      
      // Forward event
      this.dispatchEvent(new MessageEvent('message', { data: event.data }));
    };

    this.ws.onclose = async (event) => {
      const timing = this.calculateTiming(this.connectionStartTime);
      await this.logConnectionEvent('closed', timing);
      this.metrics.connectionDuration = timing.duration;
      
      // Forward event
      this.dispatchEvent(new CloseEvent('close', { 
        code: event.code, 
        reason: event.reason, 
        wasClean: event.wasClean 
      }));
    };

    this.ws.onerror = async (event) => {
      await this.logErrorEvent('WebSocket error occurred');
      this.metrics.errors++;
      
      // Forward event
      this.dispatchEvent(new Event('error'));
    };
  }

  public async send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const messageStartTime = Date.now();
    
    try {
      if (this.config.captureMessages) {
        await this.messageHandler.handleOutgoingMessage(data, messageStartTime);
      }
      
      this.ws.send(data);
      this.updateOutboundMetrics(data);
      
    } catch (error) {
      await this.logErrorEvent(`Send failed: ${error}`);
      this.metrics.errors++;
      throw error;
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  // WebSocket-like properties
  public get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  public get url(): string {
    return this.ws?.url ?? '';
  }

  public get protocol(): string {
    return this.ws?.protocol ?? '';
  }

  public get extensions(): string {
    return this.ws?.extensions ?? '';
  }

  public get bufferedAmount(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  // Event handlers (for compatibility)
  private _onopen: ((event: Event) => void) | null = null;
  private _onmessage: ((event: MessageEvent) => void) | null = null;
  private _onclose: ((event: CloseEvent) => void) | null = null;
  private _onerror: ((event: Event) => void) | null = null;

  public set onopen(handler: ((event: Event) => void) | null) {
    if (this._onopen) {
      this.removeEventListener('open', this._onopen);
    }
    this._onopen = handler;
    if (handler) {
      this.addEventListener('open', handler);
    }
  }

  public get onopen() {
    return this._onopen;
  }

  public set onmessage(handler: ((event: MessageEvent) => void) | null) {
    if (this._onmessage) {
      this.removeEventListener('message', this._onmessage as EventListener);
    }
    this._onmessage = handler;
    if (handler) {
      this.addEventListener('message', handler as EventListener);
    }
  }

  public get onmessage() {
    return this._onmessage;
  }

  public set onclose(handler: ((event: CloseEvent) => void) | null) {
    if (this._onclose) {
      this.removeEventListener('close', this._onclose as EventListener);
    }
    this._onclose = handler;
    if (handler) {
      this.addEventListener('close', handler as EventListener);
    }
  }

  public get onclose() {
    return this._onclose;
  }

  public set onerror(handler: ((event: Event) => void) | null) {
    if (this._onerror) {
      this.removeEventListener('error', this._onerror);
    }
    this._onerror = handler;
    if (handler) {
      this.addEventListener('error', handler);
    }
  }

  public get onerror() {
    return this._onerror;
  }

  // Metrics and utilities
  public getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  public async cleanup(): Promise<void> {
    if (this.ws) {
      this.close();
    }
    await this.connectionManager.cleanup();
  }

  private calculateTiming(startTime: number): RequestTiming {
    const end = Date.now();
    return {
      start: startTime,
      end,
      duration: end - startTime
    };
  }

  private async logConnectionEvent(
    state: 'connecting' | 'open' | 'closing' | 'closed', 
    timing?: RequestTiming
  ): Promise<void> {
    const event: WebSocketConnectionEvent = {
      type: 'websocket_connection',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      url: this.config.url,
      protocols: Array.isArray(this.config.protocols) 
        ? this.config.protocols 
        : this.config.protocols ? [this.config.protocols] : undefined,
      state,
      timing
    };

    await this.config.logger.logEvent(event);
  }

  private async logErrorEvent(
    error: string, 
    code?: number, 
    reason?: string
  ): Promise<void> {
    const event: WebSocketErrorEvent = {
      type: 'websocket_error',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      error,
      code,
      reason
    };

    await this.config.logger.logEvent(event);
  }

  private updateInboundMetrics(data: any): void {
    this.metrics.messagesInbound++;
    this.metrics.bytesInbound += this.calculateDataSize(data);
  }

  private updateOutboundMetrics(data: any): void {
    this.metrics.messagesOutbound++;
    this.metrics.bytesOutbound += this.calculateDataSize(data);
  }

  private calculateDataSize(data: any): number {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Blob) {
      return data.size;
    } else if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    return 0;
  }
}