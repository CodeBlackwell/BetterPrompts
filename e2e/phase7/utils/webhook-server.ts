import express, { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: any;
  signature?: string;
  delivery_attempt: number;
}

export interface WebhookDelivery {
  id: string;
  event: WebhookEvent;
  received_at: Date;
  headers: Record<string, string>;
  valid_signature: boolean;
  response_sent: {
    status: number;
    body?: any;
  };
}

export interface WebhookServerConfig {
  port: number;
  secret?: string;
  validateSignatures?: boolean;
  simulateFailures?: boolean;
  failureRate?: number;
  responseDelay?: number;
  logLevel?: 'debug' | 'info' | 'error';
}

export class WebhookServer {
  private app: Express;
  private server: any;
  private config: WebhookServerConfig;
  private deliveries: WebhookDelivery[] = [];
  private eventHandlers: Map<string, (event: WebhookEvent) => any> = new Map();

  constructor(config: WebhookServerConfig) {
    this.config = {
      validateSignatures: true,
      simulateFailures: false,
      failureRate: 0,
      responseDelay: 0,
      logLevel: 'info',
      ...config,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Raw body middleware for signature validation
    this.app.use(
      express.raw({
        type: 'application/json',
        verify: (req: any, res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );
  }

  private setupRoutes(): void {
    // Webhook endpoint
    this.app.post('/webhook', async (req: Request, res: Response) => {
      const delivery: WebhookDelivery = {
        id: uuidv4(),
        event: {} as WebhookEvent,
        received_at: new Date(),
        headers: req.headers as Record<string, string>,
        valid_signature: false,
        response_sent: { status: 200 },
      };

      try {
        // Parse body
        const body = JSON.parse((req as any).rawBody || '{}');
        delivery.event = body;

        this.log('debug', 'Received webhook:', body);

        // Validate signature if configured
        if (this.config.validateSignatures && this.config.secret) {
          const signature = req.headers['x-webhook-signature'] as string;
          delivery.valid_signature = this.validateSignature(
            (req as any).rawBody,
            signature,
            this.config.secret
          );

          if (!delivery.valid_signature) {
            this.log('error', 'Invalid webhook signature');
            delivery.response_sent = { status: 401, body: { error: 'Invalid signature' } };
            res.status(401).json({ error: 'Invalid signature' });
            this.deliveries.push(delivery);
            return;
          }
        } else {
          delivery.valid_signature = true;
        }

        // Simulate response delay if configured
        if (this.config.responseDelay) {
          await this.delay(this.config.responseDelay);
        }

        // Simulate failures if configured
        if (this.config.simulateFailures && Math.random() < this.config.failureRate!) {
          this.log('info', 'Simulating webhook failure');
          delivery.response_sent = { status: 500, body: { error: 'Simulated failure' } };
          res.status(500).json({ error: 'Simulated failure' });
          this.deliveries.push(delivery);
          return;
        }

        // Process event with custom handler if registered
        const eventType = delivery.event.event;
        let responseData: any = { received: true };

        if (this.eventHandlers.has(eventType)) {
          const handler = this.eventHandlers.get(eventType)!;
          responseData = await handler(delivery.event);
        }

        // Send success response
        delivery.response_sent = { status: 200, body: responseData };
        res.status(200).json(responseData);
        this.deliveries.push(delivery);

        this.log('info', `Webhook processed successfully: ${eventType}`);
      } catch (error: any) {
        this.log('error', 'Webhook processing error:', error);
        delivery.response_sent = { status: 500, body: { error: error.message } };
        res.status(500).json({ error: error.message });
        this.deliveries.push(delivery);
      }
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'healthy', deliveries: this.deliveries.length });
    });

    // Get deliveries endpoint (for testing)
    this.app.get('/deliveries', (req: Request, res: Response) => {
      res.status(200).json(this.deliveries);
    });

    // Clear deliveries endpoint (for testing)
    this.app.post('/clear', (req: Request, res: Response) => {
      this.deliveries = [];
      res.status(200).json({ cleared: true });
    });
  }

  /**
   * Validate webhook signature using HMAC-SHA256
   */
  private validateSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  }

  /**
   * Register a custom event handler
   */
  onEvent(eventType: string, handler: (event: WebhookEvent) => any): void {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        this.log('info', `Webhook server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.log('info', 'Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get all received deliveries
   */
  getDeliveries(): WebhookDelivery[] {
    return this.deliveries;
  }

  /**
   * Get deliveries by event type
   */
  getDeliveriesByEvent(eventType: string): WebhookDelivery[] {
    return this.deliveries.filter((d) => d.event.event === eventType);
  }

  /**
   * Wait for a specific number of deliveries
   */
  async waitForDeliveries(count: number, timeout: number = 10000): Promise<WebhookDelivery[]> {
    const startTime = Date.now();

    while (this.deliveries.length < count) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for ${count} deliveries (got ${this.deliveries.length})`);
      }
      await this.delay(100);
    }

    return this.deliveries.slice(0, count);
  }

  /**
   * Wait for a specific event type
   */
  async waitForEvent(eventType: string, timeout: number = 10000): Promise<WebhookDelivery> {
    const startTime = Date.now();

    while (true) {
      const delivery = this.deliveries.find((d) => d.event.event === eventType);
      if (delivery) return delivery;

      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for event: ${eventType}`);
      }
      await this.delay(100);
    }
  }

  /**
   * Clear all deliveries
   */
  clearDeliveries(): void {
    this.deliveries = [];
  }

  /**
   * Set failure simulation
   */
  setFailureSimulation(enabled: boolean, rate: number = 0.1): void {
    this.config.simulateFailures = enabled;
    this.config.failureRate = rate;
  }

  /**
   * Set response delay
   */
  setResponseDelay(delay: number): void {
    this.config.responseDelay = delay;
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `http://localhost:${this.config.port}/webhook`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(level: string, ...args: any[]): void {
    if (
      level === 'debug' && this.config.logLevel !== 'debug' ||
      level === 'info' && this.config.logLevel === 'error'
    ) {
      return;
    }
    console.log(`[WebhookServer] [${level.toUpperCase()}]`, ...args);
  }
}

// Standalone server script (for use with playwright.config.ts)
if (require.main === module) {
  const port = parseInt(process.env.WEBHOOK_PORT || '8888');
  const secret = process.env.WEBHOOK_SECRET || 'test-secret';

  const server = new WebhookServer({
    port,
    secret,
    validateSignatures: true,
    logLevel: 'info',
  });

  server.start().then(() => {
    console.log(`Webhook mock server running on port ${port}`);
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      await server.stop();
      process.exit(0);
    });
  });
}