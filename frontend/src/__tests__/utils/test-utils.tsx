import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AccessibilityProvider } from '@/components/providers/AccessibilityProvider'
import { Toaster } from '@/components/ui/toaster'
import userEvent from '@testing-library/user-event'

// Create a custom render function that includes all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AccessibilityProvider>
        {children}
        <Toaster />
      </AccessibilityProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const user = userEvent.setup()
  const utils = render(ui, { wrapper: AllTheProviders, ...options })
  
  return {
    ...utils,
    user,
  }
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Utility functions for common test scenarios
export const waitForLoadingToFinish = async () => {
  const { waitFor } = await import('@testing-library/react')
  await waitFor(() => {
    const loadingElements = document.querySelectorAll('[aria-busy="true"]')
    expect(loadingElements.length).toBe(0)
  })
}

export const expectToBeAccessible = (container: HTMLElement) => {
  // Check for basic accessibility attributes
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea'
  )
  
  interactiveElements.forEach((element) => {
    // Check if element has accessible name
    const hasAriaLabel = element.hasAttribute('aria-label')
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby')
    const hasTitle = element.hasAttribute('title')
    const hasText = element.textContent && element.textContent.trim().length > 0
    
    expect(
      hasAriaLabel || hasAriaLabelledBy || hasTitle || hasText
    ).toBeTruthy()
  })
}

// Mock data generators
export const createMockUser = (overrides = {}) => ({
  id: '123',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createMockTechnique = (overrides = {}) => ({
  id: 'tech-1',
  name: 'Chain of Thought',
  description: 'Break down complex problems into steps',
  confidence: 0.85,
  selected: false,
  ...overrides,
})

export const createMockEnhancement = (overrides = {}) => ({
  id: 'enh-1',
  originalPrompt: 'Help me write a story',
  enhancedPrompt: 'Let\'s write a story step by step...',
  techniques: ['Chain of Thought', 'Few-shot Learning'],
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Mock API responses
export const mockApiResponses = {
  success: (data: any) => ({
    success: true,
    data,
    error: null,
  }),
  error: (message: string, code = 'ERROR') => ({
    success: false,
    data: null,
    error: { message, code },
  }),
}

// Test IDs for consistent querying
export const testIds = {
  enhancementFlow: {
    container: 'enhancement-flow',
    input: 'prompt-input',
    submitButton: 'submit-prompt',
    cancelButton: 'cancel-enhancement',
    techniquesList: 'techniques-list',
    progressIndicator: 'streaming-progress',
    resultDisplay: 'enhancement-result',
    feedbackButton: 'feedback-button',
  },
  auth: {
    loginForm: 'login-form',
    registerForm: 'register-form',
    emailInput: 'email-input',
    passwordInput: 'password-input',
    usernameInput: 'username-input',
    submitButton: 'auth-submit',
    errorMessage: 'auth-error',
    loadingSpinner: 'auth-loading',
  },
  techniqueCard: {
    container: 'technique-card',
    checkbox: 'technique-checkbox',
    confidenceBar: 'confidence-bar',
    tooltip: 'technique-tooltip',
  },
}

// Helper to mock fetch responses
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response)
  )
}

// Helper to test keyboard interactions
export const pressKey = async (key: string, element?: HTMLElement) => {
  const target = element || document.body
  const user = userEvent.setup()
  
  switch (key.toLowerCase()) {
    case 'enter':
      await user.keyboard('{Enter}')
      break
    case 'escape':
    case 'esc':
      await user.keyboard('{Escape}')
      break
    case 'tab':
      await user.keyboard('{Tab}')
      break
    case 'space':
      await user.keyboard(' ')
      break
    default:
      await user.keyboard(key)
  }
}

// Helper to test form validation
export const testFormValidation = async (
  getByTestId: (testId: string) => HTMLElement,
  testId: string,
  invalidValue: string,
  expectedError: string
) => {
  const input = getByTestId(testId) as HTMLInputElement
  const user = userEvent.setup()
  
  await user.clear(input)
  await user.type(input, invalidValue)
  await user.tab() // Trigger blur
  
  const errorElement = await screen.findByText(expectedError)
  expect(errorElement).toBeInTheDocument()
}

// Export screen separately for convenience
export { screen } from '@testing-library/react'