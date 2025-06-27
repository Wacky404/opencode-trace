import { logEvent, setCleanupFunctions } from './server-interceptor.js';
import type { InterceptionConfig } from '../types/cli.js';

// Store original fetch function
let originalFetch: typeof globalThis.fetch | null = null;
let currentSessionId: string = '';
let currentConfig: InterceptionConfig = {};

export function patchGlobalFetch(sessionId: string, config: InterceptionConfig): void {
  if (originalFetch) {
    console.warn('⚠️  Fetch already patched, skipping');
    return;
  }
  
  currentSessionId = sessionId;
  currentConfig = config;
  
  // Store original fetch
  originalFetch = globalThis.fetch;
  
  // Replace with traced version
  globalThis.fetch = tracedFetch;
  
  console.log('🔗 Fetch patching enabled');
  
  // Register cleanup function
  setCleanupFunctions(restoreFetch, () => {}, () => {});
}

async function tracedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!originalFetch) {
    throw new Error('Original fetch not available');
  }
  
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Extract request details
  const request = await extractRequestDetails(input, init);
  
  // Log request start
  logEvent({
    type: 'http_request_start',
    sessionId: currentSessionId,
    timestamp: startTime,
    requestId,
    data: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      provider: detectAIProvider(request.url)
    }
  });
  
  try {
    // Make the actual request
    const response = await originalFetch(input, init);
    const endTime = Date.now();
    
    // Clone response to read body without consuming it
    const responseClone = response.clone();
    const responseBody = await extractResponseBody(responseClone);
    
    // Log successful response
    logEvent({
      type: 'http_request_complete',
      sessionId: currentSessionId,
      timestamp: endTime,
      requestId,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        duration: endTime - startTime,
        provider: detectAIProvider(request.url)
      }
    });
    
    return response;
    
  } catch (error) {
    const endTime = Date.now();
    
    // Log error response
    logEvent({
      type: 'http_request_error',
      sessionId: currentSessionId,
      timestamp: endTime,
      requestId,
      data: {
        error: error instanceof Error ? error.message : String(error),
        duration: endTime - startTime,
        provider: detectAIProvider(request.url)
      }
    });
    
    throw error;
  }
}

async function extractRequestDetails(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}> {
  let url: string;
  let method = 'GET';
  let headers: Record<string, string> = {};
  let body: string | null = null;
  
  // Extract URL
  if (input instanceof URL) {
    url = input.toString();
  } else if (typeof input === 'string') {
    url = input;
  } else {
    // Request object
    url = input.url;
    method = input.method || 'GET';
    if (input.headers) {
      headers = Object.fromEntries(new Headers(input.headers).entries());
    }
  }
  
  // Override with init options
  if (init) {
    if (init.method) method = init.method;
    if (init.headers) {
      headers = { ...headers, ...Object.fromEntries(new Headers(init.headers).entries()) };
    }
    if (init.body) {
      body = await extractBody(init.body);
    }
  }
  
  return { method, url, headers, body };
}

async function extractBody(body: BodyInit): Promise<string | null> {
  if (!body) return null;
  
  try {
    if (typeof body === 'string') {
      return truncateBody(body);
    } else if (body instanceof URLSearchParams) {
      return truncateBody(body.toString());
    } else if (body instanceof FormData) {
      // FormData is harder to serialize, just note its presence
      return '[FormData]';
    } else if (body instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${body.byteLength} bytes]`;
    } else if (body instanceof ReadableStream) {
      return '[ReadableStream]';
    } else {
      return '[Unknown body type]';
    }
  } catch (error) {
    return `[Error extracting body: ${error}]`;
  }
}

async function extractResponseBody(response: Response): Promise<string | null> {
  try {
    const contentType = response.headers.get('content-type') || '';
    
    // Only capture text-based responses
    if (contentType.includes('application/json') || 
        contentType.includes('text/') || 
        contentType.includes('application/xml')) {
      
      const text = await response.text();
      return truncateBody(text);
    }
    
    return `[${contentType || 'binary'}]`;
    
  } catch (error) {
    return `[Error extracting response: ${error}]`;
  }
}

function truncateBody(body: string): string {
  const maxSize = currentConfig.maxBodySize || 1048576; // 1MB default
  
  if (body.length <= maxSize) {
    return body;
  }
  
  return body.substring(0, maxSize) + `\n[... truncated ${body.length - maxSize} characters]`;
}

function detectAIProvider(url: string): string | null {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('api.anthropic.com')) return 'anthropic';
  if (urlLower.includes('api.openai.com')) return 'openai';
  if (urlLower.includes('generativelanguage.googleapis.com')) return 'google';
  if (urlLower.includes('api.cohere.ai')) return 'cohere';
  if (urlLower.includes('api.replicate.com')) return 'replicate';
  
  return null;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
    console.log('🔗 Fetch patching disabled');
  }
}

export function isAIProviderRequest(url: string): boolean {
  return detectAIProvider(url) !== null;
}

export function shouldCaptureRequest(url: string): boolean {
  // Always capture AI provider requests
  if (isAIProviderRequest(url)) {
    return true;
  }
  
  // Capture all requests if configured
  if (currentConfig.includeAllRequests) {
    return true;
  }
  
  // Skip common non-essential requests
  const urlLower = url.toLowerCase();
  const skipPatterns = [
    '/favicon.ico',
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.gif',
    '.svg',
    '/metrics',
    '/health',
    '/ping'
  ];
  
  return !skipPatterns.some(pattern => urlLower.includes(pattern));
}