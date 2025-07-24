// Simple cache implementation for API responses
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 100; // Maximum number of items in cache

  // Get item from cache
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  // Set item in cache
  set<T>(key: string, data: T, ttl = 5 * 60 * 1000): void { // Default 5 minutes
    // Implement simple LRU: remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Clear specific key or pattern
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    // Clear keys matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Get cache stats
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const apiCache = new SimpleCache();

// Cache key generators
export const cacheKeys = {
  techniques: () => 'techniques:list',
  technique: (id: string) => `technique:${id}`,
  enhancement: (textHash: string, techniques: string[]) => 
    `enhance:${textHash}:${techniques.sort().join(',')}`,
  analysis: (textHash: string) => `analyze:${textHash}`,
  userProfile: () => 'user:profile',
  promptHistory: (page: number, limit: number) => `history:${page}:${limit}`,
};

// Hash function for text (simple, not cryptographic)
export function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}