import { Page, Locator } from '@playwright/test';

/**
 * Touch gesture types
 */
export type GestureType = 'tap' | 'swipe' | 'pinch' | 'long_press' | 'double_tap';

export interface SwipeOptions {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration?: number;
  steps?: number;
}

export interface PinchOptions {
  centerX: number;
  centerY: number;
  scale: number;
  duration?: number;
}

/**
 * Touch target validation requirements
 */
export const TOUCH_TARGET_REQUIREMENTS = {
  minimumSize: 44, // 44x44px minimum for accessibility
  minimumSpacing: 8, // 8px minimum spacing between targets
  recommendedSize: 48 // 48x48px recommended
};

/**
 * Helper class for simulating touch gestures and interactions
 */
export class TouchGestureSimulator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Simulate a tap gesture
   */
  async tap(selector: string | Locator): Promise<void> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await element.tap();
    console.log(`👆 Tapped on element`);
  }

  /**
   * Simulate a double tap gesture
   */
  async doubleTap(selector: string | Locator): Promise<void> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await element.tap();
    await this.page.waitForTimeout(100);
    await element.tap();
    console.log(`👆👆 Double tapped on element`);
  }

  /**
   * Simulate a long press gesture
   */
  async longPress(selector: string | Locator, duration: number = 1000): Promise<void> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    // Get element position
    const box = await element.boundingBox();
    if (!box) throw new Error('Element not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Simulate long press
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.waitForTimeout(duration);
    await this.page.mouse.up();
    
    console.log(`👆⏱️ Long pressed for ${duration}ms`);
  }

  /**
   * Simulate a swipe gesture
   */
  async swipe(options: SwipeOptions): Promise<void> {
    const {
      startX,
      startY,
      endX,
      endY,
      duration = 500,
      steps = 10
    } = options;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();

    // Animate swipe
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;
      await this.page.mouse.move(x, y);
      await this.page.waitForTimeout(duration / steps);
    }

    await this.page.mouse.up();
    
    const direction = this.getSwipeDirection(startX, startY, endX, endY);
    console.log(`👆➡️ Swiped ${direction}`);
  }

  /**
   * Simulate a swipe on an element
   */
  async swipeElement(
    selector: string | Locator, 
    direction: 'left' | 'right' | 'up' | 'down',
    distance: number = 100
  ): Promise<void> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    const box = await element.boundingBox();
    if (!box) throw new Error('Element not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case 'left':
        endX = centerX - distance;
        break;
      case 'right':
        endX = centerX + distance;
        break;
      case 'up':
        endY = centerY - distance;
        break;
      case 'down':
        endY = centerY + distance;
        break;
    }

    await this.swipe({
      startX: centerX,
      startY: centerY,
      endX,
      endY
    });
  }

  /**
   * Simulate a pinch gesture (zoom in/out)
   */
  async pinch(options: PinchOptions): Promise<void> {
    const { centerX, centerY, scale, duration = 500 } = options;
    
    // Calculate touch points
    const initialDistance = 100;
    const finalDistance = initialDistance * scale;
    
    console.log(`🤏 Pinch ${scale > 1 ? 'zoom in' : 'zoom out'} at (${centerX}, ${centerY})`);
    
    // This is a simplified simulation
    // Real pinch would require multi-touch which Playwright doesn't fully support
    await this.page.evaluate(({ x, y, s }) => {
      const event = new WheelEvent('wheel', {
        deltaY: s > 1 ? -100 : 100,
          ctrlKey: true,
          clientX: x,
          clientY: y
      });
      document.dispatchEvent(event);
    }, { x: centerX, y: centerY, s: scale });
  }

  /**
   * Check if element meets touch target size requirements
   */
  async checkTouchTargetSize(selector: string | Locator): Promise<{
    width: number;
    height: number;
    meetsMinimum: boolean;
    meetsRecommended: boolean;
  }> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    const box = await element.boundingBox();
    
    if (!box) {
      return {
        width: 0,
        height: 0,
        meetsMinimum: false,
        meetsRecommended: false
      };
    }

    return {
      width: box.width,
      height: box.height,
      meetsMinimum: box.width >= TOUCH_TARGET_REQUIREMENTS.minimumSize && 
                    box.height >= TOUCH_TARGET_REQUIREMENTS.minimumSize,
      meetsRecommended: box.width >= TOUCH_TARGET_REQUIREMENTS.recommendedSize && 
                        box.height >= TOUCH_TARGET_REQUIREMENTS.recommendedSize
    };
  }

  /**
   * Check spacing between touch targets
   */
  async checkTouchTargetSpacing(selector1: string, selector2: string): Promise<{
    distance: number;
    meetsRequirement: boolean;
  }> {
    const element1 = this.page.locator(selector1);
    const element2 = this.page.locator(selector2);
    
    const box1 = await element1.boundingBox();
    const box2 = await element2.boundingBox();
    
    if (!box1 || !box2) {
      return {
        distance: 0,
        meetsRequirement: false
      };
    }

    // Calculate minimum distance between elements
    const horizontalDistance = Math.max(0, 
      Math.max(box1.x, box2.x) - Math.min(box1.x + box1.width, box2.x + box2.width)
    );
    const verticalDistance = Math.max(0, 
      Math.max(box1.y, box2.y) - Math.min(box1.y + box1.height, box2.y + box2.height)
    );
    
    const distance = Math.min(horizontalDistance, verticalDistance);
    
    return {
      distance,
      meetsRequirement: distance >= TOUCH_TARGET_REQUIREMENTS.minimumSpacing
    };
  }

  /**
   * Test scroll behavior on touch devices
   */
  async testTouchScroll(direction: 'vertical' | 'horizontal' = 'vertical'): Promise<void> {
    const viewport = this.page.viewportSize();
    if (!viewport) return;

    const startX = viewport.width / 2;
    const startY = viewport.height / 2;
    const distance = 200;

    if (direction === 'vertical') {
      await this.swipe({
        startX,
        startY,
        endX: startX,
        endY: startY - distance,
        duration: 300
      });
    } else {
      await this.swipe({
        startX,
        startY,
        endX: startX - distance,
        endY: startY,
        duration: 300
      });
    }
  }

  /**
   * Test if element responds to touch events
   */
  async testTouchResponsiveness(selector: string): Promise<{
    hasTouchHandlers: boolean;
    hasClickHandlers: boolean;
    respondsToTap: boolean;
  }> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return {
        hasTouchHandlers: false,
        hasClickHandlers: false,
        respondsToTap: false
      };

      // Check for touch event listeners
      const touchEvents = ['touchstart', 'touchend', 'touchmove'];
      const clickEvents = ['click', 'mousedown', 'mouseup'];
      
      let hasTouchHandlers = false;
      let hasClickHandlers = false;
      
      // This is a simplified check - real implementation would need to check event listeners
      const computedStyle = window.getComputedStyle(element);
      const isTappable = computedStyle.cursor === 'pointer' || 
                        element.tagName === 'BUTTON' || 
                        element.tagName === 'A' ||
                        element.getAttribute('role') === 'button';

      return {
        hasTouchHandlers: isTappable, // Simplified
        hasClickHandlers: isTappable,
        respondsToTap: isTappable
      };
    }, selector);
  }

  /**
   * Simulate device rotation
   */
  async rotateDevice(): Promise<void> {
    const viewport = this.page.viewportSize();
    if (!viewport) return;

    // Swap width and height to simulate rotation
    await this.page.setViewportSize({
      width: viewport.height,
      height: viewport.width
    });

    console.log(`📱🔄 Device rotated to ${viewport.height}x${viewport.width}`);
  }

  /**
   * Get swipe direction from coordinates
   */
  private getSwipeDirection(startX: number, startY: number, endX: number, endY: number): string {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  /**
   * Test all touch targets on the page
   */
  async validateAllTouchTargets(selector: string = 'button, a, input, [role="button"]'): Promise<{
    total: number;
    valid: number;
    invalid: string[];
  }> {
    const elements = await this.page.locator(selector).all();
    const results = {
      total: elements.length,
      valid: 0,
      invalid: [] as string[]
    };

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const sizeCheck = await this.checkTouchTargetSize(element);
      
      if (sizeCheck.meetsMinimum) {
        results.valid++;
      } else {
        const text = await element.textContent() || `Element ${i}`;
        results.invalid.push(`${text} (${sizeCheck.width}x${sizeCheck.height}px)`);
      }
    }

    return results;
  }
}

/**
 * Create touch gesture simulator instance
 */
export function createTouchGestureSimulator(page: Page): TouchGestureSimulator {
  return new TouchGestureSimulator(page);
}