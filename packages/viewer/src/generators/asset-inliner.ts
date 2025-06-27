import type { 
  InlinedAssets, 
  AssetInliningOptions, 
  AssetManifest 
} from '../types/html.js';

/**
 * Asset inliner for embedding CSS, fonts, and images into HTML
 * Handles optimization and base64 encoding for self-contained files
 */
export class AssetInliner {
  private fontCache = new Map<string, string>();
  private imageCache = new Map<string, string>();
  private cssCache = new Map<string, string>();

  /**
   * Inline all assets into self-contained format
   */
  async inlineAssets(options: AssetInliningOptions): Promise<InlinedAssets> {
    const warnings: string[] = [];
    const manifest: AssetManifest = {
      assets: [],
      totalSize: 0,
      inlinedSize: 0,
      optimizationRatio: 1
    };

    try {
      // Process CSS and extract external references
      const processedCSS = await this.processCSS(options.css, {
        inlineFonts: options.fonts,
        inlineImages: options.images,
        optimize: options.optimize !== false,
        maxSize: options.maxSize || 1024 * 1024 // 1MB default
      });

      // Collect fonts
      const fonts = options.fonts ? await this.collectFonts(processedCSS.css) : [];

      // Collect images
      const images = options.images ? await this.collectImages(processedCSS.css) : [];

      // Update manifest
      manifest.assets = [
        ...processedCSS.assets,
        ...fonts.map(font => ({
          type: 'font' as const,
          name: font.name,
          size: font.data.length,
          inlined: true,
          optimized: font.optimized
        })),
        ...images.map(img => ({
          type: 'image' as const,
          name: img.name,
          size: img.data.length,
          inlined: true,
          optimized: img.optimized
        }))
      ];

      manifest.totalSize = manifest.assets.reduce((sum, asset) => sum + asset.size, 0);
      manifest.inlinedSize = manifest.assets.filter(a => a.inlined).reduce((sum, asset) => sum + asset.size, 0);
      manifest.optimizationRatio = processedCSS.optimizationRatio;

      return {
        css: processedCSS.css,
        fonts: fonts.map(f => f.data),
        images,
        assetCount: manifest.assets.length,
        manifest,
        warnings: [...warnings, ...processedCSS.warnings]
      };

    } catch (error) {
      throw new Error(`Asset inlining failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process CSS and inline external resources
   */
  private async processCSS(css: string, options: {
    inlineFonts: boolean;
    inlineImages: boolean;
    optimize: boolean;
    maxSize: number;
  }): Promise<{
    css: string;
    assets: Array<{ type: 'css'; name: string; size: number; inlined: boolean; optimized: boolean }>;
    warnings: string[];
    optimizationRatio: number;
  }> {
    const warnings: string[] = [];
    const originalSize = css.length;
    let processedCSS = css;

    // Extract and inline font URLs
    if (options.inlineFonts) {
      const fontMatches = css.matchAll(/@font-face\s*{[^}]*src:\s*url\(['"]?([^'")\s]+)['"]?\)[^}]*}/g);
      
      for (const match of fontMatches) {
        const fontUrl = match[1];
        try {
          const inlinedFont = await this.inlineFont(fontUrl, options.maxSize);
          if (inlinedFont) {
            processedCSS = processedCSS.replace(match[0], inlinedFont);
          }
        } catch (error) {
          warnings.push(`Failed to inline font: ${fontUrl}`);
        }
      }
    }

    // Extract and inline image URLs
    if (options.inlineImages) {
      const imageMatches = css.matchAll(/url\(['"]?([^'")\s]+\.(png|jpg|jpeg|gif|svg|webp))['"]?\)/gi);
      
      for (const match of imageMatches) {
        const imageUrl = match[1];
        try {
          const inlinedImage = await this.inlineImage(imageUrl, options.maxSize);
          if (inlinedImage) {
            processedCSS = processedCSS.replace(match[0], `url(${inlinedImage})`);
          }
        } catch (error) {
          warnings.push(`Failed to inline image: ${imageUrl}`);
        }
      }
    }

    // Optimize CSS
    if (options.optimize) {
      processedCSS = this.optimizeCSS(processedCSS);
    }

    const optimizedSize = processedCSS.length;
    const optimizationRatio = originalSize > 0 ? optimizedSize / originalSize : 1;

    return {
      css: processedCSS,
      assets: [{
        type: 'css',
        name: 'bundled.css',
        size: optimizedSize,
        inlined: true,
        optimized: options.optimize
      }],
      warnings,
      optimizationRatio
    };
  }

  /**
   * Inline a font file
   */
  private async inlineFont(fontUrl: string, maxSize: number): Promise<string | null> {
    // Check cache first
    const cached = this.fontCache.get(fontUrl);
    if (cached) return cached;

    try {
      // In a real implementation, this would fetch the font file
      // For this example, we'll generate mock font data
      const fontData = this.generateMockFontData(fontUrl);
      
      if (fontData.length > maxSize) {
        return null; // Skip large fonts
      }

      // Convert to data URL
      const mimeType = this.getFontMimeType(fontUrl);
      const base64Data = btoa(fontData);
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      // Cache the result
      this.fontCache.set(fontUrl, dataUrl);

      return dataUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Inline an image file
   */
  private async inlineImage(imageUrl: string, maxSize: number): Promise<string | null> {
    // Check cache first
    const cached = this.imageCache.get(imageUrl);
    if (cached) return cached;

    try {
      // In a real implementation, this would fetch the image file
      // For this example, we'll generate mock image data
      const imageData = this.generateMockImageData(imageUrl);
      
      if (imageData.length > maxSize) {
        return null; // Skip large images
      }

      // Convert to data URL
      const mimeType = this.getImageMimeType(imageUrl);
      const base64Data = btoa(imageData);
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      // Cache the result
      this.imageCache.set(imageUrl, dataUrl);

      return dataUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect font information from CSS
   */
  private async collectFonts(css: string): Promise<Array<{ name: string; data: string; optimized: boolean }>> {
    const fonts: Array<{ name: string; data: string; optimized: boolean }> = [];
    const fontMatches = css.matchAll(/@font-face\s*{[^}]*font-family:\s*['"]?([^'";]+)['"]?[^}]*}/g);

    for (const match of fontMatches) {
      const fontFamily = match[1].trim();
      
      // Generate mock font data
      const fontData = this.generateMockFontData(`${fontFamily}.woff2`);
      const base64Data = btoa(fontData);

      fonts.push({
        name: fontFamily,
        data: `data:font/woff2;base64,${base64Data}`,
        optimized: true
      });
    }

    return fonts;
  }

  /**
   * Collect image information from CSS
   */
  private async collectImages(css: string): Promise<Array<{ name: string; data: string; type: string; optimized: boolean }>> {
    const images: Array<{ name: string; data: string; type: string; optimized: boolean }> = [];
    const imageMatches = css.matchAll(/url\(['"]?([^'")\s]+\.(png|jpg|jpeg|gif|svg|webp))['"]?\)/gi);

    for (const match of imageMatches) {
      const imageUrl = match[1];
      const extension = match[2].toLowerCase();
      
      // Generate mock image data
      const imageData = this.generateMockImageData(imageUrl);
      const mimeType = this.getImageMimeType(imageUrl);
      const base64Data = btoa(imageData);

      images.push({
        name: imageUrl.split('/').pop() || 'unknown',
        data: `data:${mimeType};base64,${base64Data}`,
        type: mimeType,
        optimized: true
      });
    }

    return images;
  }

  /**
   * Optimize CSS by removing unnecessary whitespace and comments
   */
  private optimizeCSS(css: string): string {
    return css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove unnecessary whitespace
      .replace(/\s+/g, ' ')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*,\s*/g, ',')
      // Remove empty rules
      .replace(/[^}]+{\s*}/g, '')
      // Remove trailing semicolons
      .replace(/;}/g, '}')
      .trim();
  }

  /**
   * Get MIME type for font files
   */
  private getFontMimeType(fontUrl: string): string {
    const extension = fontUrl.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'woff':
        return 'font/woff';
      case 'woff2':
        return 'font/woff2';
      case 'ttf':
        return 'font/ttf';
      case 'otf':
        return 'font/otf';
      case 'eot':
        return 'application/vnd.ms-fontobject';
      default:
        return 'font/woff2';
    }
  }

  /**
   * Get MIME type for image files
   */
  private getImageMimeType(imageUrl: string): string {
    const extension = imageUrl.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  /**
   * Generate mock font data for testing
   */
  private generateMockFontData(fontUrl: string): string {
    // Generate deterministic mock data based on font URL
    const seed = this.hashString(fontUrl);
    const size = 1024 + (seed % 2048); // 1-3KB mock font
    
    let data = '';
    for (let i = 0; i < size; i++) {
      data += String.fromCharCode(32 + ((seed + i) % 95));
    }
    
    return data;
  }

  /**
   * Generate mock image data for testing
   */
  private generateMockImageData(imageUrl: string): string {
    // Generate deterministic mock data based on image URL
    const seed = this.hashString(imageUrl);
    const size = 512 + (seed % 1024); // 0.5-1.5KB mock image
    
    let data = '';
    for (let i = 0; i < size; i++) {
      data += String.fromCharCode(32 + ((seed + i) % 95));
    }
    
    return data;
  }

  /**
   * Simple hash function for generating deterministic mock data
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if asset should be inlined based on size and type
   */
  private shouldInlineAsset(url: string, size: number, maxSize: number, type: 'font' | 'image'): boolean {
    // Don't inline if too large
    if (size > maxSize) return false;

    // Don't inline external URLs (different domain)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const urlObj = new URL(url);
        const currentDomain = window.location.hostname;
        if (urlObj.hostname !== currentDomain) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // Always inline small assets
    if (size < 1024) return true; // < 1KB

    // Type-specific rules
    if (type === 'font') {
      return size < 50 * 1024; // < 50KB for fonts
    } else if (type === 'image') {
      return size < 10 * 1024; // < 10KB for images
    }

    return true;
  }

  /**
   * Optimize image data (placeholder for actual image optimization)
   */
  private optimizeImageData(data: string, type: string): { data: string; optimized: boolean } {
    // In a real implementation, this would use image optimization libraries
    // For now, just return the original data
    return { data, optimized: false };
  }

  /**
   * Optimize font data (placeholder for actual font optimization)
   */
  private optimizeFontData(data: string, type: string): { data: string; optimized: boolean } {
    // In a real implementation, this would use font optimization libraries
    // For now, just return the original data
    return { data, optimized: false };
  }
}

/**
 * Utility functions for asset processing
 */
export const AssetUtils = {
  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio(originalSize: number, compressedSize: number): number {
    return originalSize > 0 ? compressedSize / originalSize : 1;
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
    return `${(bytes / 1073741824).toFixed(1)}GB`;
  },

  /**
   * Estimate load time based on file size
   */
  estimateLoadTime(bytes: number, connectionSpeed: 'slow' | 'fast' = 'fast'): number {
    // Rough estimates in milliseconds
    const speeds = {
      slow: 100 * 1024, // 100KB/s (slow mobile)
      fast: 1024 * 1024 // 1MB/s (fast broadband)
    };
    
    return (bytes / speeds[connectionSpeed]) * 1000;
  },

  /**
   * Check if URL is external
   */
  isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url, window.location.href);
      return urlObj.origin !== window.location.origin;
    } catch {
      return false;
    }
  },

  /**
   * Get file extension from URL
   */
  getFileExtension(url: string): string {
    const path = url.split('?')[0]; // Remove query parameters
    const extension = path.split('.').pop();
    return extension ? extension.toLowerCase() : '';
  },

  /**
   * Validate base64 data URL
   */
  isValidDataUrl(dataUrl: string): boolean {
    try {
      const [header, data] = dataUrl.split(',');
      if (!header.startsWith('data:') || !data) {
        return false;
      }
      
      // Try to decode base64
      atob(data);
      return true;
    } catch {
      return false;
    }
  }
};