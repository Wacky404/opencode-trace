/**
 * Accessibility Utilities for opencode-trace viewer
 * WCAG 2.1 AA compliant utilities and patterns
 */

import type { A11yAttributes, AriaRole } from '../types/ui.js';

// ================================================
// ARIA Utilities
// ================================================

/**
 * Generate unique IDs for accessibility relationships
 */
export function generateA11yId(prefix = 'oc-a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create ARIA attributes object from component properties
 */
export function createAriaAttributes(props: Partial<A11yAttributes>): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  Object.entries(props).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') {
        attrs[key] = value.toString();
      } else if (typeof value === 'number') {
        attrs[key] = value.toString();
      } else {
        attrs[key] = String(value);
      }
    }
  });
  
  return attrs;
}

/**
 * Create accessible button attributes
 */
export function createButtonAttributes(options: {
  label?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  describedBy?: string;
  disabled?: boolean;
}): A11yAttributes {
  const attrs: A11yAttributes = {
    role: 'button',
    tabindex: options.disabled ? -1 : 0,
  };
  
  if (options.label) attrs['aria-label'] = options.label;
  if (options.pressed !== undefined) attrs['aria-pressed'] = options.pressed;
  if (options.expanded !== undefined) attrs['aria-expanded'] = options.expanded;
  if (options.controls) attrs['aria-controls'] = options.controls;
  if (options.describedBy) attrs['aria-describedby'] = options.describedBy;
  if (options.disabled) attrs['aria-disabled'] = true;
  
  return attrs;
}

/**
 * Create accessible link attributes
 */
export function createLinkAttributes(options: {
  label?: string;
  describedBy?: string;
  external?: boolean;
  download?: boolean;
}): A11yAttributes {
  const attrs: A11yAttributes = {
    role: 'link',
    tabindex: 0,
  };
  
  if (options.label) attrs['aria-label'] = options.label;
  if (options.describedBy) attrs['aria-describedby'] = options.describedBy;
  
  return attrs;
}

/**
 * Create accessible tab attributes
 */
export function createTabAttributes(options: {
  selected?: boolean;
  controls?: string;
  label?: string;
  setSize?: number;
  posInSet?: number;
}): A11yAttributes {
  const attrs: A11yAttributes = {
    role: 'tab',
    tabindex: options.selected ? 0 : -1,
  };
  
  if (options.selected !== undefined) attrs['aria-selected'] = options.selected;
  if (options.controls) attrs['aria-controls'] = options.controls;
  if (options.label) attrs['aria-label'] = options.label;
  if (options.setSize) attrs['aria-setsize'] = options.setSize;
  if (options.posInSet) attrs['aria-posinset'] = options.posInSet;
  
  return attrs;
}

/**
 * Create accessible dialog attributes
 */
export function createDialogAttributes(options: {
  labelledBy?: string;
  describedBy?: string;
  modal?: boolean;
}): A11yAttributes {
  const attrs: A11yAttributes = {
    role: options.modal ? 'dialog' : 'alertdialog',
    tabindex: -1,
  };
  
  if (options.labelledBy) attrs['aria-labelledby'] = options.labelledBy;
  if (options.describedBy) attrs['aria-describedby'] = options.describedBy;
  
  return attrs;
}

