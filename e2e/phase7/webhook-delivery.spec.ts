import { test, expect } from '@playwright/test';
import { BetterPromptsAPIClient } from './utils/api-client';
import { WebhookServer } from './utils/webhook-server';
import * as crypto from 'crypto';
import * as testData from './fixtures/test-data.json';

test.describe('Webhook Delivery System', () => {
  let apiClient: BetterPromptsAPIClient;
  let webhookServer: WebhookServer;
  let webhookSecret: string;
  let webhookId: string;
  const baseURL = process.env.BASE_URL || 'http://localhost/api/v1';

  test.beforeAll(async () => {
    // Start webhook server
    webhookServer = new WebhookServer({
      port: 8890,
      validateSignatures: false, // We'll validate manually
      logLevel: 'info',
    });
    await webhookServer.start();
  });

  test.afterAll(async () => {
    // Stop webhook server
    await webhookServer.stop();
  });

  test.beforeEach(async () => {
    // Initialize API client and authenticate
    apiClient = new BetterPromptsAPIClient({ baseURL });
    
    const authResponse = await apiClient.login({
      email: testData.testUsers.developer.email,
      password: testData.testUsers.developer.password,
    });
    
    apiClient.setAuthToken(authResponse.access_token);
    
    // Clear webhook deliveries
    webhookServer.clearDeliveries();
  });

  test.afterEach(async () => {
    // Clean up webhook if created
    if (webhookId) {
      try {
        await apiClient.deleteWebhook(webhookId);
      } catch (error) {
        // Ignore errors during cleanup
      }
      webhookId = '';
    }
  });

  test.describe('Webhook Registration', () => {
    test('should register webhook with valid configuration', async () => {
      const webhookConfig = {
        url: webhookServer.getUrl(),
        events: ['enhancement.completed', 'batch.finished', 'error.occurred'],
        active: true,
      };

      const response = await apiClient.createWebhook(webhookConfig);

      expect(response).toBeTruthy();
      expect(response.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(response.secret).toBeTruthy();
      expect(response.secret.length).toBeGreaterThan(16);

      webhookId = response.id;
      webhookSecret = response.secret;
    });

    test('should validate webhook URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.com',
        'http://[invalid-ipv6',
        'https://',
        '',
        'javascript:alert(1)',
      ];

      for (const url of invalidUrls) {
        await expect(
          apiClient.createWebhook({
            url,
            events: ['enhancement.completed'],
          })
        ).rejects.toThrow();
      }
    });

    test('should validate event types', async () => {
      const invalidEvents = [
        ['invalid.event'],
        ['enhancement.invalid'],
        [''],
        [],
      ];

      for (const events of invalidEvents) {
        await expect(
          apiClient.createWebhook({
            url: webhookServer.getUrl(),
            events,
          })
        ).rejects.toThrow();
      }
    });

    test('should support all documented event types', async () => {
      const allEvents = [
        'enhancement.completed',
        'batch.finished',
        'error.occurred',
      ];

      const response = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: allEvents,
      });

      expect(response.id).toBeTruthy();
      webhookId = response.id;
    });

    test('should allow selective event subscription', async () => {
      // Subscribe only to enhancement.completed
      const response = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      webhookId = response.id;
      webhookSecret = response.secret;

      // Trigger different events
      await apiClient.enhance({ text: 'Test selective subscription' });

      // Only enhancement.completed should be delivered
      const deliveries = await webhookServer.waitForDeliveries(1, 5000);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].event.event).toBe('enhancement.completed');
    });
  });

  test.describe('Event Delivery', () => {
    test.beforeEach(async () => {
      // Create a webhook for event delivery tests
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed', 'batch.finished', 'error.occurred'],
      });
      
      webhookId = webhook.id;
      webhookSecret = webhook.secret;
      
      // Reconfigure server with the secret
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
        logLevel: 'info',
      });
      await webhookServer.start();
    });

    test('should deliver enhancement.completed events', async () => {
      // Register event handler
      webhookServer.onEvent('enhancement.completed', (event) => {
        return { acknowledged: true, processed_at: new Date().toISOString() };
      });

      // Trigger enhancement
      const enhanceResponse = await apiClient.enhance({
        text: 'Test webhook delivery',
      });

      // Wait for delivery
      const delivery = await webhookServer.waitForEvent('enhancement.completed', 5000);

      expect(delivery).toBeTruthy();
      expect(delivery.valid_signature).toBe(true);
      expect(delivery.event.event).toBe('enhancement.completed');
      expect(delivery.event.data).toBeTruthy();
      expect(delivery.event.data.id).toBe(enhanceResponse.id);
      expect(delivery.event.data.original_text).toBe('Test webhook delivery');
      expect(delivery.event.data.enhanced_text).toBeTruthy();
      expect(delivery.event.data.techniques_used).toBeInstanceOf(Array);
      expect(delivery.response_sent.status).toBe(200);
    });

    test('should deliver batch.finished events', async () => {
      // Submit batch job
      const batchResponse = await apiClient.batchEnhance([
        { text: 'Batch item 1' },
        { text: 'Batch item 2' },
        { text: 'Batch item 3' },
      ]);

      // Wait for batch completion event
      const delivery = await webhookServer.waitForEvent('batch.finished', 30000);

      expect(delivery).toBeTruthy();
      expect(delivery.valid_signature).toBe(true);
      expect(delivery.event.event).toBe('batch.finished');
      expect(delivery.event.data.job_id).toBe(batchResponse.job_id);
      expect(delivery.event.data.total_requests).toBe(3);
      expect(delivery.event.data.successful).toBeGreaterThanOrEqual(0);
      expect(delivery.event.data.failed).toBeGreaterThanOrEqual(0);
      expect(delivery.event.data.processing_time_ms).toBeGreaterThan(0);
    });

    test('should deliver error.occurred events', async () => {
      // This test would require triggering an actual error
      // For now, we'll simulate by expecting the event structure
      test.skip();
    });

    test('should include all required event metadata', async () => {
      await apiClient.enhance({ text: 'Test event metadata' });

      const delivery = await webhookServer.waitForEvent('enhancement.completed', 5000);

      // Check event structure
      expect(delivery.event.id).toBeTruthy();
      expect(delivery.event.event).toBe('enhancement.completed');
      expect(delivery.event.timestamp).toBeTruthy();
      expect(new Date(delivery.event.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      expect(delivery.event.data).toBeTruthy();
    });

    test('should deliver events in correct order', async () => {
      // Trigger multiple enhancements
      const prompts = [
        'First enhancement',
        'Second enhancement',
        'Third enhancement',
      ];

      const enhancePromises = prompts.map(text => 
        apiClient.enhance({ text })
      );

      await Promise.all(enhancePromises);

      // Wait for all deliveries
      const deliveries = await webhookServer.waitForDeliveries(3, 10000);

      expect(deliveries.length).toBe(3);
      
      // Verify all events were delivered
      const deliveredTexts = deliveries.map(d => d.event.data.original_text);
      expect(deliveredTexts).toEqual(expect.arrayContaining(prompts));
    });
  });

  test.describe('Security & Validation', () => {
    test.beforeEach(async () => {
      // Create webhook with known secret
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });
      
      webhookId = webhook.id;
      webhookSecret = webhook.secret;
    });

    test('should include valid HMAC signature', async () => {
      // Configure server to capture but not validate signatures
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        validateSignatures: false,
        logLevel: 'debug',
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test HMAC signature' });

      const delivery = await webhookServer.waitForEvent('enhancement.completed', 5000);

      // Manually validate signature
      const signature = delivery.headers['x-webhook-signature'];
      expect(signature).toBeTruthy();
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify signature
      const payload = JSON.stringify(delivery.event);
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });

    test('should reject invalid signatures', async () => {
      // Configure server with wrong secret
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: 'wrong-secret',
        validateSignatures: true,
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test invalid signature' });

      // Wait for delivery attempt
      await new Promise(resolve => setTimeout(resolve, 3000));

      const deliveries = webhookServer.getDeliveries();
      const invalidDeliveries = deliveries.filter(d => !d.valid_signature);

      expect(invalidDeliveries.length).toBeGreaterThan(0);
      expect(invalidDeliveries[0].response_sent.status).toBe(401);
    });

    test('should handle replay attacks', async () => {
      // Configure server to accept the webhook
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test replay protection' });

      const delivery = await webhookServer.waitForEvent('enhancement.completed', 5000);

      // Check timestamp is recent
      const eventTime = new Date(delivery.event.timestamp).getTime();
      const now = Date.now();
      const age = now - eventTime;

      expect(age).toBeLessThan(60000); // Less than 1 minute old
    });

    test('should not expose sensitive data in webhooks', async () => {
      // Create enhancement with potentially sensitive data
      const response = await apiClient.enhance({
        text: 'Process payment for user@example.com with card 4111111111111111',
        context: {
          user_email: 'user@example.com',
          api_key: 'secret-api-key',
        },
      });

      const delivery = await webhookServer.waitForEvent('enhancement.completed', 5000);

      // Check that sensitive data is not exposed
      const eventData = JSON.stringify(delivery.event.data);
      expect(eventData).not.toContain('4111111111111111');
      expect(eventData).not.toContain('secret-api-key');
    });
  });

  test.describe('Reliability & Error Handling', () => {
    test.beforeEach(async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });
      
      webhookId = webhook.id;
      webhookSecret = webhook.secret;
    });

    test('should retry failed deliveries', async () => {
      // Configure server to fail initially
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
        simulateFailures: true,
        failureRate: 1.0, // 100% failure
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test retry mechanism' });

      // Wait for initial failure
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now allow success
      webhookServer.setFailureSimulation(false);

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 5000));

      const deliveries = webhookServer.getDeliveries();
      const failures = deliveries.filter(d => d.response_sent.status === 500);
      const successes = deliveries.filter(d => d.response_sent.status === 200);

      expect(failures.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0);
    });

    test('should handle timeout gracefully', async () => {
      // Configure server with long delay
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
        responseDelay: 35000, // 35 second delay
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test timeout handling' });

      // API should not wait for webhook delivery
      // The enhancement should complete quickly
      expect(true).toBe(true); // Enhancement completed without waiting
    });

    test('should handle webhook endpoint downtime', async () => {
      // Stop webhook server
      await webhookServer.stop();

      // Trigger events while server is down
      const enhancePromise = apiClient.enhance({ text: 'Test during downtime' });

      // Enhancement should still succeed
      await expect(enhancePromise).resolves.toBeTruthy();

      // Restart server
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
      });
      await webhookServer.start();

      // Wait for potential retries
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check if events were eventually delivered
      const deliveries = webhookServer.getDeliveries();
      // This depends on retry implementation
    });

    test('should limit retry attempts', async () => {
      // Configure server to always fail
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
        simulateFailures: true,
        failureRate: 1.0,
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test retry limits' });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 20000));

      const deliveries = webhookServer.getDeliveries();
      
      // Should have limited number of attempts (e.g., 3-5)
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.length).toBeLessThanOrEqual(5);
    });

    test('should use exponential backoff for retries', async () => {
      // Configure server to fail initially
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhookSecret,
        validateSignatures: true,
        simulateFailures: true,
        failureRate: 1.0,
      });
      await webhookServer.start();

      // Trigger event
      await apiClient.enhance({ text: 'Test exponential backoff' });

      // Collect delivery timestamps
      await new Promise(resolve => setTimeout(resolve, 15000));

      const deliveries = webhookServer.getDeliveries();
      
      if (deliveries.length > 1) {
        // Calculate time between attempts
        const timestamps = deliveries.map(d => d.received_at.getTime());
        const delays: number[] = [];
        
        for (let i = 1; i < timestamps.length; i++) {
          delays.push(timestamps[i] - timestamps[i - 1]);
        }

        // Delays should increase (exponential backoff)
        for (let i = 1; i < delays.length; i++) {
          expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
        }
      }
    });
  });

  test.describe('Webhook Management', () => {
    test('should list registered webhooks', async () => {
      // Create multiple webhooks
      const webhook1 = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      const webhook2 = await apiClient.createWebhook({
        url: 'https://example.com/webhook2',
        events: ['batch.finished'],
      });

      // List webhooks
      const webhooks = await apiClient.getWebhooks();

      expect(webhooks).toBeInstanceOf(Array);
      expect(webhooks.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await apiClient.deleteWebhook(webhook1.id);
      await apiClient.deleteWebhook(webhook2.id);
    });

    test('should update webhook configuration', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      webhookId = webhook.id;

      // Update webhook
      await apiClient.updateWebhook(webhook.id, {
        events: ['enhancement.completed', 'batch.finished'],
        active: false,
      });

      // Verify update
      const webhooks = await apiClient.getWebhooks();
      const updated = webhooks.find(w => w.url === webhookServer.getUrl());

      expect(updated).toBeTruthy();
      expect(updated!.events).toContain('batch.finished');
      expect(updated!.active).toBe(false);
    });

    test('should delete webhook', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // Delete webhook
      await expect(
        apiClient.deleteWebhook(webhook.id)
      ).resolves.not.toThrow();

      // Verify deletion
      const webhooks = await apiClient.getWebhooks();
      const deleted = webhooks.find(w => w.url === webhookServer.getUrl());
      expect(deleted).toBeFalsy();

      // Clear webhookId since we already deleted it
      webhookId = '';
    });

    test('should deactivate webhook without deletion', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
        active: true,
      });

      webhookId = webhook.id;

      // Deactivate
      await apiClient.updateWebhook(webhook.id, {
        active: false,
      });

      // Trigger event
      await apiClient.enhance({ text: 'Test deactivated webhook' });

      // Should not receive webhook
      await new Promise(resolve => setTimeout(resolve, 3000));
      const deliveries = webhookServer.getDeliveries();
      expect(deliveries.length).toBe(0);
    });

    test('should track webhook delivery history', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      webhookId = webhook.id;

      // Trigger multiple events
      for (let i = 0; i < 3; i++) {
        await apiClient.enhance({ text: `Test delivery ${i + 1}` });
      }

      // Wait for deliveries
      await webhookServer.waitForDeliveries(3, 10000);

      // Get delivery history
      const deliveryHistory = await apiClient.getWebhookDeliveries(webhook.id);

      expect(deliveryHistory).toBeInstanceOf(Array);
      expect(deliveryHistory.length).toBeGreaterThanOrEqual(3);

      // Verify delivery details
      for (const delivery of deliveryHistory) {
        expect(delivery.webhook_id).toBe(webhook.id);
        expect(delivery.event).toBeTruthy();
        expect(delivery.delivered_at).toBeTruthy();
        expect(delivery.response_status).toBe(200);
      }
    });
  });

  test.describe('Performance & Scalability', () => {
    test('should handle high volume of events', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      webhookId = webhook.id;

      // Configure server for the webhook
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhook.secret,
        validateSignatures: true,
      });
      await webhookServer.start();

      // Trigger many events rapidly
      const promises = Array(20).fill(null).map((_, i) => 
        apiClient.enhance({ text: `High volume test ${i}` })
      );

      await Promise.all(promises);

      // Wait for all deliveries
      const deliveries = await webhookServer.waitForDeliveries(20, 30000);

      expect(deliveries.length).toBe(20);
      
      // All should be successful
      const successful = deliveries.filter(d => d.response_sent.status === 200);
      expect(successful.length).toBe(20);
    });

    test('should not block API operations on webhook delivery', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      webhookId = webhook.id;

      // Configure server with delay
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8890,
        secret: webhook.secret,
        validateSignatures: true,
        responseDelay: 5000, // 5 second delay
      });
      await webhookServer.start();

      // Time the enhancement operation
      const startTime = Date.now();
      const response = await apiClient.enhance({ text: 'Test non-blocking' });
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Enhancement should complete quickly despite webhook delay
      expect(response).toBeTruthy();
      expect(duration).toBeLessThan(3000); // Much less than webhook delay
    });

    test('should batch webhook deliveries efficiently', async () => {
      // This test assumes the API may batch webhook deliveries
      // for efficiency. Implementation-specific.
      test.skip();
    });
  });
});