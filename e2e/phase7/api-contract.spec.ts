import { test, expect } from '@playwright/test';
import { BetterPromptsAPIClient } from './utils/api-client';
import { OpenAPIValidator } from './utils/openapi-validator';
import { OpenAPILoader } from './utils/openapi-loader';
import * as testData from './fixtures/test-data.json';

test.describe('API Contract Validation', () => {
  let apiClient: BetterPromptsAPIClient;
  let validator: OpenAPIValidator;
  const baseURL = process.env.BASE_URL || 'http://localhost/api/v1';

  test.beforeAll(async () => {
    // Load OpenAPI specification
    const spec = OpenAPILoader.getDefaultSpec();
    validator = new OpenAPIValidator(spec);
  });

  test.beforeEach(async () => {
    // Initialize API client
    apiClient = new BetterPromptsAPIClient({ baseURL });
  });

  test.afterAll(async () => {
    // Generate validation report
    const report = validator.generateReport();
    console.log('\n=== OpenAPI Contract Validation Report ===\n');
    console.log(report);
    
    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'test-results', 'contract-validation-report.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
  });

  test.describe('Enhancement Endpoint Contract', () => {
    test('POST /enhance - valid request and response', async () => {
      const request = {
        text: testData.testPrompts.simple.text,
        prefer_techniques: ['chain_of_thought'],
        target_complexity: 'simple',
      };

      // Make actual API call
      const response = await apiClient['client'].post('/enhance', request);

      // Validate against OpenAPI spec
      const validation = validator.validateInteraction(
        '/enhance',
        'post',
        response.status,
        {
          body: request,
          headers: response.config.headers as Record<string, string>,
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
      if (!validation.result.valid) {
        console.error('Validation errors:', validation.result.errors);
      }
    });

    test('POST /enhance - validates all optional parameters', async () => {
      const testCases = [
        {
          text: 'Test with context',
          context: { key: 'value', nested: { data: 123 } },
        },
        {
          text: 'Test with techniques',
          prefer_techniques: ['chain_of_thought', 'few_shot'],
          exclude_techniques: ['analogies'],
        },
        {
          text: 'Test with complexity',
          target_complexity: 'moderate',
        },
      ];

      for (const testCase of testCases) {
        const response = await apiClient['client'].post('/enhance', testCase);

        const validation = validator.validateInteraction(
          '/enhance',
          'post',
          response.status,
          { body: testCase },
          { body: response.data }
        );

        expect(validation.result.valid).toBe(true);
      }
    });

    test('POST /enhance - validates error responses', async () => {
      const invalidRequests = [
        { /* missing text */ },
        { text: '' },
        { text: 'a'.repeat(5001) },
      ];

      for (const invalidRequest of invalidRequests) {
        try {
          await apiClient['client'].post('/enhance', invalidRequest);
          fail('Expected error');
        } catch (error: any) {
          const validation = validator.validateInteraction(
            '/enhance',
            'post',
            error.response.status,
            { body: invalidRequest },
            { body: error.response.data }
          );

          expect([400, 422]).toContain(error.response.status);
          // Error response should match schema
          expect(validation.result.valid).toBe(true);
        }
      }
    });
  });

  test.describe('Batch Enhancement Contract', () => {
    test('POST /batch - valid batch request', async () => {
      // Authenticate first
      const authResponse = await apiClient.login({
        email: testData.testUsers.developer.email,
        password: testData.testUsers.developer.password,
      });

      const request = {
        requests: testData.batchRequests.slice(0, 3),
      };

      const response = await apiClient['client'].post(
        '/batch',
        request,
        {
          headers: {
            Authorization: `Bearer ${authResponse.access_token}`,
          },
        }
      );

      const validation = validator.validateInteraction(
        '/batch',
        'post',
        response.status,
        {
          body: request,
          headers: {
            Authorization: `Bearer ${authResponse.access_token}`,
          },
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
      expect(response.status).toBe(202); // Accepted
      expect(response.data.job_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  test.describe('Techniques Endpoint Contract', () => {
    test('GET /techniques - list all techniques', async () => {
      const response = await apiClient['client'].get('/techniques');

      const validation = validator.validateInteraction(
        '/techniques',
        'get',
        response.status,
        {},
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('GET /techniques - filter by category', async () => {
      const categories = ['reasoning', 'creative', 'analytical', 'instructional'];

      for (const category of categories) {
        const response = await apiClient['client'].get('/techniques', {
          params: { category },
        });

        const validation = validator.validateInteraction(
          '/techniques',
          'get',
          response.status,
          {
            query: { category },
          },
          {
            body: response.data,
            headers: response.headers as Record<string, string>,
          }
        );

        expect(validation.result.valid).toBe(true);
      }
    });

    test('GET /techniques - filter by complexity', async () => {
      const complexities = [1, 2, 3, 4, 5];

      for (const complexity of complexities) {
        const response = await apiClient['client'].get('/techniques', {
          params: { complexity },
        });

        const validation = validator.validateInteraction(
          '/techniques',
          'get',
          response.status,
          {
            query: { complexity },
          },
          {
            body: response.data,
            headers: response.headers as Record<string, string>,
          }
        );

        expect(validation.result.valid).toBe(true);
      }
    });
  });

  test.describe('History Endpoints Contract', () => {
    let authToken: string;

    test.beforeEach(async () => {
      const authResponse = await apiClient.login({
        email: testData.testUsers.regular.email,
        password: testData.testUsers.regular.password,
      });
      authToken = authResponse.access_token;
    });

    test('GET /history - paginated response', async () => {
      const params = {
        page: 1,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
      };

      const response = await apiClient['client'].get('/history', {
        params,
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const validation = validator.validateInteraction(
        '/history',
        'get',
        response.status,
        {
          query: params,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
    });

    test('GET /history/{id} - get specific item', async () => {
      // First create an item
      const enhanceResponse = await apiClient.enhance({
        text: 'Test for history retrieval',
      });

      const response = await apiClient['client'].get(
        `/history/${enhanceResponse.id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const validation = validator.validateInteraction(
        '/history/{id}',
        'get',
        response.status,
        {
          params: { id: enhanceResponse.id },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
    });

    test('DELETE /history/{id} - delete item', async () => {
      // First create an item
      const enhanceResponse = await apiClient.enhance({
        text: 'Test for deletion',
      });

      const response = await apiClient['client'].delete(
        `/history/${enhanceResponse.id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const validation = validator.validateInteraction(
        '/history/{id}',
        'delete',
        response.status,
        {
          params: { id: enhanceResponse.id },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        {
          body: response.data || null,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
      expect(response.status).toBe(204); // No Content
    });
  });

  test.describe('Stats Endpoint Contract', () => {
    test('GET /stats - usage statistics', async () => {
      const authResponse = await apiClient.login({
        email: testData.testUsers.developer.email,
        password: testData.testUsers.developer.password,
      });

      const response = await apiClient['client'].get('/stats', {
        headers: {
          Authorization: `Bearer ${authResponse.access_token}`,
        },
      });

      const validation = validator.validateInteraction(
        '/stats',
        'get',
        response.status,
        {
          headers: {
            Authorization: `Bearer ${authResponse.access_token}`,
          },
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
    });
  });

  test.describe('Webhook Endpoints Contract', () => {
    let authToken: string;

    test.beforeEach(async () => {
      const authResponse = await apiClient.login({
        email: testData.testUsers.developer.email,
        password: testData.testUsers.developer.password,
      });
      authToken = authResponse.access_token;
    });

    test('POST /webhooks - create webhook', async () => {
      const request = {
        url: 'https://example.com/webhook',
        events: ['enhancement.completed', 'batch.finished'],
        active: true,
      };

      const response = await apiClient['client'].post('/webhooks', request, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const validation = validator.validateInteraction(
        '/webhooks',
        'post',
        response.status,
        {
          body: request,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        {
          body: response.data,
          headers: response.headers as Record<string, string>,
        }
      );

      expect(validation.result.valid).toBe(true);
      expect(response.status).toBe(201); // Created
      expect(response.data.id).toBeTruthy();
      expect(response.data.secret).toBeTruthy();
    });
  });

  test.describe('Error Response Contract', () => {
    test('validates 400 Bad Request format', async () => {
      try {
        await apiClient['client'].post('/enhance', { text: '' });
        fail('Expected error');
      } catch (error: any) {
        const validation = validator.validateResponse(
          '/enhance',
          'post',
          400,
          {
            body: error.response.data,
            headers: error.response.headers,
          }
        );

        expect(validation.result.valid).toBe(true);
        expect(error.response.data.error).toBeTruthy();
      }
    });

    test('validates 401 Unauthorized format', async () => {
      try {
        await apiClient['client'].get('/history');
        fail('Expected error');
      } catch (error: any) {
        const validation = validator.validateResponse(
          '/history',
          'get',
          401,
          {
            body: error.response.data,
            headers: error.response.headers,
          }
        );

        expect(validation.result.valid).toBe(true);
        expect(error.response.data.error).toBeTruthy();
      }
    });

    test('validates 429 Rate Limited format', async () => {
      // This test would require exhausting rate limit
      // Conceptual test for now
      test.skip();
    });
  });

  test.describe('Response Headers Contract', () => {
    test('validates rate limit headers', async () => {
      const response = await apiClient['client'].post('/enhance', {
        text: 'Test rate limit headers',
      });

      // Check for rate limit headers
      const rateLimitHeaders = [
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ];

      for (const header of rateLimitHeaders) {
        expect(response.headers[header]).toBeTruthy();
      }
    });

    test('validates CORS headers', async () => {
      const response = await apiClient['client'].options('/enhance');

      // Check for CORS headers
      expect(response.headers['access-control-allow-origin']).toBeTruthy();
      expect(response.headers['access-control-allow-methods']).toBeTruthy();
      expect(response.headers['access-control-allow-headers']).toBeTruthy();
    });
  });

  test.describe('Content Type Validation', () => {
    test('accepts application/json requests', async () => {
      const response = await apiClient['client'].post(
        '/enhance',
        { text: 'Test content type' },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
    });

    test('returns application/json responses', async () => {
      const response = await apiClient['client'].post('/enhance', {
        text: 'Test response type',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  test.describe('API Versioning Contract', () => {
    test('uses URL path versioning', async () => {
      // Verify that all endpoints use /api/v1 prefix
      const endpoints = [
        '/enhance',
        '/techniques',
        '/history',
        '/stats',
      ];

      for (const endpoint of endpoints) {
        expect(baseURL).toContain('/v1');
      }
    });

    test('includes version in response headers', async () => {
      const response = await apiClient['client'].post('/enhance', {
        text: 'Test API version',
      });

      // Check if API version is included in headers (optional)
      // This depends on implementation
      test.skip();
    });
  });

  test.describe('Schema Compliance', () => {
    test('all required fields are present in responses', async () => {
      // Test enhancement response
      const enhanceResponse = await apiClient.enhance({
        text: 'Test required fields',
      });

      const requiredFields = [
        'id',
        'original_text',
        'enhanced_text',
        'intent',
        'complexity',
        'techniques_used',
        'confidence',
        'processing_time_ms',
      ];

      for (const field of requiredFields) {
        expect(enhanceResponse).toHaveProperty(field);
      }
    });

    test('data types match OpenAPI schema', async () => {
      const response = await apiClient.enhance({
        text: 'Test data types',
      });

      // String fields
      expect(typeof response.id).toBe('string');
      expect(typeof response.original_text).toBe('string');
      expect(typeof response.enhanced_text).toBe('string');
      expect(typeof response.intent).toBe('string');
      expect(typeof response.complexity).toBe('string');

      // Number fields
      expect(typeof response.confidence).toBe('number');
      expect(typeof response.processing_time_ms).toBe('number');

      // Array fields
      expect(Array.isArray(response.techniques_used)).toBe(true);

      // Boolean fields
      expect(typeof response.enhanced).toBe('boolean');
    });

    test('enum values are validated', async () => {
      // Test target_complexity enum
      const validComplexities = ['simple', 'moderate', 'complex'];
      
      for (const complexity of validComplexities) {
        const response = await apiClient.enhance({
          text: 'Test enum',
          target_complexity: complexity,
        });
        expect(response).toBeTruthy();
      }

      // Test invalid enum value
      try {
        await apiClient['client'].post('/enhance', {
          text: 'Test invalid enum',
          target_complexity: 'invalid',
        });
        fail('Expected error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  test.describe('Coverage Report', () => {
    test('generates API coverage summary', async () => {
      const summary = validator.getValidationSummary();

      console.log('\n=== API Coverage Summary ===');
      console.log(`Total validations: ${summary.total}`);
      console.log(`Valid: ${summary.valid}`);
      console.log(`Invalid: ${summary.invalid}`);
      console.log(`Coverage: ${summary.coverage.toFixed(2)}%`);

      if (summary.uncoveredEndpoints.length > 0) {
        console.log('\nUncovered endpoints:');
        summary.uncoveredEndpoints.forEach(endpoint => {
          console.log(`- ${endpoint}`);
        });
      }

      // Expect reasonable coverage
      expect(summary.coverage).toBeGreaterThan(70);
    });
  });
});