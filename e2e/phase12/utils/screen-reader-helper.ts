import { Page, Locator } from '@playwright/test';

/**
 * Screen reader types
 */
export type ScreenReaderType = 'NVDA' | 'JAWS' | 'VoiceOver' | 'TalkBack';

/**
 * Announcement priority levels
 */
export type AnnouncementPriority = 'polite' | 'assertive' | 'off';

/**
 * Screen reader navigation modes
 */
export type NavigationMode = 'browse' | 'focus' | 'forms' | 'tables';

/**
 * Helper class for screen reader testing and simulation
 */
export class ScreenReaderHelper {
  private page: Page;
  private announcements: string[] = [];

  constructor(page: Page) {
    this.page = page;
    this.setupAnnouncementCapture();
  }

  /**
   * Setup announcement capture for live regions
   */
  private async setupAnnouncementCapture(): Promise<void> {
    await this.page.evaluate(() => {
      // Monitor aria-live regions
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('aria-live') || 
              target.getAttribute('role') === 'alert' ||
              target.getAttribute('role') === 'status') {
            // Store announcements in window object for retrieval
            (window as any).__screenReaderAnnouncements = 
              (window as any).__screenReaderAnnouncements || [];
            (window as any).__screenReaderAnnouncements.push({
              text: target.textContent,
              time: Date.now(),
              priority: target.getAttribute('aria-live') || 'polite'
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });
  }

  /**
   * Get the accessible name of an element
   */
  async getAccessibleName(selector: string | Locator): Promise<string> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    return await element.evaluate((el) => {
      // Check aria-label first
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      // Check aria-labelledby
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement) return labelElement.textContent || '';
      }

      // Check for associated label
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent || '';
      }

      // Check for nested label
      const parentLabel = el.closest('label');
      if (parentLabel) return parentLabel.textContent || '';

      // Check alt text for images
      if (el.tagName === 'IMG') {
        return el.getAttribute('alt') || '';
      }

      // Default to text content
      return el.textContent || '';
    });
  }

  /**
   * Get the accessible description of an element
   */
  async getAccessibleDescription(selector: string | Locator): Promise<string> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    return await element.evaluate((el) => {
      // Check aria-describedby
      const describedBy = el.getAttribute('aria-describedby');
      if (describedBy) {
        const descElement = document.getElementById(describedBy);
        if (descElement) return descElement.textContent || '';
      }

      // Check title attribute
      return el.getAttribute('title') || '';
    });
  }

  /**
   * Get the role of an element
   */
  async getRole(selector: string | Locator): Promise<string> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    return await element.evaluate((el) => {
      // Check explicit role
      const explicitRole = el.getAttribute('role');
      if (explicitRole) return explicitRole;

      // Return implicit role based on element type
      const tagName = el.tagName.toLowerCase();
      const implicitRoles: { [key: string]: string } = {
        'a': 'link',
        'button': 'button',
        'nav': 'navigation',
        'main': 'main',
        'header': 'banner',
        'footer': 'contentinfo',
        'aside': 'complementary',
        'article': 'article',
        'section': 'region',
        'form': 'form',
        'img': 'img',
        'ul': 'list',
        'ol': 'list',
        'li': 'listitem',
        'table': 'table',
        'h1': 'heading',
        'h2': 'heading',
        'h3': 'heading',
        'h4': 'heading',
        'h5': 'heading',
        'h6': 'heading'
      };

      return implicitRoles[tagName] || 'generic';
    });
  }

  /**
   * Navigate to next element using screen reader commands
   */
  async navigateToNext(elementType: 'heading' | 'link' | 'button' | 'form' | 'landmark'): Promise<void> {
    const shortcuts: { [key: string]: string } = {
      heading: 'h',
      link: 'k',
      button: 'b',
      form: 'f',
      landmark: 'd'
    };

    await this.page.keyboard.press(shortcuts[elementType] || 'Tab');
    console.log(`🔊 Navigated to next ${elementType}`);
  }

  /**
   * Get all headings in reading order
   */
  async getHeadingStructure(): Promise<Array<{
    level: number;
    text: string;
    id?: string;
  }>> {
    return await this.page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headings.map(heading => ({
        level: parseInt(heading.tagName.substring(1)),
        text: heading.textContent?.trim() || '',
        id: heading.id || undefined
      }));
    });
  }

  /**
   * Get all landmarks
   */
  async getLandmarks(): Promise<Array<{
    role: string;
    label?: string;
    text: string;
  }>> {
    return await this.page.evaluate(() => {
      const landmarkRoles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'form', 'region'];
      const landmarkElements = [
        ...Array.from(document.querySelectorAll('[role]')).filter(el => 
          landmarkRoles.includes(el.getAttribute('role') || '')
        ),
        ...Array.from(document.querySelectorAll('main, nav, header, footer, aside, form'))
      ];

      return landmarkElements.map(el => ({
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || undefined,
        text: (el.textContent?.substring(0, 50) || '') + '...'
      }));
    });
  }

  /**
   * Test form field announcements
   */
  async getFormFieldAnnouncement(selector: string): Promise<{
    label: string;
    type: string;
    required: boolean;
    description?: string;
    errorMessage?: string;
    value?: string;
  }> {
    return await this.page.evaluate((sel) => {
      const field = document.querySelector(sel) as HTMLInputElement;
      if (!field) {
        return {
          label: '',
          type: '',
          required: false
        };
      }

      // Get label
      let label = '';
      if (field.getAttribute('aria-label')) {
        label = field.getAttribute('aria-label') || '';
      } else if (field.getAttribute('aria-labelledby')) {
        const labelEl = document.getElementById(field.getAttribute('aria-labelledby') || '');
        label = labelEl?.textContent || '';
      } else if (field.id) {
        const labelEl = document.querySelector(`label[for="${field.id}"]`);
        label = labelEl?.textContent || '';
      }

      // Get description
      let description = '';
      if (field.getAttribute('aria-describedby')) {
        const descEl = document.getElementById(field.getAttribute('aria-describedby') || '');
        description = descEl?.textContent || '';
      }

      // Get error message
      let errorMessage = '';
      if (field.getAttribute('aria-invalid') === 'true' && field.getAttribute('aria-describedby')) {
        const errorEl = document.getElementById(field.getAttribute('aria-describedby') || '');
        if (errorEl && (errorEl.getAttribute('role') === 'alert' || errorEl.classList.contains('error'))) {
          errorMessage = errorEl.textContent || '';
        }
      }

      return {
        label,
        type: field.type || field.tagName.toLowerCase(),
        required: field.required || field.getAttribute('aria-required') === 'true',
        description: description || undefined,
        errorMessage: errorMessage || undefined,
        value: field.value || undefined
      };
    }, selector);
  }

  /**
   * Get live region announcements
   */
  async getLiveAnnouncements(): Promise<Array<{
    text: string;
    time: number;
    priority: string;
  }>> {
    const announcements = await this.page.evaluate(() => {
      return (window as any).__screenReaderAnnouncements || [];
    });

    return announcements;
  }

  /**
   * Clear captured announcements
   */
  async clearAnnouncements(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__screenReaderAnnouncements = [];
    });
  }

  /**
   * Test reading order
   */
  async getReadingOrder(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const elements: string[] = [];
      
      // Function to traverse DOM in reading order
      function traverse(node: Node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          // Skip hidden elements
          const styles = window.getComputedStyle(element);
          if (styles.display === 'none' || styles.visibility === 'hidden') {
            return;
          }

          // Get accessible text
          const text = element.getAttribute('aria-label') || 
                      element.textContent?.trim() || 
                      element.getAttribute('alt') || '';

          if (text && text.length > 0) {
            const role = element.getAttribute('role') || element.tagName.toLowerCase();
            elements.push(`${role}: ${text.substring(0, 50)}`);
          }
        }

        // Traverse children
        for (const child of Array.from(node.childNodes)) {
          traverse(child);
        }
      }

      traverse(document.body);
      return elements;
    });
  }

  /**
   * Test focus announcement
   */
  async getFocusAnnouncement(selector: string): Promise<string> {
    const element = this.page.locator(selector);
    await element.focus();

    const name = await this.getAccessibleName(element);
    const role = await this.getRole(element);
    const description = await this.getAccessibleDescription(element);

    let announcement = `${name} ${role}`;
    if (description) {
      announcement += `, ${description}`;
    }

    return announcement;
  }

  /**
   * Test table navigation
   */
  async getTableStructure(tableSelector: string): Promise<{
    caption?: string;
    headers: string[];
    rows: number;
    columns: number;
    cellData: string[][];
  }> {
    return await this.page.evaluate((selector) => {
      const table = document.querySelector(selector);
      if (!table || table.tagName !== 'TABLE') {
        return {
          headers: [],
          rows: 0,
          columns: 0,
          cellData: []
        };
      }

      const caption = table.querySelector('caption')?.textContent || undefined;
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent || '');
      const rows = table.querySelectorAll('tr').length;
      const columns = table.querySelector('tr')?.querySelectorAll('td, th').length || 0;
      
      const cellData: string[][] = [];
      table.querySelectorAll('tr').forEach(row => {
        const rowData = Array.from(row.querySelectorAll('td, th')).map(cell => 
          cell.textContent?.trim() || ''
        );
        if (rowData.length > 0) {
          cellData.push(rowData);
        }
      });

      return {
        caption,
        headers,
        rows,
        columns,
        cellData
      };
    }, tableSelector);
  }

  /**
   * Simulate screen reader announcement
   */
  async simulateAnnouncement(text: string, priority: AnnouncementPriority = 'polite'): Promise<void> {
    await this.page.evaluate(({ txt, pri }) => {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', pri);
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      
      document.body.appendChild(announcement);
      announcement.textContent = txt;
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }, { txt: text, pri: priority });

    console.log(`🔊 Announcement (${priority}): ${text}`);
  }

  /**
   * Generate screen reader test report
   */
  async generateScreenReaderReport(): Promise<string> {
    const headings = await this.getHeadingStructure();
    const landmarks = await this.getLandmarks();
    const announcements = await this.getLiveAnnouncements();

    const report = `
# Screen Reader Test Report

## Document Structure

### Headings (${headings.length})
${headings.map(h => `${'  '.repeat(h.level - 1)}- H${h.level}: ${h.text}`).join('\n')}

### Landmarks (${landmarks.length})
${landmarks.map(l => `- ${l.role}: ${l.label || 'Unlabeled'}`).join('\n')}

## Live Region Announcements (${announcements.length})
${announcements.map(a => `- [${a.priority}] ${a.text}`).join('\n')}

## Recommendations
${headings.length === 0 ? '- Add heading structure for better navigation\n' : ''}
${landmarks.filter(l => l.role === 'main').length === 0 ? '- Add main landmark\n' : ''}
${landmarks.filter(l => !l.label && l.role === 'region').length > 0 ? '- Label all regions\n' : ''}
`;

    return report;
  }
}

/**
 * Create screen reader helper instance
 */
export function createScreenReaderHelper(page: Page): ScreenReaderHelper {
  return new ScreenReaderHelper(page);
}