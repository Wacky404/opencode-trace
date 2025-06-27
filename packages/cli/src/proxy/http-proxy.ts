import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { URL } from 'node:url';
import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type { InterceptionConfig } from '../types/cli.js';

export interface ProxyEvent {
  type: 'http_request_start' | 'http_request_complete' | 'http_request_error' | 'https_connect_start' | 'https_connect_complete';
  sessionId: string;
  timestamp: number;
  requestId: string;
  data: any;
}

export interface ProxyConfig extends InterceptionConfig {
  port?: number;
  host?: string;
  enableHTTPS?: boolean;
}

export class HTTPProxy extends EventEmitter {
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private sessionId: string;
  private config: ProxyConfig;
  private requestCounter = 0;

  constructor(sessionId: string, config: ProxyConfig = {}) {
    super();
    this.sessionId = sessionId;
    this.config = {
      port: 8888,
      host: '127.0.0.1',
      enableHTTPS: true,
      includeAllRequests: false,
      maxBodySize: 1048576, // 1MB
      ...config
    };
    this.port = this.config.port!;
    this.host = this.config.host!;
  }

  async start(): Promise<{ port: number; host: string }> {
    if (this.server) {
      throw new Error('Proxy server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer();
      
      this.server.on('connect', this.handleConnect.bind(this));
      this.server.on('request', this.handleRequest.bind(this));
      this.server.on('error', reject);

      this.server.listen(this.port, this.host, () => {
        console.log(chalk.blue(`🌐 HTTP proxy started on ${this.host}:${this.port}`));
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log(chalk.gray('🌐 HTTP proxy stopped'));
        this.server = null;
        resolve();
      });
    });
  }

  private handleConnect(req: http.IncomingMessage, socket: any, head: Buffer): void {
    // Handle HTTPS CONNECT requests
    const [host, port] = req.url!.split(':');
    const targetPort = parseInt(port || '443', 10);
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    if (this.config.debug) {
      console.log(chalk.gray(`[proxy] CONNECT ${host}:${targetPort}`));
    }

    // Log HTTPS connection start
    this.logEvent({
      type: 'https_connect_start',
      sessionId: this.sessionId,
      timestamp: startTime,
      requestId,
      data: {
        method: 'CONNECT',
        host,
        port: targetPort,
        url: `https://${host}:${targetPort}`,
        provider: this.detectAIProvider(`https://${host}`)
      }
    });

    // Create connection to target server
    const targetSocket = new net.Socket();
    
    targetSocket.connect(targetPort, host, () => {
      const endTime = Date.now();
      
      // Log successful HTTPS connection
      this.logEvent({
        type: 'https_connect_complete',
        sessionId: this.sessionId,
        timestamp: endTime,
        requestId,
        data: {
          status: 200,
          statusText: 'Connection Established',
          duration: endTime - startTime,
          host,
          port: targetPort,
          provider: this.detectAIProvider(`https://${host}`)
        }
      });

      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });

    targetSocket.on('error', (err: Error) => {
      const endTime = Date.now();
      
      // Log HTTPS connection error
      this.logEvent({
        type: 'http_request_error',
        sessionId: this.sessionId,
        timestamp: endTime,
        requestId,
        data: {
          error: err.message,
          duration: endTime - startTime,
          host,
          port: targetPort,
          provider: this.detectAIProvider(`https://${host}`)
        }
      });

      if (this.config.debug) {
        console.error(chalk.red(`[proxy] CONNECT error to ${host}:${targetPort}:`), err.message);
      }
      socket.end();
    });

    socket.on('error', (err: Error) => {
      if (this.config.debug) {
        console.log(chalk.gray(`[proxy] https_connect_complete: ${host}`));
      }
      
      // Log HTTPS connection completion with error status
      this.logEvent({
        type: 'https_connect_complete',
        sessionId: this.sessionId,
        timestamp: Date.now(),
        requestId,
        data: {
          status: 500,
          statusText: 'Connection Error',
          duration: Date.now() - startTime,
          host,
          port: targetPort,
          error: err.message,
          provider: this.detectAIProvider(`https://${host}`)
        }
      });
      
      targetSocket.destroy();
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const url = req.url!;
    const method = req.method!;

    // Parse target URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: Invalid URL');
      return;
    }

    // Check if we should capture this request
    if (!this.shouldCaptureRequest(targetUrl.toString())) {
      this.forwardRequest(req, res, targetUrl);
      return;
    }

    if (this.config.debug) {
      console.log(chalk.gray(`[proxy] ${method} ${targetUrl.toString()}`));
    }

    // Collect request body
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk.toString();
    });