// ================================================
// Focus Management
// ================================================

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = [];
  private static trapStack: FocusTrap[] = [];

  /**
   * Store current focus and move to new element
   */
  static moveFocus(to: HTMLElement | string): void {
    const current = document.activeElement as HTMLElement;
    if (current) {
      this.focusStack.push(current);
    }
    
    const target = typeof to === 'string' ? document.getElementById(to) : to;
    if (target) {
      target.focus();
    }
  }

  /**
   * Restore previous focus
   */
  static restoreFocus(): void {
    const previous = this.focusStack.pop();
    if (previous && document.contains(previous)) {
      previous.focus();
    }
  }

  /**
   * Clear focus stack
   */
  static clearFocusStack(): void {
    this.focusStack = [];
  }

  /**
   * Create focus trap for modal dialogs
   */
  static trapFocus(container: HTMLElement): FocusTrap {
    const trap = new FocusTrap(container);
    this.trapStack.push(trap);
    trap.activate();
    return trap;
  }

  /**
   * Remove focus trap
   */
  static releaseTrap(trap: FocusTrap): void {
    const index = this.trapStack.indexOf(trap);
    if (index > -1) {
      this.trapStack.splice(index, 1);
      trap.deactivate();
    }
  }

  /**
   * Get focusable elements within container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors))
      .filter(el => {
        const element = el as HTMLElement;
        return element.offsetWidth > 0 && 
               element.offsetHeight > 0 && 
               !element.hidden &&
               window.getComputedStyle(element).display !== 'none';
      }) as HTMLElement[];
  }
}

/**
 * Focus trap implementation
 */
export class FocusTrap {
  private container: HTMLElement;
  private firstFocusable?: HTMLElement;
  private lastFocusable?: HTMLElement;
  private active = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  activate(): void {
    if (this.active) return;
    
    this.updateFocusableElements();
    document.addEventListener('keydown', this.handleKeydown);
    this.active = true;
    
    // Focus first element
    if (this.firstFocusable) {
      this.firstFocusable.focus();
    }
  }

  deactivate(): void {
    if (!this.active) return;
    
    document.removeEventListener('keydown', this.handleKeydown);
    this.active = false;
  }

  private updateFocusableElements(): void {
    const focusable = FocusManager.getFocusableElements(this.container);
    this.firstFocusable = focusable[0];
    this.lastFocusable = focusable[focusable.length - 1];
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    this.updateFocusableElements();

    if (event.shiftKey) {
      // Shift + Tab (backward)
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab (forward)
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  }
}

// ================================================
// Keyboard Navigation
// ================================================

/**
 * Keyboard navigation patterns
 */
export class KeyboardNavigation {
  /**
   * Handle arrow key navigation for lists
   */
  static handleListNavigation(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: {
      wrap?: boolean;
      orientation?: 'horizontal' | 'vertical' | 'both';
      onSelect?: (index: number) => void;
    } = {}
  ): number {
    const { wrap = true, orientation = 'vertical', onSelect } = options;
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = wrap 
            ? (currentIndex + 1) % items.length
            : Math.min(currentIndex + 1, items.length - 1);
        }
        break;

      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = wrap
            ? (currentIndex - 1 + items.length) % items.length
            : Math.max(currentIndex - 1, 0);
        }
        break;

      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = wrap
            ? (currentIndex + 1) % items.length
            : Math.min(currentIndex + 1, items.length - 1);
        }
        break;

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = wrap
            ? (currentIndex - 1 + items.length) % items.length
            : Math.max(currentIndex - 1, 0);
        }
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect?.(currentIndex);
        return currentIndex;
    }

    if (newIndex !== currentIndex) {
      items[newIndex]?.focus();
      onSelect?.(newIndex);
    }

    return newIndex;
  }

  /**
   * Handle tab navigation
   */
  static handleTabNavigation(
    event: KeyboardEvent,
    tabs: HTMLElement[],
    panels: HTMLElement[],
    currentIndex: number,
    onChange?: (index: number) => void
  ): number {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = (currentIndex + 1) % tabs.length;
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = tabs.length - 1;
        break;
    }

    if (newIndex !== currentIndex) {
      tabs[newIndex]?.focus();
      onChange?.(newIndex);
    }

    return newIndex;
  }
}

// ================================================
// Screen Reader Utilities
// ================================================

/**
 * Screen reader announcement utilities
 */
export class ScreenReader {
  private static liveRegion?: HTMLElement;

