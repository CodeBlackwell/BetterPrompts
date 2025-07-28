const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class WebhookServer {
  constructor(config) {
    this.config = {
      validateSignatures: true,
      simulateFailures: false,
      failureRate: 0,
      responseDelay: 0,
      logLevel: 'info',
      ...config,
    };

    this.app = express();
    this.deliveries = [];
    this.eventHandlers = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Raw body middleware for signature validation
    this.app.use(
      express.raw({
        type: 'application/json',
        verify: (req, res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );
  }

  setupRoutes() {
    // Webhook endpoint
    this.app.post('/webhook', async (req, res) => {
      const delivery = {
        id: uuidv4(),
        event: {},
        received_at: new Date(),
        headers: req.headers,
        valid_signature: false,
        response_sent: { status: 200 },
      };

      try {
        // Parse body
        const body = JSON.parse(req.rawBody || '{}');
        delivery.event = body;

        this.log('debug', 'Received webhook:', body);

        // Validate signature if configured
        if (this.config.validateSignatures && this.config.secret) {
          const signature = req.headers['x-webhook-signature'];
          delivery.valid_signature = this.validateSignature(
            req.rawBody,
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
        if (this.config.simulateFailures && Math.random() < this.config.failureRate) {
          this.log('info', 'Simulating webhook failure');
          delivery.response_sent = { status: 500, body: { error: 'Simulated failure' } };
          res.status(500).json({ error: 'Simulated failure' });
          this.deliveries.push(delivery);
          return;
        }

        // Process event with custom handler if registered
        const eventType = delivery.event.event;
        let responseData = { received: true };

        if (this.eventHandlers.has(eventType)) {
          const handler = this.eventHandlers.get(eventType);
          responseData = await handler(delivery.event);
        }

        // Send success response
        delivery.response_sent = { status: 200, body: responseData };
        res.status(200).json(responseData);
        this.deliveries.push(delivery);

        this.log('info', `Webhook processed successfully: ${eventType}`);
      } catch (error) {
        this.log('error', 'Webhook processing error:', error);
        delivery.response_sent = { status: 500, body: { error: error.message } };
        res.status(500).json({ error: error.message });
        this.deliveries.push(delivery);
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy', deliveries: this.deliveries.length });
    });

    // Get deliveries endpoint (for testing)
    this.app.get('/deliveries', (req, res) => {
      res.status(200).json(this.deliveries);
    });

    // Clear deliveries endpoint (for testing)
    this.app.post('/clear', (req, res) => {
      this.deliveries = [];
      res.status(200).json({ cleared: true });
    });
  }

  validateSignature(payload, signature, secret) {
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

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        this.log('info', `Webhook server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  async stop() {
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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  log(level, ...args) {
    if (
      (level === 'debug' && this.config.logLevel !== 'debug') ||
      (level === 'info' && this.config.logLevel === 'error')
    ) {
      return;
    }
    console.log(`[WebhookServer] [${level.toUpperCase()}]`, ...args);
  }
}

// Standalone server script
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

module.exports = { WebhookServer };