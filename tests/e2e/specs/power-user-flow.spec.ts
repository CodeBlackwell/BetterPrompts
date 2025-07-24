import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';
import { EnhancementHelper } from '../helpers/enhancement.helper';
import { testPrompts, getPromptsByComplexity, generateRandomPrompt } from '../data/test-prompts';

test.describe('Power User Flow', () => {
  let authHelper: AuthHelper;
  let enhancementHelper: EnhancementHelper;
  let powerUser: TestUser;

  test.beforeAll(async ({ browser }) => {
    // Create a power user with history
    const page = await browser.newPage();
    authHelper = new AuthHelper(page);
    powerUser = AuthHelper.generateTestUser('power');
    
    // Register and create some history
    await authHelper.register(powerUser);
    
    // Create some enhancement history
    const enhancementHelper = new EnhancementHelper(page);
    for (let i = 0; i < 5; i++) {
      await page.goto('/enhance');
      const prompt = generateRandomPrompt();
      await enhancementHelper.enhancePrompt(prompt);
      await page.waitForTimeout(500); // Small delay between enhancements
    }
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    enhancementHelper = new EnhancementHelper(page);
    
    // Login as power user
    await authHelper.login(powerUser.email, powerUser.password);
  });

  test('power user batch enhancement workflow', async ({ page }) => {
    const startTime = Date.now();
    
    await test.step('Navigate to batch enhancement', async () => {
      await page.goto('/enhance');
      
      // Look for batch mode toggle/button
      const batchModeButton = page.locator('[data-testid="batch-mode-toggle"], button:has-text("Batch Mode")');
      if (await batchModeButton.isVisible()) {
        await batchModeButton.click();
      }
      
      // Verify batch mode UI
      await expect(page.locator('text=/batch.*mode/i')).toBeVisible();
    });

    await test.step('Add multiple prompts for batch processing', async () => {
      const complexPrompts = getPromptsByComplexity('complex');
      const batchPrompts = complexPrompts.slice(0, 3);
      
      for (let i = 0; i < batchPrompts.length; i++) {
        // Look for add prompt button
        const addButton = page.locator('[data-testid="add-prompt"], button:has-text("Add Prompt")');
        if (i > 0 && await addButton.isVisible()) {
          await addButton.click();
        }
        
        // Fill prompt
        const promptInput = page.locator(`[data-testid="batch-prompt-${i}"], textarea`).nth(i);
        await promptInput.fill(batchPrompts[i].input);
      }
    });

    await test.step('Configure batch enhancement settings', async () => {
      // Select specific techniques for all prompts
      const techniqueSelector = page.locator('[data-testid="batch-techniques"]');
      if (await techniqueSelector.isVisible()) {
        await techniqueSelector.click();
        await page.click('text=Chain of Thought');
        await page.click('text=Structured Output');
      }
      
      // Set target model if available
      const modelSelector = page.locator('[data-testid="batch-model-selector"]');
      if (await modelSelector.isVisible()) {
        await modelSelector.selectOption('gpt-4');
      }
    });

    await test.step('Execute batch enhancement', async () => {
      await page.click('button:has-text("Enhance All")');
      
      // Wait for all enhancements to complete
      await page.waitForSelector('[data-testid="batch-complete"]', { timeout: 30000 });
      
      // Verify all results are displayed
      const results = await page.locator('[data-testid="batch-result"]').all();
      expect(results.length).toBe(3);
    });

    await test.step('Export batch results', async () => {
      // Click export button
      const exportButton = page.locator('[data-testid="export-batch"], button:has-text("Export")');
      await exportButton.click();
      
      // Select export format
      const formatSelector = page.locator('[data-testid="export-format"]');
      if (await formatSelector.isVisible()) {
        await formatSelector.selectOption('json');
      }
      
      // Download results
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="download-export"], button:has-text("Download")')
      ]);
      
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toContain('batch-enhancement');
    });

    // Performance check
    const batchTime = Date.now() - startTime;
    expect(batchTime).toBeLessThan(45000); // 45 seconds for batch of 3
  });

  test('power user enhancement history and reuse', async ({ page }) => {
    await test.step('Navigate to history', async () => {
      await page.goto('/history');
      await page.waitForLoadState('networkidle');
      
      // Verify history page loaded
      await expect(page.locator('h1')).toContainText('Enhancement History');
      
      // Check that history items are present
      const historyItems = await page.locator('[data-testid="history-item"]').all();
      expect(historyItems.length).toBeGreaterThan(0);
    });

    await test.step('Search and filter history', async () => {
      // Search by keyword
      const searchInput = page.locator('[data-testid="history-search"], input[placeholder*="Search"]');
      await searchInput.fill('business');
      await page.keyboard.press('Enter');
      
      // Wait for filtered results
      await page.waitForTimeout(500);
      
      // Apply date filter
      const dateFilter = page.locator('[data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.selectOption('last-7-days');
      }
      
      // Apply technique filter
      const techniqueFilter = page.locator('[data-testid="technique-filter"]');
      if (await techniqueFilter.isVisible()) {
        await techniqueFilter.click();
        await page.click('text=Chain of Thought');
      }
    });

    await test.step('Reuse previous enhancement', async () => {
      // Click on a history item
      const firstHistoryItem = page.locator('[data-testid="history-item"]').first();
      await firstHistoryItem.click();
      
      // Wait for detail view
      await page.waitForSelector('[data-testid="history-detail"]');
      
      // Click reuse button
      await page.click('[data-testid="reuse-enhancement"], button:has-text("Reuse")');
      
      // Should navigate to enhance page with pre-filled prompt
      await expect(page).toHaveURL(/\/enhance/);
      
      // Verify prompt is pre-filled
      const promptTextarea = page.locator('textarea[placeholder*="Enter your prompt"]');
      const promptValue = await promptTextarea.inputValue();
      expect(promptValue).toBeTruthy();
    });

    await test.step('Export history', async () => {
      await page.goto('/history');
      
      // Select multiple items
      const checkboxes = await page.locator('[data-testid="history-checkbox"]').all();
      for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
        await checkboxes[i].check();
      }
      
      // Export selected
      await page.click('[data-testid="export-selected"], button:has-text("Export Selected")');
      
      // Choose format
      const formatModal = page.locator('[data-testid="export-format-modal"]');
      if (await formatModal.isVisible()) {
        await page.click('button:has-text("CSV")');
      }
      
      // Verify download
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="confirm-export"]')
      ]);
      
      expect(download.suggestedFilename()).toContain('enhancement-history');
    });
  });

  test('power user API key management', async ({ page }) => {
    await test.step('Navigate to API settings', async () => {
      await page.goto('/settings');
      await page.click('[data-testid="api-tab"], text=API');
      
      // Verify API section
      await expect(page.locator('h2')).toContainText('API Access');
    });

    await test.step('Generate API key', async () => {
      const generateButton = page.locator('button:has-text("Generate API Key")');
      await generateButton.click();
      
      // Handle confirmation
      const confirmButton = page.locator('[data-testid="confirm-generate"]');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Wait for key generation
      await page.waitForSelector('[data-testid="api-key-display"]');
      
      // Copy API key
      await page.click('[data-testid="copy-api-key"]');
      await expect(page.locator('text=Copied!')).toBeVisible();
    });

    await test.step('Test API usage tracking', async () => {
      // Check usage stats
      await expect(page.locator('[data-testid="api-usage"]')).toBeVisible();
      
      // Verify rate limits displayed
      await expect(page.locator('text=/rate.*limit/i')).toBeVisible();
      await expect(page.locator('text=/requests.*per/i')).toBeVisible();
    });

    await test.step('Manage API keys', async () => {
      // View all keys
      const apiKeys = await page.locator('[data-testid="api-key-item"]').all();
      
      if (apiKeys.length > 0) {
        // Revoke a key
        const firstKey = apiKeys[0];
        const revokeButton = firstKey.locator('button:has-text("Revoke")');
        await revokeButton.click();
        
        // Confirm revocation
        await page.click('[data-testid="confirm-revoke"]');
        
        // Verify key removed
        await expect(firstKey).toHaveClass(/revoked|disabled/);
      }
    });
  });

  test('power user advanced settings and preferences', async ({ page }) => {
    await page.goto('/settings');
    
    await test.step('Configure enhancement preferences', async () => {
      await page.click('[data-testid="preferences-tab"], text=Preferences');
      
      // Set default techniques
      const defaultTechniques = page.locator('[data-testid="default-techniques"]');
      if (await defaultTechniques.isVisible()) {
        await defaultTechniques.click();
        await page.click('text=Tree of Thoughts');
        await page.click('text=Self Consistency');
      }
      
      // Set default model
      const defaultModel = page.locator('[data-testid="default-model"]');
      if (await defaultModel.isVisible()) {
        await defaultModel.selectOption('claude-3');
      }
      
      // Enable auto-save
      const autoSave = page.locator('[data-testid="auto-save-toggle"]');
      if (await autoSave.isVisible()) {
        await autoSave.check();
      }
      
      // Save preferences
      await page.click('button:has-text("Save Preferences")');
      await expect(page.locator('text=Preferences saved')).toBeVisible();
    });

    await test.step('Configure keyboard shortcuts', async () => {
      await page.click('[data-testid="shortcuts-tab"], text=Shortcuts');
      
      // Customize enhance shortcut
      const enhanceShortcut = page.locator('[data-testid="shortcut-enhance"]');
      if (await enhanceShortcut.isVisible()) {
        await enhanceShortcut.click();
        await page.keyboard.press('Control+E');
        await page.click('button:has-text("Save")');
      }
      
      // Verify shortcut saved
      await expect(page.locator('text=Ctrl+E')).toBeVisible();
    });
  });

  test('power user performance with large prompts', async ({ page }) => {
    await page.goto('/enhance');
    
    await test.step('Handle large prompt enhancement', async () => {
      // Generate a large prompt (1000+ words)
      const largeParts = [];
      for (let i = 0; i < 50; i++) {
        largeParts.push(generateRandomPrompt());
      }
      const largePrompt = largeParts.join(' Additionally, ');
      
      const startTime = Date.now();
      
      // Enter large prompt
      await page.fill('textarea[placeholder*="Enter your prompt"]', largePrompt);
      
      // Enhance
      await page.click('button:has-text("Enhance")');
      
      // Should show progress indicator for large prompts
      await expect(page.locator('[data-testid="processing-large-prompt"]')).toBeVisible({ timeout: 2000 });
      
      // Wait for completion
      await enhancementHelper.waitForEnhancement(30000); // Extended timeout
      
      const enhanceTime = Date.now() - startTime;
      console.log(`Large prompt enhancement took ${enhanceTime}ms`);
      
      // Should still complete within reasonable time
      expect(enhanceTime).toBeLessThan(30000);
      
      // Verify result
      const result = await enhancementHelper.extractEnhancementResult();
      expect(result.enhancedPrompt).toBeTruthy();
    });
  });

  test('power user collaboration features', async ({ page, context }) => {
    await test.step('Share enhancement', async () => {
      // Create an enhancement
      await page.goto('/enhance');
      await enhancementHelper.enhancePrompt(testPrompts.businessPlan.input);
      
      // Click share button
      const shareButton = page.locator('[data-testid="share-enhancement"]');
      if (await shareButton.isVisible()) {
        await shareButton.click();
        
        // Get share link
        const shareLinkInput = page.locator('[data-testid="share-link"]');
        const shareLink = await shareLinkInput.inputValue();
        expect(shareLink).toContain('/share/');
        
        // Copy link
        await page.click('[data-testid="copy-share-link"]');
        
        // Test link in new tab
        const newPage = await context.newPage();
        await newPage.goto(shareLink);
        
        // Verify shared content loads
        await expect(newPage.locator('[data-testid="shared-enhancement"]')).toBeVisible();
        await expect(newPage.locator('text=' + testPrompts.businessPlan.input)).toBeVisible();
        
        await newPage.close();
      }
    });

    await test.step('Create enhancement template', async () => {
      await page.goto('/enhance');
      
      // Look for template option
      const templateButton = page.locator('[data-testid="save-as-template"]');
      if (await templateButton.isVisible()) {
        // Enhance a prompt first
        await enhancementHelper.enhancePrompt(testPrompts.codeGeneration.input);
        
        // Save as template
        await templateButton.click();
        
        // Fill template details
        await page.fill('[data-testid="template-name"]', 'Code Generation Template');
        await page.fill('[data-testid="template-description"]', 'Template for code generation tasks');
        
        // Set template visibility
        const visibilitySelect = page.locator('[data-testid="template-visibility"]');
        if (await visibilitySelect.isVisible()) {
          await visibilitySelect.selectOption('team'); // or 'private', 'public'
        }
        
        // Save template
        await page.click('[data-testid="save-template"]');
        await expect(page.locator('text=Template saved')).toBeVisible();
      }
    });
  });

  test('power user data export and analytics', async ({ page }) => {
    await test.step('View analytics dashboard', async () => {
      await page.goto('/dashboard');
      
      // Check for analytics widgets
      await expect(page.locator('[data-testid="usage-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="technique-distribution"]')).toBeVisible();
      await expect(page.locator('[data-testid="enhancement-trends"]')).toBeVisible();
    });

    await test.step('Export usage data', async () => {
      // Navigate to data export
      await page.click('[data-testid="export-data"], text=Export Data');
      
      // Select date range
      const dateRange = page.locator('[data-testid="export-date-range"]');
      if (await dateRange.isVisible()) {
        await dateRange.selectOption('last-30-days');
      }
      
      // Select data types
      const dataTypes = ['enhancements', 'usage-stats', 'feedback'];
      for (const type of dataTypes) {
        const checkbox = page.locator(`[data-testid="export-${type}"]`);
        if (await checkbox.isVisible()) {
          await checkbox.check();
        }
      }
      
      // Export
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-data-button"]')
      ]);
      
      expect(download.suggestedFilename()).toContain('betterprompts-export');
    });
  });
});