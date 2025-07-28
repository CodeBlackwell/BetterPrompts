import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// API Configuration
export interface APIConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Request/Response Types
export interface EnhanceRequest {
  text: string;
  context?: Record<string, any>;
  prefer_techniques?: string[];
  exclude_techniques?: string[];
  target_complexity?: string;
}

export interface EnhanceResponse {
  id: string;
  original_text: string;
  enhanced_text: string;
  enhanced_prompt: string;
  intent: string;
  complexity: string;
  techniques: string[];
  techniques_used: string[];
  confidence: number;
  processing_time_ms: number;
  enhanced: boolean;
  metadata?: Record<string, any>;
}

export interface Technique {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity: number;
  examples: string[];
  parameters?: Record<string, any>;
  effectiveness: {
    overall: number;
    byIntent: Record<string, number>;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  start_date?: string;
  end_date?: string;
  intent?: string;
  technique?: string;
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PromptHistoryItem {
  id: string;
  user_id: string;
  original_text: string;
  enhanced_text: string;
  intent: string;
  complexity: string;
  techniques_used: string[];
  confidence: number;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  permissions: string[];
  rate_limit?: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  request_id?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  delivered_at?: string;
  response_status?: number;
  attempts: number;
  next_retry?: string;
}

// API Client with retry logic and type safety
export class BetterPromptsAPIClient {
  private client: AxiosInstance;
  private config: APIConfig;
  private requestId: string;

  constructor(config: APIConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
    this.requestId = uuidv4();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add API key if provided
        if (this.config.apiKey) {
          config.headers['X-API-Key'] = this.config.apiKey;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.requestId;

        // Log request
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data,
        });

        return config;
      },
      (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => {
        // Log response
        console.log(`[API] Response ${response.status}`, {
          url: response.config.url,
          data: response.data,
          headers: response.headers,
        });

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as AxiosRequestConfig & { _retry?: number };
        
        // Initialize retry count
        if (!config._retry) {
          config._retry = 0;
        }

        // Check if we should retry
        if (
          config._retry < this.config.retryAttempts! &&
          this.shouldRetry(error)
        ) {
          config._retry++;
          
          console.log(`[API] Retrying request (${config._retry}/${this.config.retryAttempts})...`);
          
          // Wait before retrying
          await this.delay(this.config.retryDelay! * config._retry);
          
          return this.client(config);
        }

        // Log error
        console.error('[API] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    // Don't retry if no response (network error)
    if (!error.response) return true;

    // Retry on 5xx errors or rate limit
    const status = error.response.status;
    return status >= 500 || status === 429;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Authentication endpoints
  async register(credentials: AuthCredentials & { name: string }): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', credentials);
    return response.data;
  }

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  // Enhancement endpoints
  async enhance(request: EnhanceRequest): Promise<EnhanceResponse> {
    const response = await this.client.post<EnhanceResponse>('/enhance', request);
    return response.data;
  }

  async batchEnhance(requests: EnhanceRequest[]): Promise<{ job_id: string }> {
    const response = await this.client.post<{ job_id: string }>('/batch', {
      requests,
    });
    return response.data;
  }

  // Techniques endpoints
  async getTechniques(filter?: { category?: string; complexity?: number }): Promise<Technique[]> {
    const response = await this.client.get<Technique[]>('/techniques', {
      params: filter,
    });
    return response.data;
  }

  // History endpoints
  async getHistory(params?: PaginationParams): Promise<PaginatedResponse<PromptHistoryItem>> {
    const response = await this.client.get<PaginatedResponse<PromptHistoryItem>>('/history', {
      params,
    });
    return response.data;
  }

  async getHistoryItem(id: string): Promise<PromptHistoryItem> {
    const response = await this.client.get<PromptHistoryItem>(`/history/${id}`);
    return response.data;
  }

  async deleteHistoryItem(id: string): Promise<void> {
    await this.client.delete(`/history/${id}`);
  }

  // API Key management
  async createAPIKey(name: string, permissions?: string[]): Promise<APIKey> {
    const response = await this.client.post<APIKey>('/dev/api-keys', {
      name,
      permissions,
    });
    return response.data;
  }

  async getAPIKeys(): Promise<APIKey[]> {
    const response = await this.client.get<APIKey[]>('/dev/api-keys');
    return response.data;
  }

  async deleteAPIKey(id: string): Promise<void> {
    await this.client.delete(`/dev/api-keys/${id}`);
  }

  // Webhook management
  async createWebhook(config: WebhookConfig): Promise<{ id: string; secret: string }> {
    const response = await this.client.post<{ id: string; secret: string }>('/webhooks', config);
    return response.data;
  }

  async getWebhooks(): Promise<WebhookConfig[]> {
    const response = await this.client.get<WebhookConfig[]>('/webhooks');
    return response.data;
  }

  async updateWebhook(id: string, config: Partial<WebhookConfig>): Promise<void> {
    await this.client.put(`/webhooks/${id}`, config);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.client.delete(`/webhooks/${id}`);
  }

  async getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const response = await this.client.get<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`);
    return response.data;
  }

  // Stats endpoint
  async getStats(): Promise<{
    total_enhancements: number;
    techniques_usage: Record<string, number>;
    average_confidence: number;
    average_processing_time: number;
  }> {
    const response = await this.client.get('/stats');
    return response.data;
  }

  // Rate limit helpers
  getRateLimitHeaders(response: AxiosResponse): RateLimitHeaders | null {
    const headers = response.headers;
    if (
      headers['x-ratelimit-limit'] &&
      headers['x-ratelimit-remaining'] &&
      headers['x-ratelimit-reset']
    ) {
      return {
        'X-RateLimit-Limit': headers['x-ratelimit-limit'],
        'X-RateLimit-Remaining': headers['x-ratelimit-remaining'],
        'X-RateLimit-Reset': headers['x-ratelimit-reset'],
      };
    }
    return null;
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Clear authentication token
  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  // Set API key
  setAPIKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.client.defaults.headers.common['X-API-Key'] = apiKey;
  }

  // Get current request ID
  getRequestId(): string {
    return this.requestId;
  }

  // Generate new request ID
  generateNewRequestId(): void {
    this.requestId = uuidv4();
  }
}