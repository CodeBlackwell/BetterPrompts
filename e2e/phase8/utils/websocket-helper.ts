import { Page } from '@playwright/test';

export interface WebSocketMessage {
  type: string;
  timestamp: string;
  data: any;
  channel?: string;
}

export class WebSocketHelper {
  private wsEndpoint: string;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private messageQueue: WebSocketMessage[] = [];

  constructor(private page: Page) {
    this.wsEndpoint = process.env.WS_URL || 'ws://localhost/ws';
    this.setupWebSocketInterception();
  }

  private setupWebSocketInterception() {
    // Inject WebSocket interceptor into the page
    this.page.evaluateHandle(() => {
      // Store original WebSocket
      const OriginalWebSocket = window.WebSocket;
      
      // Create custom WebSocket wrapper
      (window as any).WebSocket = class extends OriginalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          
          // Notify helper about new connection
          window.dispatchEvent(new CustomEvent('ws-connected', { 
            detail: { url: url.toString() } 
          }));
          
          // Intercept messages
          this.addEventListener('message', (event) => {
            window.dispatchEvent(new CustomEvent('ws-message', { 
              detail: { data: event.data } 
            }));
          });
          
          // Intercept connection events
          this.addEventListener('open', () => {
            window.dispatchEvent(new CustomEvent('ws-open'));
          });
          
          this.addEventListener('close', () => {
            window.dispatchEvent(new CustomEvent('ws-close'));
          });
          
          this.addEventListener('error', (error) => {
            window.dispatchEvent(new CustomEvent('ws-error', { detail: error }));
          });
        }
      };
    });

    // Listen for WebSocket events
    this.page.on('console', (message) => {
      if (message.type() === 'debug' && message.text().startsWith('WS:')) {
        console.log('WebSocket Debug:', message.text());
      }
    });

    // Set up event listeners
    this.page.exposeFunction('handleWebSocketMessage', (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.page.evaluate(() => {
      window.addEventListener('ws-message', async (event: any) => {
        await (window as any).handleWebSocketMessage(event.detail.data);
      });
    });
  }

  async waitForConnection(timeout: number = 10000): Promise<void> {
    await this.page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          window.removeEventListener('ws-open', handleOpen);
          resolve();
        };
        
        window.addEventListener('ws-open', handleOpen);
        
        // Timeout handler
        setTimeout(() => {
          window.removeEventListener('ws-open', handleOpen);
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
      });
    }, { timeout });
  }

  async subscribe(channels: string[]): Promise<void> {
    await this.page.evaluate((channels) => {
      const ws = (window as any).__activeWebSocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: channels
        }));
      }
    }, channels);
  }

  async unsubscribe(channels: string[]): Promise<void> {
    await this.page.evaluate((channels) => {
      const ws = (window as any).__activeWebSocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          channels: channels
        }));
      }
    }, channels);
  }

  async waitForUpdate(timeout: number = 10000): Promise<WebSocketMessage> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        return this.messageQueue.shift()!;
      }
      await this.page.waitForTimeout(100);
    }
    
    throw new Error('Timeout waiting for WebSocket update');
  }

  async waitForMessage(
    predicate: (message: WebSocketMessage) => boolean,
    timeout: number = 10000
  ): Promise<WebSocketMessage> {
    const startTime = Date.now();
    
    // Check existing messages
    const existingMessage = this.messageQueue.find(predicate);
    if (existingMessage) {
      this.messageQueue = this.messageQueue.filter(m => m !== existingMessage);
      return existingMessage;
    }
    
    // Wait for new message
    return new Promise((resolve, reject) => {
      const handler = (message: WebSocketMessage) => {
        if (predicate(message)) {
          this.messageHandlers.delete('waitForMessage');
          resolve(message);
        }
      };
      
      this.messageHandlers.set('waitForMessage', handler);
      
      setTimeout(() => {
        this.messageHandlers.delete('waitForMessage');
        reject(new Error('Timeout waiting for specific WebSocket message'));
      }, timeout);
    });
  }

  async sendMessage(message: any): Promise<void> {
    await this.page.evaluate((msg) => {
      const ws = (window as any).__activeWebSocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }, message);
  }

  async disconnect(): Promise<void> {
    await this.page.evaluate(() => {
      const ws = (window as any).__activeWebSocket;
      if (ws) {
        ws.close();
        delete (window as any).__activeWebSocket;
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    // Add to queue
    this.messageQueue.push(message);
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
    
    // Call registered handlers
    this.messageHandlers.forEach(handler => handler(message));
  }

  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    const id = `handler-${Date.now()}-${Math.random()}`;
    this.messageHandlers.set(id, handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(id);
    };
  }

  getMessageHistory(): WebSocketMessage[] {
    return [...this.messageQueue];
  }

  clearMessageHistory(): void {
    this.messageQueue = [];
  }
}