    req.on('end', () => {
      // Log request start
      this.logEvent({
        type: 'http_request_start',
        sessionId: this.sessionId,
        timestamp: startTime,
        requestId,
        data: {
          method,
          url: targetUrl.toString(),
          headers: this.sanitizeHeaders(req.headers),
          body: this.truncateBody(requestBody),
          provider: this.detectAIProvider(targetUrl.toString())
        }
      });

      // Forward request and capture response
      this.forwardRequestWithLogging(req, res, targetUrl, requestId, startTime, requestBody);
    });

    req.on('error', (error) => {
      this.logEvent({
        type: 'http_request_error',
        sessionId: this.sessionId,
        timestamp: Date.now(),
        requestId,
        data: {
          error: error.message,
          duration: Date.now() - startTime,
          provider: this.detectAIProvider(targetUrl.toString())
        }
      });
      res.writeHead(500);
      res.end('Proxy Error');
    });
  }

  private forwardRequestWithLogging(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: URL,
    requestId: string,
    startTime: number,
    requestBody: string
  ): void {
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const port = targetUrl.port || (isHttps ? 443 : 80);

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers }
    };

    // Remove proxy-specific headers
    delete options.headers!['proxy-connection'];
    delete options.headers!['proxy-authorization'];

    const proxyReq = client.request(options, (proxyRes) => {
      const endTime = Date.now();
      
      // Collect response body
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        responseBody += chunk.toString();
      });

      proxyRes.on('end', () => {
        // Log successful response
        this.logEvent({
          type: 'http_request_complete',
          sessionId: this.sessionId,
          timestamp: endTime,
          requestId,
          data: {
            status: proxyRes.statusCode,
            statusText: proxyRes.statusMessage,
            headers: this.sanitizeHeaders(proxyRes.headers),
            body: this.truncateBody(responseBody),
            duration: endTime - startTime,
            provider: this.detectAIProvider(targetUrl.toString())
          }
        });
      });

      // Forward response headers and status
      res.writeHead(proxyRes.statusCode!, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      const endTime = Date.now();
      
      this.logEvent({
        type: 'http_request_error',
        sessionId: this.sessionId,
        timestamp: endTime,
        requestId,
        data: {
          error: error.message,
          duration: endTime - startTime,
          provider: this.detectAIProvider(targetUrl.toString())
        }
      });

      res.writeHead(502);
      res.end('Bad Gateway');
    });

    // Send request body
    if (requestBody) {
      proxyReq.write(requestBody);
    }
    proxyReq.end();
  }

  private forwardRequest(req: http.IncomingMessage, res: http.ServerResponse, targetUrl: URL): void {
    // Simple forwarding without logging for non-captured requests
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const port = targetUrl.port || (isHttps ? 443 : 80);

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers }
    };

    delete options.headers!['proxy-connection'];
    delete options.headers!['proxy-authorization'];

    const proxyReq = client.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode!, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', () => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    req.pipe(proxyReq);
  }

  private shouldCaptureRequest(url: string): boolean {
    // Always capture AI provider requests
    if (this.isAIProviderRequest(url)) {
      return true;
    }

    // Capture all requests if configured
    if (this.config.includeAllRequests) {
      return true;
    }

    return false;
  }

  private isAIProviderRequest(url: string): boolean {
    return this.detectAIProvider(url) !== null;
  }

  private detectAIProvider(url: string): string | null {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('api.anthropic.com')) return 'anthropic';
    if (urlLower.includes('api.openai.com')) return 'openai';
    if (urlLower.includes('generativelanguage.googleapis.com')) return 'google';
    if (urlLower.includes('api.cohere.ai')) return 'cohere';
    if (urlLower.includes('api.replicate.com')) return 'replicate';
    
    return null;
  }

  private sanitizeHeaders(headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value || '');
      }
    }

    return sanitized;
  }

  private truncateBody(body: string): string {
    const maxSize = this.config.maxBodySize || 1048576;
    
    if (body.length <= maxSize) {
      return body;
    }
    
    return body.substring(0, maxSize) + `\n[... truncated ${body.length - maxSize} characters]`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${(++this.requestCounter).toString(36)}`;
  }

  private logEvent(event: ProxyEvent): void {
    // Validate event before emitting to prevent downstream crashes
    if (!event || typeof event !== 'object') {
      console.warn(chalk.yellow('⚠️  Attempted to log invalid proxy event:'), event);
      return;
    }

    if (!event.type) {
      console.warn(chalk.yellow('⚠️  Attempted to log proxy event without type:'), event);
      return;
    }

    this.emit('event', event);
  }

  getProxyUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  getProxyConfig(): { HTTP_PROXY: string; HTTPS_PROXY: string; http_proxy: string; https_proxy: string } {
    const proxyUrl = this.getProxyUrl();
    return {
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl
    };
  }
}