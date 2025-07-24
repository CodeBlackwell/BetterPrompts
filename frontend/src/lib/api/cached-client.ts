import { apiClient } from './client';
import { apiCache, cacheKeys, hashText } from './cache';
import type { AxiosRequestConfig } from 'redaxios';

// Cache TTLs for different endpoints
const CACHE_TTLS = {
  techniques: 30 * 60 * 1000, // 30 minutes
  enhancement: 10 * 60 * 1000, // 10 minutes
  analysis: 5 * 60 * 1000, // 5 minutes
  userProfile: 60 * 1000, // 1 minute
  promptHistory: 2 * 60 * 1000, // 2 minutes
};

class CachedApiClient {
  // GET with caching
  async get<T>(url: string, config?: AxiosRequestConfig, ttl?: number): Promise<T> {
    // Generate cache key from URL and params
    const cacheKey = this.generateCacheKey('GET', url, config?.params);
    
    // Check cache first
    const cached = apiCache.get<T>(cacheKey);
    if (cached !== null) {
      console.debug(`Cache hit for: ${cacheKey}`);
      return cached;
    }
    
    // Make request
    console.debug(`Cache miss for: ${cacheKey}`);
    const data = await apiClient.get<T>(url, config);
    
    // Determine TTL
    const cacheTtl = ttl || this.getDefaultTtl(url);
    
    // Cache the result
    apiCache.set(cacheKey, data, cacheTtl);
    
    return data;
  }

  // POST without caching (mutations should not be cached)
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // Clear related caches on mutations
    this.clearRelatedCaches(url);
    return apiClient.post<T>(url, data, config);
  }

  // PUT without caching
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    // Clear related caches on mutations
    this.clearRelatedCaches(url);
    return apiClient.put<T>(url, data, config);
  }

  // DELETE without caching
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Clear related caches on mutations
    this.clearRelatedCaches(url);
    return apiClient.delete<T>(url, config);
  }

  // Generate cache key from request details
  private generateCacheKey(method: string, url: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramStr}`;
  }

  // Get default TTL based on URL pattern
  private getDefaultTtl(url: string): number {
    if (url.includes('/techniques')) return CACHE_TTLS.techniques;
    if (url.includes('/enhance')) return CACHE_TTLS.enhancement;
    if (url.includes('/analyze')) return CACHE_TTLS.analysis;
    if (url.includes('/profile')) return CACHE_TTLS.userProfile;
    if (url.includes('/history')) return CACHE_TTLS.promptHistory;
    
    // Default TTL
    return 5 * 60 * 1000; // 5 minutes
  }

  // Clear caches related to the mutated endpoint
  private clearRelatedCaches(url: string): void {
    if (url.includes('/enhance')) {
      apiCache.clear('enhance:');
      apiCache.clear('history:');
    } else if (url.includes('/techniques')) {
      apiCache.clear('techniques:');
      apiCache.clear('technique:');
    } else if (url.includes('/profile')) {
      apiCache.clear('user:');
    } else if (url.includes('/history')) {
      apiCache.clear('history:');
    }
  }

  // Manual cache management methods
  clearCache(pattern?: string): void {
    apiCache.clear(pattern);
  }

  getCacheStats() {
    return apiCache.stats();
  }
}

// Export singleton instance
export const cachedApiClient = new CachedApiClient();

// Specific cached API methods
export const cachedApi = {
  // Get techniques with caching
  getTechniques: () => 
    cachedApiClient.get('/techniques', {}, CACHE_TTLS.techniques),
  
  // Get technique by ID with caching
  getTechnique: (id: string) =>
    cachedApiClient.get(`/techniques/${id}`, {}, CACHE_TTLS.techniques),
  
  // Get user profile with caching
  getProfile: () =>
    cachedApiClient.get('/auth/profile', {}, CACHE_TTLS.userProfile),
  
  // Get prompt history with caching
  getHistory: (page = 1, limit = 10) =>
    cachedApiClient.get('/history', { params: { page, limit } }, CACHE_TTLS.promptHistory),
};