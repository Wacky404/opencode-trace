import { html, TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

/**
 * Utility functions for component development
 */

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number, format: 'time' | 'date' | 'datetime' | 'relative' = 'datetime'): string {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString();
    case 'date':
      return date.toLocaleDateString();
    case 'datetime':
      return date.toLocaleString();
    case 'relative':
      return formatRelativeTime(timestamp);
    default:
      return date.toISOString();
  }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  
  return `${Math.floor(diff / 86400000)} days ago`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse JSON safely with fallback
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate unique ID for component instances
 */
export function generateId(prefix = 'oc'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view smoothly
 */
export function scrollIntoView(element: Element, options?: ScrollIntoViewOptions): void {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
    ...options
  });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Create icon template with proper sizing and accessibility
 */
export function renderIcon(
  name: string, 
  size: 'small' | 'medium' | 'large' = 'medium',
  ariaLabel?: string
): TemplateResult {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5', 
    large: 'w-6 h-6'
  };
  
  return html`
    <svg 
      class="icon ${sizeClasses[size]}" 
      ${ariaLabel ? `aria-label="${ariaLabel}"` : 'aria-hidden="true"'}
      role=${ariaLabel ? 'img' : 'presentation'}
    >
      <use href="#icon-${name}"></use>
    </svg>
  `;
}

/**
 * Create badge template with proper styling
 */
export function renderBadge(
  content: string | number,
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' = 'default'
): TemplateResult {
  const variantClasses = {
    default: 'bg-vs-bg-secondary text-vs-text',
    success: 'bg-vs-success text-white',
    warning: 'bg-vs-warning text-black',
    error: 'bg-vs-error text-white',
    info: 'bg-vs-accent text-white'
  };
  
  return html`
    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variantClasses[variant]}">
      ${content}
    </span>
  `;
}

/**
 * Create loading state template
 */
export function renderLoadingState(message = 'Loading...'): TemplateResult {
  return html`
    <div class="flex items-center justify-center p-8">
      <div class="spinner mr-3"></div>
      <span class="vs-text-muted">${message}</span>
    </div>
  `;
}

/**
 * Create empty state template
 */
export function renderEmptyState(
  title: string,
  description?: string,
  actionButton?: TemplateResult
): TemplateResult {
  return html`
    <div class="flex flex-col items-center justify-center p-8 text-center">
      <div class="vs-text-muted mb-2 text-lg">${title}</div>
      ${description ? html`<div class="vs-text-subtle mb-4">${description}</div>` : ''}
      ${actionButton || ''}
    </div>
  `;
}

/**
 * Create error state template
 */
export function renderErrorState(
  error: string | Error,
  retry?: () => void
): TemplateResult {
  const message = typeof error === 'string' ? error : error.message;
  
  return html`
    <div class="flex flex-col items-center justify-center p-8 text-center">
      <div class="vs-error mb-2 text-lg">Error</div>
      <div class="vs-text-muted mb-4">${message}</div>
      ${retry ? html`
        <button 
          @click=${retry}
          class="px-4 py-2 bg-vs-accent text-white rounded hover:bg-vs-accent-hover transition-colors"
        >
          Try Again
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Format JSON with syntax highlighting classes
 */
export function formatJsonForDisplay(obj: any, indent = 2): string {
  return JSON.stringify(obj, null, indent);
}

/**
 * Get CSS class list for conditional styling
 */
export function getClassList(base: string, conditionals: Record<string, boolean>): string {
  return [base, ...Object.entries(conditionals).filter(([, condition]) => condition).map(([className]) => className)].join(' ');
}