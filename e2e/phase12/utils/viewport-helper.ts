import { Page, BrowserContext } from '@playwright/test';

/**
 * Viewport configurations for different devices
 */
export const VIEWPORTS = {
  mobile_small: { 
    width: 320, 
    height: 568, 
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    name: 'iPhone SE' 
  },
  mobile_medium: { 
    width: 375, 
    height: 667, 
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    name: 'iPhone 8' 
  },
  mobile_large: { 
    width: 414, 
    height: 896, 
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    name: 'iPhone 11 Pro' 
  },
  tablet: { 
    width: 768, 
    height: 1024, 
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    name: 'iPad' 
  },
  desktop: { 
    width: 1920, 
    height: 1080, 
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    name: 'Desktop' 
  }
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * Responsive breakpoints
 */
export const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  ultrawide: 1920
} as const;

/**
 * Helper class for viewport management and responsive testing
 */
export class ViewportHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set viewport to a predefined device configuration
   */
  async setViewport(viewport: ViewportName): Promise<void> {
    const config = VIEWPORTS[viewport];
    await this.page.setViewportSize({ 
      width: config.width, 
      height: config.height 
    });
    
    // Log viewport change
    console.log(`📱 Viewport set to ${config.name} (${config.width}x${config.height})`);
  }

  /**
   * Set custom viewport size
   */
  async setCustomViewport(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    console.log(`📐 Custom viewport set to ${width}x${height}`);
  }

  /**
   * Test viewport orientation change
   */
  async rotateViewport(): Promise<void> {
    const currentSize = this.page.viewportSize();
    if (!currentSize) return;

    // Swap width and height
    await this.page.setViewportSize({
      width: currentSize.height,
      height: currentSize.width
    });
    
    console.log(`🔄 Viewport rotated to ${currentSize.height}x${currentSize.width}`);
  }

  /**
   * Get current viewport size
   */
  async getCurrentViewport(): Promise<{ width: number; height: number } | null> {
    return this.page.viewportSize();
  }

  /**
   * Check if element is visible in current viewport
   */
  async isElementInViewport(selector: string): Promise<boolean> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }, selector);
  }

  /**
   * Check responsive behavior at different breakpoints
   */
  async testResponsiveBreakpoints(callback: (breakpoint: string) => Promise<void>): Promise<void> {
    const viewportConfigs = [
      { name: 'mobile', viewport: 'mobile_small' as ViewportName },
      { name: 'tablet', viewport: 'tablet' as ViewportName },
      { name: 'desktop', viewport: 'desktop' as ViewportName }
    ];

    for (const config of viewportConfigs) {
      await this.setViewport(config.viewport);
      await this.page.waitForTimeout(500); // Allow time for responsive adjustments
      await callback(config.name);
    }
  }

  /**
   * Check if current viewport is mobile
   */
  async isMobileViewport(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    if (!viewport) return false;
    return viewport.width < BREAKPOINTS.tablet;
  }

  /**
   * Check if current viewport is tablet
   */
  async isTabletViewport(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    if (!viewport) return false;
    return viewport.width >= BREAKPOINTS.tablet && viewport.width < BREAKPOINTS.desktop;
  }

  /**
   * Check if current viewport is desktop
   */
  async isDesktopViewport(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    if (!viewport) return false;
    return viewport.width >= BREAKPOINTS.desktop;
  }

  /**
   * Emulate device with specific user agent
   */
  async emulateDevice(deviceName: ViewportName): Promise<void> {
    const userAgents = {
      mobile_small: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15',
      mobile_medium: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15',
      mobile_large: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15',
      tablet: 'Mozilla/5.0 (iPad; CPU OS 13_3 like Mac OS X) AppleWebKit/605.1.15',
      desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const config = VIEWPORTS[deviceName];
    const userAgent = userAgents[deviceName];

    // Set viewport
    await this.setViewport(deviceName);

    // Set user agent
    await this.page.setExtraHTTPHeaders({
      'User-Agent': userAgent
    });

    console.log(`📱 Emulating ${config.name} device`);
  }

  /**
   * Test element responsiveness across viewports
   */
  async testElementResponsiveness(selector: string): Promise<{
    [key: string]: {
      visible: boolean;
      dimensions: { width: number; height: number };
      position: { x: number; y: number };
    }
  }> {
    const results: any = {};

    for (const [name, config] of Object.entries(VIEWPORTS)) {
      await this.setViewport(name as ViewportName);
      await this.page.waitForTimeout(500);

      const elementInfo = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        return {
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          dimensions: {
            width: rect.width,
            height: rect.height
          },
          position: {
            x: rect.left,
            y: rect.top
          }
        };
      }, selector);

      results[name] = elementInfo || {
        visible: false,
        dimensions: { width: 0, height: 0 },
        position: { x: 0, y: 0 }
      };
    }

    return results;
  }

  /**
   * Check if page has proper viewport meta tag
   */
  async hasProperViewportMetaTag(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) return false;

      const content = viewportMeta.getAttribute('content');
      return content !== null && 
             content.includes('width=device-width') && 
             content.includes('initial-scale=1');
    });
  }

  /**
   * Test zoom prevention on input focus (iOS)
   */
  async testInputZoomPrevention(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      let allInputsProperlyStyled = true;

      inputs.forEach(input => {
        const styles = window.getComputedStyle(input);
        const fontSize = parseFloat(styles.fontSize);
        if (fontSize < 16) {
          allInputsProperlyStyled = false;
        }
      });

      return allInputsProperlyStyled;
    });
  }
}

/**
 * Create viewport helper instance
 */
export function createViewportHelper(page: Page): ViewportHelper {
  return new ViewportHelper(page);
}

/**
 * Test all viewports helper function
 */
export async function testAllViewports(
  page: Page, 
  testFn: (viewport: ViewportName) => Promise<void>
): Promise<void> {
  const helper = new ViewportHelper(page);
  
  for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
    await helper.setViewport(viewport);
    await testFn(viewport);
  }
}