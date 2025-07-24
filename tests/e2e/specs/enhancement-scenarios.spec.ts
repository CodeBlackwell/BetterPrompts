import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';
import { EnhancementHelper } from '../helpers/enhancement.helper';
import { testPrompts, getPromptsByComplexity, generateRandomPrompt } from '../data/test-prompts';

test.describe('Enhancement Scenarios', () => {
  let authHelper: AuthHelper;
  let enhancementHelper: EnhancementHelper;
  let testUser: TestUser;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    authHelper = new AuthHelper(page);
    testUser = AuthHelper.generateTestUser('enhance');
    await authHelper.register(testUser);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    enhancementHelper = new EnhancementHelper(page);
    await authHelper.login(testUser.email, testUser.password);
  });

  test.describe('Simple Prompt Enhancement', () => {
    test('enhance basic question prompt', async ({ page }) => {
      const startTime = Date.now();
      
      await test.step('Navigate and enter simple prompt', async () => {
        await enhancementHelper.navigateToEnhancePage();
        await page.fill('textarea[placeholder*="Enter your prompt"]', testPrompts.simpleQuestion.input);
      });

      await test.step('Enhance and verify result', async () => {
        await page.click('button:has-text("Enhance")');
        await enhancementHelper.waitForEnhancement();
        
        const result = await enhancementHelper.extractEnhancementResult();
        
        // Verify enhancement quality
        expect(result.enhancedPrompt).toContain('explain');
        expect(result.suggestedTechniques).toContain('zero_shot');
        expect(result.intent.complexity).toBeLessThan(0.5);
        
        // Performance check
        const enhanceTime = Date.now() - startTime;
        expect(enhanceTime).toBeLessThan(3000); // Should complete within 3 seconds
      });
    });

    test('enhance summarization request', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const result = await enhancementHelper.enhancePrompt(testPrompts.simpleSummary.input);
      
      // Verify summarization patterns
      for (const pattern of testPrompts.simpleSummary.enhancementPatterns) {
        expect(result.enhancedPrompt).toMatch(pattern);
      }
      
      expect(result.intent.category).toBe('text_summarization');
    });

    test('handle very short prompts', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const result = await enhancementHelper.enhancePrompt(testPrompts.veryShort.input);
      
      // Should ask for clarification
      expect(result.enhancedPrompt).toMatch(/clarify|specify|more information/i);
      expect(result.suggestedTechniques).toContain('clarification_request');
    });
  });

  test.describe('Complex Prompt Enhancement', () => {
    test('enhance business strategy prompt', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      await test.step('Enter complex business prompt', async () => {
        await page.fill('textarea[placeholder*="Enter your prompt"]', testPrompts.businessPlan.input);
      });

      await test.step('Configure advanced options', async () => {
        // Select specific techniques if available
        const advancedOptions = page.locator('[data-testid="advanced-options"]');
        if (await advancedOptions.isVisible()) {
          await advancedOptions.click();
          
          // Select techniques
          await page.check('[data-testid="technique-chain_of_thought"]');
          await page.check('[data-testid="technique-tree_of_thoughts"]');
        }
      });

      await test.step('Enhance and verify complex result', async () => {
        await page.click('button:has-text("Enhance")');
        await enhancementHelper.waitForEnhancement(15000); // Longer timeout for complex prompts
        
        const result = await enhancementHelper.extractEnhancementResult();
        
        // Verify all expected patterns are present
        for (const pattern of testPrompts.businessPlan.enhancementPatterns) {
          expect(result.enhancedPrompt).toMatch(pattern);
        }
        
        // Should use advanced techniques
        expect(result.suggestedTechniques).toContain('chain_of_thought');
        expect(result.intent.complexity).toBeGreaterThan(0.7);
      });
    });

    test('enhance technical system design prompt', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const result = await enhancementHelper.enhancePrompt(
        testPrompts.systemDesign.input,
        { targetModel: 'claude-3' }
      );
      
      // Verify technical patterns
      expect(result.enhancedPrompt).toMatch(/architecture|scalability|microservices/i);
      expect(result.enhancedPrompt).toMatch(/api|integration/i);
      expect(result.enhancedPrompt).toMatch(/security|authentication/i);
      
      // Should suggest architectural thinking
      expect(result.suggestedTechniques).toContain('architectural_thinking');
    });

    test('enhance research methodology prompt', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const result = await enhancementHelper.enhancePrompt(testPrompts.researchProposal.input);
      
      // Verify research patterns
      expect(result.enhancedPrompt).toMatch(/hypothesis|research questions/i);
      expect(result.enhancedPrompt).toMatch(/methodology|methods/i);
      expect(result.enhancedPrompt).toMatch(/ethical considerations/i);
      
      expect(result.intent.category).toBe('research_design');
    });
  });

  test.describe('Batch Processing', () => {
    test('batch enhance multiple prompts', async ({ page }) => {
      await page.goto('/enhance');
      
      // Enable batch mode
      const batchToggle = page.locator('[data-testid="batch-mode-toggle"]');
      if (await batchToggle.isVisible()) {
        await batchToggle.click();
      }
      
      const prompts = [
        testPrompts.simpleQuestion,
        testPrompts.codeGeneration,
        testPrompts.dataAnalysis
      ];
      
      await test.step('Add multiple prompts', async () => {
        for (let i = 0; i < prompts.length; i++) {
          if (i > 0) {
            await page.click('[data-testid="add-prompt"]');
          }
          
          const textarea = page.locator(`[data-testid="batch-prompt-${i}"]`);
          await textarea.fill(prompts[i].input);
        }
      });

      await test.step('Process batch', async () => {
        const startTime = Date.now();
        
        await page.click('button:has-text("Enhance All")');
        await page.waitForSelector('[data-testid="batch-complete"]', { timeout: 30000 });
        
        // Verify all results
        for (let i = 0; i < prompts.length; i++) {
          const result = page.locator(`[data-testid="batch-result-${i}"]`);
          await expect(result).toBeVisible();
          
          const enhancedText = await result.locator('[data-testid="enhanced-prompt"]').textContent();
          expect(enhancedText).toBeTruthy();
          expect(enhancedText!.length).toBeGreaterThan(prompts[i].input.length);
        }
        
        // Performance check
        const batchTime = Date.now() - startTime;
        const avgTimePerPrompt = batchTime / prompts.length;
        expect(avgTimePerPrompt).toBeLessThan(10000); // Average 10s per prompt
      });
    });

    test('handle batch with mixed complexity', async ({ page }) => {
      await page.goto('/enhance');
      
      // Enable batch mode
      const batchToggle = page.locator('[data-testid="batch-mode-toggle"]');
      if (await batchToggle.isVisible()) {
        await batchToggle.click();
      }
      
      // Get prompts of different complexities
      const simplePrompts = getPromptsByComplexity('simple').slice(0, 2);
      const moderatePrompts = getPromptsByComplexity('moderate').slice(0, 2);
      const complexPrompts = getPromptsByComplexity('complex').slice(0, 1);
      
      const allPrompts = [...simplePrompts, ...moderatePrompts, ...complexPrompts];
      
      // Add all prompts
      for (let i = 0; i < allPrompts.length; i++) {
        if (i > 0) {
          await page.click('[data-testid="add-prompt"]');
        }
        
        const textarea = page.locator(`[data-testid="batch-prompt-${i}"]`);
        await textarea.fill(allPrompts[i].input);
      }
      
      // Process batch
      await page.click('button:has-text("Enhance All")');
      await page.waitForSelector('[data-testid="batch-complete"]', { timeout: 45000 });
      
      // Verify complexity handling
      for (let i = 0; i < allPrompts.length; i++) {
        const complexityBadge = page.locator(`[data-testid="batch-result-${i}"] [data-testid="complexity-badge"]`);
        const complexity = await complexityBadge.textContent();
        
        // Verify complexity matches expected
        if (allPrompts[i].complexity === 'simple') {
          expect(complexity).toMatch(/simple|low/i);
        } else if (allPrompts[i].complexity === 'complex') {
          expect(complexity).toMatch(/complex|high/i);
        }
      }
    });
  });

  test.describe('API Usage', () => {
    test('enhance via API endpoint', async ({ page, request }) => {
      // Get API key first
      await page.goto('/settings');
      await page.click('[data-testid="api-tab"]');
      
      let apiKey = '';
      
      // Generate or get existing API key
      const existingKey = page.locator('[data-testid="api-key-display"]');
      if (await existingKey.isVisible()) {
        apiKey = await existingKey.textContent() || '';
      } else {
        await page.click('button:has-text("Generate API Key")');
        await page.waitForSelector('[data-testid="api-key-display"]');
        apiKey = await page.locator('[data-testid="api-key-display"]').textContent() || '';
      }
      
      expect(apiKey).toBeTruthy();
      
      // Make API request
      const response = await request.post('/api/v1/enhance', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          prompt: testPrompts.codeGeneration.input,
          options: {
            techniques: ['chain_of_thought', 'few_shot'],
            targetModel: 'gpt-4'
          }
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result.enhancedPrompt).toBeTruthy();
      expect(result.techniques).toContain('chain_of_thought');
      expect(result.metadata).toBeTruthy();
    });

    test('handle API rate limiting', async ({ page, request }) => {
      // Get API key
      await page.goto('/settings');
      await page.click('[data-testid="api-tab"]');
      const apiKey = await page.locator('[data-testid="api-key-display"]').textContent() || '';
      
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request.post('/api/v1/enhance', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            data: {
              prompt: generateRandomPrompt()
            }
          })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Some should succeed, some should be rate limited
      const rateLimited = responses.filter(r => r.status() === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.headers()['x-ratelimit-limit']).toBeTruthy();
      expect(limitedResponse.headers()['x-ratelimit-remaining']).toBeTruthy();
      expect(limitedResponse.headers()['x-ratelimit-reset']).toBeTruthy();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('handle network errors gracefully', async ({ page, context }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      // Simulate network failure
      await context.setOffline(true);
      
      // Try to enhance
      await page.fill('textarea[placeholder*="Enter your prompt"]', 'Test prompt');
      await page.click('button:has-text("Enhance")');
      
      // Should show error message
      const errorMessage = await enhancementHelper.getErrorMessage();
      expect(errorMessage).toContain('network');
      
      // Restore network
      await context.setOffline(false);
      
      // Retry should work
      await page.click('button:has-text("Retry")');
      await enhancementHelper.waitForEnhancement();
      
      const result = await enhancementHelper.extractEnhancementResult();
      expect(result.enhancedPrompt).toBeTruthy();
    });

    test('handle invalid input gracefully', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const invalidInputs = [
        { input: '', error: 'required' },
        { input: 'a'.repeat(10001), error: 'too long' },
        { input: '<script>alert("xss")</script>', error: 'invalid' }
      ];
      
      for (const testCase of invalidInputs) {
        await enhancementHelper.clearPrompt();
        await page.fill('textarea[placeholder*="Enter your prompt"]', testCase.input);
        await page.click('button:has-text("Enhance")');
        
        const error = await enhancementHelper.getErrorMessage();
        expect(error).toContain(testCase.error);
        
        // Clear error for next test
        await enhancementHelper.clearPrompt();
      }
    });

    test('recover from service errors', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      // Enter a prompt that might trigger service errors
      await page.fill('textarea[placeholder*="Enter your prompt"]', 'Test service error recovery');
      await page.click('button:has-text("Enhance")');
      
      // If service error occurs
      const error = await enhancementHelper.getErrorMessage();
      if (error && error.includes('service')) {
        // Should offer retry
        const retryButton = page.locator('button:has-text("Retry")');
        await expect(retryButton).toBeVisible();
        
        // Should show helpful error message
        expect(error).toMatch(/temporarily unavailable|try again/i);
      }
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('handle rapid successive enhancements', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      const prompts = Array(5).fill(0).map(() => generateRandomPrompt());
      const times: number[] = [];
      
      for (const prompt of prompts) {
        const startTime = Date.now();
        
        await enhancementHelper.clearPrompt();
        const result = await enhancementHelper.enhancePrompt(prompt);
        
        const endTime = Date.now();
        times.push(endTime - startTime);
        
        expect(result.enhancedPrompt).toBeTruthy();
      }
      
      // Average time should be reasonable
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(5000);
      
      // No significant degradation
      const firstTime = times[0];
      const lastTime = times[times.length - 1];
      expect(lastTime).toBeLessThan(firstTime * 2);
    });

    test('responsive UI during enhancement', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      // Enter a complex prompt
      await page.fill('textarea[placeholder*="Enter your prompt"]', testPrompts.businessPlan.input);
      await page.click('button:has-text("Enhance")');
      
      // UI should remain responsive
      await test.step('Check UI responsiveness', async () => {
        // Should show loading state
        await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
        
        // Cancel button should be available
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          // Button should be clickable
          await expect(cancelButton).toBeEnabled();
        }
        
        // Other UI elements should not be blocked
        const navigation = page.locator('nav');
        await expect(navigation).toBeVisible();
      });
      
      // Wait for completion
      await enhancementHelper.waitForEnhancement();
    });

    test('efficient handling of large prompts', async ({ page }) => {
      await enhancementHelper.navigateToEnhancePage();
      
      // Create a large but valid prompt
      const largeSections = [
        'Context: ' + 'This is a detailed context section. '.repeat(50),
        'Requirements: ' + 'Specific requirement details. '.repeat(50),
        'Constraints: ' + 'Various constraints to consider. '.repeat(50),
        'Expected Output: ' + 'Detailed output expectations. '.repeat(50)
      ];
      
      const largePrompt = largeSections.join('\n\n');
      
      const startTime = Date.now();
      
      await page.fill('textarea[placeholder*="Enter your prompt"]', largePrompt);
      await page.click('button:has-text("Enhance")');
      
      // Should handle large prompt efficiently
      await enhancementHelper.waitForEnhancement(20000);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(20000);
      
      const result = await enhancementHelper.extractEnhancementResult();
      expect(result.enhancedPrompt).toBeTruthy();
      expect(result.enhancedPrompt.length).toBeGreaterThan(largePrompt.length);
    });
  });

  test.describe('Cross-device Responsiveness', () => {
    const devices = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    for (const device of devices) {
      test(`enhancement flow on ${device.name}`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        
        await enhancementHelper.navigateToEnhancePage();
        
        // Verify layout adapts
        const promptTextarea = page.locator('textarea[placeholder*="Enter your prompt"]');
        await expect(promptTextarea).toBeVisible();
        
        // Check textarea size is appropriate
        const box = await promptTextarea.boundingBox();
        expect(box).toBeTruthy();
        if (box) {
          expect(box.width).toBeLessThan(device.width - 40); // Some padding
        }
        
        // Perform enhancement
        const result = await enhancementHelper.enhancePrompt(testPrompts.simpleQuestion.input);
        expect(result.enhancedPrompt).toBeTruthy();
        
        // Verify results display properly
        const resultsContainer = page.locator('[data-testid="enhancement-results"]');
        await expect(resultsContainer).toBeVisible();
        
        if (device.name === 'Mobile') {
          // On mobile, techniques might stack vertically
          const techniques = await page.locator('[data-testid="technique-chip"]').all();
          if (techniques.length > 1) {
            const firstBox = await techniques[0].boundingBox();
            const secondBox = await techniques[1].boundingBox();
            if (firstBox && secondBox) {
              // Check if stacked (different Y positions)
              expect(Math.abs(firstBox.y - secondBox.y)).toBeGreaterThan(10);
            }
          }
        }
      });
    }
  });
});