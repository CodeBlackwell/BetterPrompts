import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';
import { EnhancementHelper } from '../helpers/enhancement.helper';
import { testPrompts } from '../data/test-prompts';

test.describe('New User Flow', () => {
  let authHelper: AuthHelper;
  let enhancementHelper: EnhancementHelper;
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    enhancementHelper = new EnhancementHelper(page);
    testUser = AuthHelper.generateTestUser('newuser');
    
    // Clear any existing auth state
    await authHelper.clearAuth();
  });

  test('complete new user journey from landing to first enhancement', async ({ page }) => {
    const startTime = Date.now();
    
    // Step 1: Visit landing page
    await test.step('Visit landing page', async () => {
      await page.goto('/');
      await expect(page).toHaveTitle(/BetterPrompts/);
      
      // Verify hero section is visible
      await expect(page.locator('h1')).toContainText(/Better Prompts/i);
      await expect(page.locator('text=Democratizing prompt engineering')).toBeVisible();
      
      // Check features section
      await expect(page.locator('text=Key Features')).toBeVisible();
      await expect(page.locator('text=AI-Powered Enhancement')).toBeVisible();
    });

    // Step 2: Navigate to sign up
    await test.step('Navigate to sign up', async () => {
      await page.click('a:has-text("Get Started")');
      await expect(page).toHaveURL(/\/register/);
      
      // Verify registration form elements
      await expect(page.locator('h1')).toContainText('Create Account');
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });

    // Step 3: Complete registration
    await test.step('Complete registration form', async () => {
      await page.fill('input[name="first_name"]', testUser.firstName!);
      await page.fill('input[name="last_name"]', testUser.lastName!);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirm_password"]', testUser.password);
      
      // Accept terms
      await page.check('input[name="acceptTerms"]');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      await page.waitForURL('**/onboarding', { timeout: 10000 });
    });

    // Step 4: Email verification simulation
    await test.step('Handle email verification', async () => {
      // In a real test, we would:
      // 1. Check email inbox programmatically
      // 2. Extract verification link
      // 3. Navigate to verification link
      
      // For now, simulate verification completed
      // This would typically be done through a test API or database update
      
      // Verify we're on onboarding page
      await expect(page.locator('h1')).toContainText('Welcome to BetterPrompts');
      
      // Look for email verification notice
      const verificationNotice = page.locator('text=Please verify your email');
      if (await verificationNotice.isVisible()) {
        // In real scenario, click "I've verified my email" or similar
        const continueButton = page.locator('button:has-text("Continue")');
        if (await continueButton.isVisible()) {
          await continueButton.click();
        }
      }
    });

    // Step 5: Complete onboarding
    await test.step('Complete onboarding flow', async () => {
      // Quick tour or skip option
      const skipTourButton = page.locator('button:has-text("Skip Tour")');
      const startTourButton = page.locator('button:has-text("Start Tour")');
      
      if (await skipTourButton.isVisible({ timeout: 5000 })) {
        await skipTourButton.click();
      } else if (await startTourButton.isVisible({ timeout: 5000 })) {
        // Go through quick tour
        await startTourButton.click();
        
        // Navigate through tour steps
        for (let i = 0; i < 3; i++) {
          const nextButton = page.locator('button:has-text("Next")');
          if (await nextButton.isVisible({ timeout: 2000 })) {
            await nextButton.click();
          }
        }
        
        // Finish tour
        const finishButton = page.locator('button:has-text("Finish")');
        if (await finishButton.isVisible()) {
          await finishButton.click();
        }
      }
      
      // Should redirect to dashboard or enhance page
      await page.waitForURL(/\/(dashboard|enhance)/, { timeout: 10000 });
    });

    // Step 6: Navigate to enhancement page
    await test.step('Navigate to enhancement page', async () => {
      if (!page.url().includes('/enhance')) {
        await page.goto('/enhance');
      }
      
      await page.waitForLoadState('networkidle');
      await expect(page.locator('textarea[placeholder*="Enter your prompt"]')).toBeVisible();
    });

    // Step 7: Create first enhancement
    await test.step('Create first enhancement', async () => {
      const simplePrompt = testPrompts.simpleQuestion;
      
      // Enter prompt
      await page.fill('textarea[placeholder*="Enter your prompt"]', simplePrompt.input);
      
      // Click enhance button
      await page.click('button:has-text("Enhance")');
      
      // Wait for enhancement to complete
      await enhancementHelper.waitForEnhancement();
      
      // Verify enhancement result
      const result = await enhancementHelper.extractEnhancementResult();
      
      expect(result.enhancedPrompt).toBeTruthy();
      expect(result.enhancedPrompt.length).toBeGreaterThan(simplePrompt.input.length);
      expect(result.suggestedTechniques.length).toBeGreaterThan(0);
      
      // Verify UI shows success state
      await expect(page.locator('[data-testid="enhanced-prompt"]')).toBeVisible();
      await expect(page.locator('[data-testid="technique-chip"]').first()).toBeVisible();
    });

    // Step 8: Interact with enhancement result
    await test.step('Interact with enhancement result', async () => {
      // Copy enhanced prompt
      const copiedText = await enhancementHelper.copyEnhancedPrompt();
      expect(copiedText).toBeTruthy();
      
      // View technique explanation
      const techniques = await page.locator('[data-testid="technique-chip"]').all();
      if (techniques.length > 0) {
        const firstTechnique = await techniques[0].textContent();
        if (firstTechnique) {
          const explanation = await enhancementHelper.viewTechniqueExplanation(firstTechnique);
          expect(explanation).toBeTruthy();
        }
      }
      
      // Provide feedback
      await enhancementHelper.provideFeedback(5, 'Great enhancement!');
    });

    // Performance assertion
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(60000); // Complete flow should take less than 60 seconds
    
    // Log performance metrics
    console.log(`New user flow completed in ${totalTime}ms`);
  });

  test('new user can access help resources', async ({ page }) => {
    // Quick registration
    await authHelper.register(testUser);
    
    // Check for help resources
    await test.step('Access help resources', async () => {
      // Look for help button/link
      const helpButton = page.locator('[data-testid="help-button"], a:has-text("Help")');
      if (await helpButton.isVisible()) {
        await helpButton.click();
        
        // Verify help content
        await expect(page.locator('text=Getting Started')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=How to use BetterPrompts')).toBeVisible();
      }
    });
  });

  test('new user sees appropriate tooltips and guidance', async ({ page }) => {
    await authHelper.register(testUser);
    await page.goto('/enhance');
    
    await test.step('Check for new user guidance', async () => {
      // Hover over elements to trigger tooltips
      const enhanceButton = page.locator('button:has-text("Enhance")');
      await enhanceButton.hover();
      
      // Check for tooltip
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.isVisible({ timeout: 2000 })) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText).toContain('Click to enhance your prompt');
      }
      
      // Check for first-time user banner
      const welcomeBanner = page.locator('[data-testid="welcome-banner"]');
      if (await welcomeBanner.isVisible()) {
        await expect(welcomeBanner).toContainText(/Welcome|Get started/i);
      }
    });
  });

  test('responsive design works for new user flow', async ({ page, viewport }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await test.step('Mobile registration', async () => {
      await page.goto('/register');
      
      // Verify mobile-friendly layout
      const registrationForm = page.locator('form');
      await expect(registrationForm).toBeVisible();
      
      // Check that form is not cut off
      const formBox = await registrationForm.boundingBox();
      expect(formBox).toBeTruthy();
      if (formBox) {
        expect(formBox.width).toBeLessThanOrEqual(375);
      }
      
      // Fill form on mobile
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password);
      
      // Verify keyboard doesn't cover submit button
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeInViewport();
    });

    // Test on tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await test.step('Tablet enhancement', async () => {
      await authHelper.register(testUser);
      await page.goto('/enhance');
      
      // Verify layout adapts properly
      const promptTextarea = page.locator('textarea[placeholder*="Enter your prompt"]');
      await expect(promptTextarea).toBeVisible();
      
      const textareaBox = await promptTextarea.boundingBox();
      expect(textareaBox).toBeTruthy();
      if (textareaBox) {
        expect(textareaBox.width).toBeGreaterThan(300);
        expect(textareaBox.width).toBeLessThan(750);
      }
    });
  });

  test('error handling during registration', async ({ page }) => {
    await page.goto('/register');
    
    await test.step('Handle duplicate email', async () => {
      // First registration
      await authHelper.register(testUser);
      await authHelper.logout();
      
      // Try to register with same email
      await page.goto('/register');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="username"]', 'different_username');
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirm_password"]', testUser.password);
      await page.check('input[name="acceptTerms"]');
      await page.click('button[type="submit"]');
      
      // Verify error message
      await expect(page.locator('text=Email already registered')).toBeVisible({ timeout: 5000 });
    });
    
    await test.step('Handle weak password', async () => {
      await page.goto('/register');
      const weakUser = AuthHelper.generateTestUser('weak');
      
      await page.fill('input[name="email"]', weakUser.email);
      await page.fill('input[name="username"]', weakUser.username);
      await page.fill('input[name="password"]', '123'); // Weak password
      await page.fill('input[name="confirm_password"]', '123');
      await page.check('input[name="acceptTerms"]');
      await page.click('button[type="submit"]');
      
      // Verify password strength error
      await expect(page.locator('text=/password.*(?:weak|strong|requirements)/i')).toBeVisible({ timeout: 5000 });
    });
  });
});