  /**
   * Initialize live region for announcements
   */
  static initialize(): void {
    if (this.liveRegion) return;

    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announce message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.initialize();
    
    if (this.liveRegion) {
      this.liveRegion.setAttribute('aria-live', priority);
      this.liveRegion.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = '';
        }
      }, 1000);
    }
  }

  /**
   * Announce loading state
   */
  static announceLoading(message = 'Loading'): void {
    this.announce(`${message}...`, 'polite');
  }

  /**
   * Announce error
   */
  static announceError(message: string): void {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Announce success
   */
  static announceSuccess(message: string): void {
    this.announce(`Success: ${message}`, 'polite');
  }

  /**
   * Announce page change
   */
  static announcePageChange(title: string): void {
    this.announce(`Navigated to ${title}`, 'polite');
  }
}

// ================================================
// Color Contrast Utilities
// ================================================

/**
 * Color contrast calculation utilities
 */
export class ColorContrast {
  /**
   * Calculate relative luminance of a color
   */
  static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return 1;
    
    const l1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if contrast ratio meets WCAG AA standard
   */
  static meetsWCAG_AA(foreground: string, background: string, large = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return large ? ratio >= 3 : ratio >= 4.5;
  }

  /**
   * Check if contrast ratio meets WCAG AAA standard
   */
  static meetsWCAG_AAA(foreground: string, background: string, large = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return large ? ratio >= 4.5 : ratio >= 7;
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}

// ================================================
// Reduced Motion Utilities
// ================================================

/**
 * Reduced motion preference utilities
 */
export class ReducedMotion {
  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get appropriate animation duration based on user preference
   */
  static getAnimationDuration(normalDuration: number): number {
    return this.prefersReducedMotion() ? 0 : normalDuration;
  }

  /**
   * Apply reduced motion class if needed
   */
  static applyReducedMotionClass(element: HTMLElement): void {
    if (this.prefersReducedMotion()) {
      element.classList.add('reduce-motion');
    }
  }

  /**
   * Listen for reduced motion preference changes
   */
  static onPreferenceChange(callback: (prefersReduced: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }
}

// ================================================
// High Contrast Mode Utilities
// ================================================

/**
 * High contrast mode utilities
 */
export class HighContrast {
  /**
   * Check if high contrast mode is enabled
   */
  static isHighContrastMode(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Apply high contrast styles
   */
  static applyHighContrastStyles(element: HTMLElement): void {
    if (this.isHighContrastMode()) {
      element.classList.add('high-contrast');
    }
  }

  /**
   * Listen for high contrast preference changes
   */
  static onPreferenceChange(callback: (prefersHigh: boolean) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }
}

// ================================================
// Accessibility Testing Utilities
// ================================================

/**
 * Accessibility testing and validation utilities
 */
export class A11yTesting {
  /**
   * Check for common accessibility issues
   */
  static validateElement(element: HTMLElement): string[] {
    const issues: string[] = [];
    
    // Check for missing alt text on images
    const images = element.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push(`Image ${index + 1} missing alt text or aria-label`);
      }
    });
    
    // Check for buttons without accessible names
    const buttons = element.querySelectorAll('button');
    buttons.forEach((button, index) => {
      const hasText = button.textContent?.trim();
      const hasAriaLabel = button.getAttribute('aria-label');
      const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
      
      if (!hasText && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push(`Button ${index + 1} has no accessible name`);
      }
    });
    
    // Check for form inputs without labels
    const inputs = element.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id');
      const hasLabel = id && element.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push(`Form control ${index + 1} has no associated label`);
      }
    });
    
    // Check for insufficient color contrast
    // Note: This is a simplified check - real implementation would need more sophisticated color analysis
    
    return issues;
  }

  /**
   * Log accessibility tree for debugging
   */
  static logAccessibilityTree(element: HTMLElement): void {
    const getA11yInfo = (el: Element): any => {
      return {
        tagName: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledBy: el.getAttribute('aria-labelledby'),
        ariaDescribedBy: el.getAttribute('aria-describedby'),
        tabIndex: el.getAttribute('tabindex'),
        textContent: el.textContent?.trim().substring(0, 50),
        children: Array.from(el.children).map(getA11yInfo)
      };
    };
    
    console.log('Accessibility Tree:', getA11yInfo(element));
  }
}

// Initialize screen reader support
ScreenReader.initialize();