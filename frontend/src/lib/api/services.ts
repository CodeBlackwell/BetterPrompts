import { apiClient } from './client'
import { cachedApiClient, cachedApi } from './cached-client'
import { hashText } from './cache'

// Types
export interface LoginRequest {
  email_or_username: string
  password: string
  remember_me?: boolean
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  confirm_password: string
  first_name?: string
  last_name?: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {
    id: string
    email: string
    username?: string
    full_name?: string
    first_name?: string
    last_name?: string
    roles?: string[]
    created_at?: string
    updated_at?: string
  }
}

export interface EnhanceRequest {
  text: string
  intent?: string
  complexity?: 'simple' | 'moderate' | 'complex'
  target_model?: string
  techniques?: string[]
  context?: Record<string, any>
}

export interface EnhanceResponse {
  enhanced_prompt: string
  suggested_techniques: string[]
  intent: string
  complexity: string
  confidence_score: number
  metadata?: Record<string, any>
}

export interface AnalyzeRequest {
  text: string
  context?: Record<string, any>
}

export interface AnalyzeResponse {
  intent: string
  complexity: string
  confidence: number
  suggested_techniques: string[]
  metadata?: Record<string, any>
}

export interface Technique {
  id: string
  name: string
  description: string
  category: string
  effectiveness_score: number
  use_cases: string[]
}

export interface PromptHistoryItem {
  id: string
  user_id: string
  original_input: string
  enhanced_output: string
  intent: string
  complexity: string
  techniques_used: string[]
  technique_scores?: Record<string, number>
  processing_time_ms: number
  token_count: number
  feedback_score?: number
  feedback_text?: string
  is_favorite: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at?: string
}

export interface FeedbackRequest {
  prompt_id: string
  rating: number
  feedback?: string
  technique_effectiveness?: Record<string, number>
}

// Authentication Services
export const authService = {
  register: (data: RegisterRequest) => 
    apiClient.post<AuthResponse>('/auth/register', data),
  
  login: (data: LoginRequest) => 
    apiClient.post<AuthResponse>('/auth/login', data),
  
  refreshToken: (data: RefreshTokenRequest) => 
    apiClient.post<AuthResponse>('/auth/refresh', data),
  
  verifyEmail: (token: string) => 
    apiClient.post('/auth/verify-email', { token }),
  
  getProfile: () => 
    cachedApi.getProfile(),
  
  updateProfile: (data: Partial<{ name: string; email: string }>) => 
    apiClient.put('/auth/profile', data),
  
  changePassword: (data: { current_password: string; new_password: string }) => 
    apiClient.post('/auth/change-password', data),
  
  logout: () => 
    apiClient.post('/auth/logout'),
}

// Main Enhancement Services
export const promptService = {
  // Public endpoint (optional auth)
  analyze: (data: AnalyzeRequest) => 
    apiClient.post<AnalyzeResponse>('/analyze', data),
  
  // Protected endpoint
  enhance: (data: EnhanceRequest) => 
    apiClient.post<EnhanceResponse>('/enhance', data),
  
  // Get available techniques (cached for 30 minutes)
  getTechniques: () => 
    cachedApi.getTechniques(),
  
  // Select best techniques for a prompt
  selectTechniques: (data: { text: string; intent?: string; context?: any }) => 
    apiClient.post<{ techniques: string[]; reasoning: string }>('/techniques/select', data),
}

// History Services
export const historyService = {
  getHistory: (params?: { page?: number; limit?: number; search?: string; filter?: string }) => 
    cachedApi.getHistory(params?.page || 1, params?.limit || 10),
  
  getHistoryItem: (id: string) => 
    apiClient.get<PromptHistoryItem>(`/history/${id}`),
  
  deleteHistoryItem: (id: string) => 
    apiClient.delete(`/history/${id}`),
  
  toggleFavorite: (id: string) => 
    apiClient.put(`/history/${id}/favorite`),
  
  updateFeedback: (id: string, data: { rating: number; feedback?: string }) =>
    apiClient.put(`/history/${id}/feedback`, data),
}

// Feedback Service
export const feedbackService = {
  submitFeedback: (data: FeedbackRequest) => 
    apiClient.post('/feedback', data),
}

// Admin Services
export const adminService = {
  // User management
  getUsers: (params?: { limit?: number; offset?: number; search?: string }) => 
    apiClient.get('/admin/users', { params }),
  
  getUser: (id: string) => 
    apiClient.get(`/admin/users/${id}`),
  
  updateUser: (id: string, data: any) => 
    apiClient.put(`/admin/users/${id}`, data),
  
  deleteUser: (id: string) => 
    apiClient.delete(`/admin/users/${id}`),
  
  // Metrics
  getSystemMetrics: () => 
    apiClient.get('/admin/metrics'),
  
  getUsageMetrics: (params?: { start_date?: string; end_date?: string }) => 
    apiClient.get('/admin/metrics/usage', { params }),
  
  // Cache management
  clearCache: () => 
    apiClient.post('/admin/cache/clear'),
  
  invalidateUserCache: (userId: string) => 
    apiClient.post(`/admin/cache/invalidate/${userId}`),
}

// Developer API Services
export const developerService = {
  // API key management
  createAPIKey: (data: { name: string; scopes?: string[] }) => 
    apiClient.post('/dev/api-keys', data),
  
  getAPIKeys: () => 
    apiClient.get('/dev/api-keys'),
  
  deleteAPIKey: (id: string) => 
    apiClient.delete(`/dev/api-keys/${id}`),
  
  // Analytics
  getDeveloperUsage: (params?: { start_date?: string; end_date?: string }) => 
    apiClient.get('/dev/analytics/usage', { params }),
  
  getPerformanceMetrics: () => 
    apiClient.get('/dev/analytics/performance'),
}

// Utility function to handle API errors consistently
export const handleApiError = (error: any): string => {
  if (error.message) {
    return error.message
  }
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  return 'An unexpected error occurred'
}

// Export all services as a single object for convenience
export const api = {
  auth: authService,
  prompts: promptService,
  history: historyService,
  feedback: feedbackService,
  admin: adminService,
  developer: developerService,
}