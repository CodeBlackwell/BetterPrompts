/**
 * Security utilities for frontend protection
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  // Configure DOMPurify
  const config = {
    ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'strong', 'em', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  };

  // Sanitize the input
  const clean = DOMPurify.sanitize(input, config);
  
  // Additional cleanup for common XSS vectors
  return clean
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>]/g, (match) => {
      return match === '<' ? '&lt;' : '&gt;';
    });
}

/**
 * Validate input against common attack patterns
 */
export function validateInput(input: string, type: 'text' | 'email' | 'url' | 'search' = 'text'): boolean {
  // Common malicious patterns
  const sqlInjectionPattern = /(\b(union|select|insert|update|delete|drop|exec|script)\b)/i;
  const xssPattern = /<script|javascript:|on\w+\s*=|<iframe|<object|<embed/i;
  
  // Check for malicious patterns
  if (sqlInjectionPattern.test(input) || xssPattern.test(input)) {
    return false;
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(input);
      
    case 'url':
      try {
        const url = new URL(input);
        const allowedProtocols = ['http:', 'https:', 'mailto:'];
        return allowedProtocols.includes(url.protocol);
      } catch {
        return false;
      }
      
    case 'search':
      // Remove potentially dangerous characters for search
      const cleanSearch = input.replace(/[';"\-\-]/g, '');
      return cleanSearch.length > 0 && cleanSearch.length <= 100;
      
    default:
      // Basic text validation
      return input.length > 0 && input.length <= 1000 && !/<|>/.test(input);
  }
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get CSRF token from meta tag
 */
export function getCSRFToken(): string | null {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

/**
 * Add CSRF token to request headers
 */
export function addCSRFHeader(headers: Record<string, string> = {}): Record<string, string> {
  const token = getCSRFToken();
  if (token) {
    headers['X-CSRF-Token'] = token;
  }
  return headers;
}

/**
 * Validate file uploads
 */
export function validateFileUpload(file: File, options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
} = {}): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check file extension
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }

  // Additional checks for double extensions
  const doubleExtensionPattern = /\.(php|exe|sh|bat|cmd|com|scr|vbs|js)\./i;
  if (doubleExtensionPattern.test(file.name)) {
    return { valid: false, error: 'Suspicious file name detected' };
  }

  return { valid: true };
}

/**
 * Secure random string generator
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a URL is safe to redirect to
 */
export function isSafeRedirect(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin);
    
    // Only allow redirects to same origin or whitelisted domains
    const whitelist = [
      window.location.origin,
      'https://betterprompts.ai',
      'https://app.betterprompts.ai'
    ];
    
    return whitelist.some(allowed => urlObj.href.startsWith(allowed));
  } catch {
    return false;
  }
}

/**
 * Sanitize JSON for safe parsing
 */
export function safeJsonParse<T = any>(json: string, fallback: T): T {
  try {
    // Remove any potential script injections before parsing
    const sanitized = json.replace(/<script[^>]*>.*?<\/script>/gi, '');
    return JSON.parse(sanitized);
  } catch {
    return fallback;
  }
}

/**
 * Rate limiter for client-side operations
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

/**
 * Content Security Policy helper
 */
export function validateScriptSource(src: string): boolean {
  const allowedSources = [
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://cdnjs.cloudflare.com',
    window.location.origin
  ];
  
  try {
    const url = new URL(src);
    return allowedSources.some(allowed => url.href.startsWith(allowed));
  } catch {
    return false;
  }
}

/**
 * Secure storage wrapper with encryption
 */
export class SecureStorage {
  private encryptionKey: CryptoKey | null = null;
  
  async init(): Promise<void> {
    // Generate or retrieve encryption key
    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  async setItem(key: string, value: any): Promise<void> {
    if (!this.encryptionKey) throw new Error('SecureStorage not initialized');
    
    const data = JSON.stringify(value);
    const encoded = new TextEncoder().encode(data);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    const encoded64 = btoa(String.fromCharCode(...combined));
    sessionStorage.setItem(key, encoded64);
  }
  
  async getItem<T = any>(key: string): Promise<T | null> {
    if (!this.encryptionKey) throw new Error('SecureStorage not initialized');
    
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    
    try {
      const combined = Uint8Array.from(atob(item), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encrypted
      );
      
      const decoded = new TextDecoder().decode(decrypted);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
  
  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }
  
  clear(): void {
    sessionStorage.clear();
  }
}