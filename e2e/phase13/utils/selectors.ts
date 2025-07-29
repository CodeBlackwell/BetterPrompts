/**
 * Centralized selectors for Phase 13 journey tests
 * 
 * This file contains all the selectors used across journey tests
 * to make maintenance easier and reduce duplication.
 */

export const selectors = {
  // Authentication selectors
  auth: {
    emailInput: '[name="email"], #email',
    passwordInput: '[name="password"], #password',
    confirmPasswordInput: '[name="confirmPassword"]',
    submitButton: 'button[type="submit"]',
    loginLink: 'a:has-text("Login"), [data-testid="login-link"]',
    registerLink: 'a:has-text("Register"), [data-testid="register-link"]',
    logoutButton: 'button:has-text("Logout"), [data-testid="logout-button"]',
  },

  // Navigation selectors
  navigation: {
    logo: '[data-testid="logo"], .logo',
    mainMenu: '[role="navigation"], nav',
    mobileMenu: '[aria-label*="menu" i], [data-testid="mobile-menu"]',
    featuresLink: 'a:has-text("Features")',
    pricingLink: 'a:has-text("Pricing")',
    docsLink: 'a:has-text("Documentation"), a:has-text("Docs")',
    dashboardLink: 'a:has-text("Dashboard")',
    settingsLink: 'a:has-text("Settings")',
  },

  // Enhancement selectors
  enhancement: {
    promptTextarea: 'textarea[name="prompt"], textarea[placeholder*="prompt" i]',
    enhanceButton: 'button:has-text("Enhance")',
    techniqueSelect: 'select[name="technique"], [data-testid="technique-select"]',
    enhancedResult: '.enhanced-result, [data-testid="enhanced-result"]',
    copyButton: 'button:has-text("Copy"), [data-testid="copy-button"]',
    saveButton: 'button:has-text("Save"), [data-testid="save-button"]',
    historyLink: 'a:has-text("History"), [data-testid="history-link"]',
  },

  // Batch processing selectors
  batch: {
    uploadInput: 'input[type="file"]',
    processButton: 'button:has-text("Process")',
    batchId: '[data-testid="batch-id"], .batch-identifier',
    batchStatus: '[data-testid="batch-status"], .batch-status',
    batchProgress: '[data-testid="batch-progress"], .progress-indicator',
    errorCount: '[data-testid="error-count"], .error-indicator',
    viewErrorsButton: '[data-testid="view-errors"], button:has-text("View Errors")',
    errorList: '[data-testid="error-list"], .error-details',
    errorItem: '[data-testid="error-item"], .error-entry',
    retryCheckbox: '[data-testid="retry-checkbox"], input[type="checkbox"]',
    retryButton: '[data-testid="retry-selected"], button:has-text("Retry")',
    downloadButton: '[data-testid="download-results"], button:has-text("Download")',
    successCount: '[data-testid="success-count"], .success-metric',
    failureCount: '[data-testid="failure-count"], .failure-metric',
  },

  // API/Developer selectors
  developer: {
    apiDocsLink: 'a:has-text("API Documentation"), [data-testid="api-docs"]',
    createApiKeyButton: '[data-testid="create-api-key"], button:has-text("Generate")',
    apiKeyValue: '[data-testid="api-key-value"], .api-key-display',
    webhookSection: '[data-testid="webhooks-section"], .webhooks',
    addWebhookButton: '[data-testid="add-webhook"], button:has-text("Add Webhook")',
    webhookUrl: '[name="webhookUrl"]',
    webhookId: '[data-testid="webhook-id"], .webhook-identifier',
    testWebhookButton: '[data-testid="test-webhook"], button:has-text("Test")',
    usageMetrics: {
      totalCalls: '[data-testid="total-api-calls"], .metric-total-calls',
      successRate: '[data-testid="success-rate"], .metric-success-rate',
      avgResponseTime: '[data-testid="avg-response-time"], .metric-response-time',
      quotaUsed: '[data-testid="quota-used"], .metric-quota',
    },
  },

  // Settings selectors
  settings: {
    profileSection: '[data-testid="profile-settings"], .profile-section',
    preferencesSection: '[data-testid="preferences"], .preferences-section',
    themeToggle: '[data-testid="theme-toggle"], [role="switch"]',
    languageSelect: 'select[name="language"], [data-testid="language-select"]',
    notificationToggle: '[name="notifications"], [data-testid="notifications-toggle"]',
    saveButton: 'button:has-text("Save"), [data-testid="save-settings"]',
  },

  // Mobile selectors
  mobile: {
    hamburgerMenu: '[aria-label*="menu" i], [data-testid="mobile-menu-button"]',
    voiceInputButton: '[aria-label*="voice" i], [data-testid="voice-input"]',
    shareButton: '[aria-label*="share" i], button:has-text("Share")',
    shareMenu: '.share-menu, [role="menu"]',
    offlineIndicator: '[data-testid="offline-indicator"], .offline-badge',
    syncIndicator: '[data-testid="sync-indicator"], .syncing',
  },

  // Accessibility selectors
  accessibility: {
    skipLink: 'a:contains("skip"), [data-testid="skip-link"]',
    landmarks: {
      main: 'main, [role="main"]',
      nav: 'nav, [role="navigation"]',
      banner: 'header, [role="banner"]',
      contentinfo: 'footer, [role="contentinfo"]',
    },
    liveRegion: '[aria-live]',
    errorAlert: '[role="alert"], .error',
    dialog: '[role="dialog"]',
    focusableElements: 'a, button, input, textarea, select, [tabindex]',
  },

  // History/Search selectors
  history: {
    searchInput: '[data-testid="search-input"], input[placeholder*="Search"]',
    searchButton: '[data-testid="search-button"], button:has-text("Search")',
    techniqueFilter: '[data-testid="technique-filter"], select[name="technique"]',
    dateFilter: '[data-testid="date-filter"], input[type="date"]',
    searchResults: '[data-testid="search-results"], .results-container',
    resultItem: '[data-testid="result-item"], .search-result',
    exportButton: '[data-testid="export-search"], button:has-text("Export")',
    historyItem: '.history-item, tr',
  },

  // Reports selectors
  reports: {
    reportsNav: '[data-testid="reports-nav"], a:has-text("Reports")',
    reportTypeSelect: '[name="reportType"]',
    formatSelect: '[name="format"]',
    generateButton: '[data-testid="generate-report"], button:has-text("Generate")',
    includeBatchCheckbox: '[name="includeBatchResults"]',
  },

  // Plan/Billing selectors
  billing: {
    planCard: '[data-testid="plan-card"], .pricing-plan',
    proPlan: '[data-testid="plan-pro"], [data-plan="pro"]',
    upgradeButton: '[data-testid="upgrade-button"], button:has-text("Upgrade")',
    currentLimits: '[data-testid="current-limits"], .account-limits',
    testModeBanner: '[data-testid="test-mode-banner"], .test-mode',
  },

  // Common UI elements
  common: {
    spinner: '.spinner, [data-testid="loading"]',
    modal: '[role="dialog"], .modal',
    closeButton: 'button[aria-label="Close"], [data-testid="close-button"]',
    confirmButton: 'button:has-text("Confirm")',
    cancelButton: 'button:has-text("Cancel")',
    notification: '.notification, [role="status"]',
    errorMessage: '.error-message, [data-testid="error-message"]',
    successMessage: '.success-message, [data-testid="success-message"]',
  },
};

/**
 * Helper function to wait for any of multiple selectors
 */
export async function waitForAnySelector(page: any, selectors: string[], options?: { timeout?: number }) {
  const timeout = options?.timeout || 30000;
  const endTime = Date.now() + timeout;
  
  while (Date.now() < endTime) {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        return { selector, element };
      }
    }
    await page.waitForTimeout(100);
  }
  
  throw new Error(`None of the selectors were found: ${selectors.join(', ')}`);
}

/**
 * Get selector with fallback
 */
export function getSelectorWithFallback(...selectors: string[]): string {
  return selectors.join(', ');
}