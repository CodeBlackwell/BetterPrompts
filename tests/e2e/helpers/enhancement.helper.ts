import { Page, expect } from '@playwright/test';

export interface EnhancementOptions {
  autoApply?: boolean;
  targetModel?: string;
  techniques?: string[];
  context?: Record<string, any>;
}

export interface EnhancementResult {
  enhancedPrompt: string;
  suggestedTechniques: string[];
  intent: {
    category: string;
    complexity: number;
  };
  metadata?: Record<string, any>;
}

export class EnhancementHelper {
  constructor(private page: Page) {}

  async navigateToEnhancePage(): Promise<void> {
    await this.page.goto('/enhance');
    await this.page.waitForLoadState('networkidle');
    
    // Verify page loaded
    await expect(this.page.locator('textarea[placeholder*="Enter your prompt"]')).toBeVisible();
  }

  async enhancePrompt(
    prompt: string, 
    options?: EnhancementOptions
  ): Promise<EnhancementResult> {
    // Clear and enter prompt
    const promptTextarea = this.page.locator('textarea[placeholder*="Enter your prompt"]');
    await promptTextarea.clear();
    await promptTextarea.fill(prompt);
    
    // Set options if provided
    if (options?.targetModel) {
      const modelSelector = this.page.locator('[data-testid="model-selector"]');
      if (await modelSelector.isVisible()) {
        await modelSelector.selectOption(options.targetModel);
      }
    }
    
    if (options?.techniques && options.techniques.length > 0) {
      // Select specific techniques if UI supports it
      for (const technique of options.techniques) {
        const techniqueCheckbox = this.page.locator(`[data-testid="technique-${technique}"]`);
        if (await techniqueCheckbox.isVisible()) {
          await techniqueCheckbox.check();
        }
      }
    }
    
    // Click enhance button
    await this.page.click('button:has-text("Enhance")');
    
    // Wait for loading to complete
    await this.waitForEnhancement();
    
    // Extract results
    return await this.extractEnhancementResult();
  }

  async waitForEnhancement(timeout = 15000): Promise<void> {
    // Wait for loading spinner to appear and disappear
    const loadingSpinner = this.page.locator('[data-testid="loading-spinner"]');
    
    // First wait for it to appear (enhancement started)
    await loadingSpinner.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
      // Spinner might be too fast to catch
    });
    
    // Then wait for it to disappear (enhancement complete)
    await loadingSpinner.waitFor({ state: 'hidden', timeout });
    
    // Ensure enhanced prompt is visible
    await this.page.locator('[data-testid="enhanced-prompt"]').waitFor({ state: 'visible' });
  }

  async extractEnhancementResult(): Promise<EnhancementResult> {
    // Extract enhanced prompt
    const enhancedPrompt = await this.page.locator('[data-testid="enhanced-prompt"]').textContent() || '';
    
    // Extract suggested techniques
    const techniquesElements = await this.page.locator('[data-testid="technique-chip"]').all();
    const suggestedTechniques = await Promise.all(
      techniquesElements.map(el => el.textContent())
    );
    
    // Extract intent information if available
    const intentCategory = await this.page.locator('[data-testid="intent-category"]').textContent().catch(() => 'unknown');
    const intentComplexity = await this.page.locator('[data-testid="intent-complexity"]').textContent().catch(() => '0');
    
    return {
      enhancedPrompt: enhancedPrompt.trim(),
      suggestedTechniques: suggestedTechniques.filter(t => t).map(t => t!.trim()),
      intent: {
        category: intentCategory || 'unknown',
        complexity: parseFloat(intentComplexity || '0')
      }
    };
  }

  async copyEnhancedPrompt(): Promise<string> {
    await this.page.click('[data-testid="copy-button"]');
    
    // Wait for copy confirmation
    await expect(this.page.locator('text=Copied!')).toBeVisible();
    
    // Get clipboard content
    const clipboardText = await this.page.evaluate(() => navigator.clipboard.readText());
    return clipboardText;
  }

  async saveToFavorites(): Promise<void> {
    const favoriteButton = this.page.locator('[data-testid="favorite-button"]');
    await favoriteButton.click();
    
    // Wait for confirmation
    await expect(this.page.locator('text=Saved to favorites')).toBeVisible();
  }

  async viewTechniqueExplanation(techniqueName: string): Promise<string> {
    // Click on the technique chip
    await this.page.click(`[data-testid="technique-chip"]:has-text("${techniqueName}")`);
    
    // Wait for explanation modal/tooltip
    const explanation = this.page.locator('[data-testid="technique-explanation"]');
    await explanation.waitFor({ state: 'visible' });
    
    const explanationText = await explanation.textContent() || '';
    
    // Close explanation
    await this.page.keyboard.press('Escape');
    
    return explanationText;
  }

  async provideFeedback(rating: number, comment?: string): Promise<void> {
    // Open feedback modal if needed
    const feedbackButton = this.page.locator('[data-testid="feedback-button"]');
    if (await feedbackButton.isVisible()) {
      await feedbackButton.click();
    }
    
    // Select rating (assuming star rating)
    await this.page.click(`[data-testid="rating-star-${rating}"]`);
    
    // Add comment if provided
    if (comment) {
      await this.page.fill('[data-testid="feedback-comment"]', comment);
    }
    
    // Submit feedback
    await this.page.click('[data-testid="submit-feedback"]');
    
    // Wait for confirmation
    await expect(this.page.locator('text=Thank you for your feedback')).toBeVisible();
  }

  async getErrorMessage(): Promise<string | null> {
    const errorElement = this.page.locator('[data-testid="error-message"]');
    if (await errorElement.isVisible()) {
      return await errorElement.textContent();
    }
    return null;
  }

  async clearPrompt(): Promise<void> {
    const promptTextarea = this.page.locator('textarea[placeholder*="Enter your prompt"]');
    await promptTextarea.clear();
  }

  // Validation helpers
  async validateEnhancementQuality(
    originalPrompt: string,
    enhancedPrompt: string,
    expectedPatterns: RegExp[]
  ): Promise<boolean> {
    // Enhanced prompt should be longer
    if (enhancedPrompt.length <= originalPrompt.length) {
      return false;
    }
    
    // Should match expected patterns
    for (const pattern of expectedPatterns) {
      if (!pattern.test(enhancedPrompt)) {
        return false;
      }
    }
    
    return true;
  }
}