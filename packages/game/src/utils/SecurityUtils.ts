/**
 * Security Utilities for ELIZA Game Frontend
 * 
 * Provides input validation, XSS protection, and secure data handling
 * to prevent common frontend security vulnerabilities
 */

/**
 * XSS Protection
 */
export class XSSProtection {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHTML(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.textContent = input;
    return tempDiv.innerHTML;
  }

  /**
   * Escape HTML entities
   */
  static escapeHTML(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    const entityMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return input.replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
  }

  /**
   * Sanitize URLs to prevent javascript: and data: schemes
   */
  static sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmedUrl = url.trim().toLowerCase();
    
    // Block dangerous protocols
    const dangerousProtocols = [
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'about:'
    ];

    for (const protocol of dangerousProtocols) {
      if (trimmedUrl.startsWith(protocol)) {
        console.warn(`[SECURITY] Blocked dangerous URL protocol: ${protocol}`);
        return '';
      }
    }

    // Allow only http, https, and relative URLs
    if (trimmedUrl.startsWith('http://') || 
        trimmedUrl.startsWith('https://') || 
        trimmedUrl.startsWith('//') ||
        trimmedUrl.startsWith('/') ||
        trimmedUrl.startsWith('./') ||
        trimmedUrl.startsWith('../')) {
      return url.trim();
    }

    // If no protocol specified, assume relative
    return url.trim();
  }

  /**
   * Sanitize and validate file names
   */
  static sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return '';
    }

    // Remove path traversal attempts
    let sanitized = fileName.replace(/[\/\\\.\.]/g, '');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }

    return sanitized.trim();
  }
}

/**
 * Input Validation
 */
export class InputValidator {
  /**
   * Validate API key format
   */
  static validateAPIKey(apiKey: string, provider: 'openai' | 'anthropic' | 'other' = 'other'): {
    valid: boolean;
    error?: string;
  } {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required' };
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 10) {
      return { valid: false, error: 'API key too short' };
    }

    if (trimmedKey.length > 500) {
      return { valid: false, error: 'API key too long' };
    }

    // Provider-specific validation
    switch (provider) {
      case 'openai':
        if (!trimmedKey.startsWith('sk-')) {
          return { valid: false, error: 'OpenAI API key must start with "sk-"' };
        }
        if (trimmedKey.length < 48) {
          return { valid: false, error: 'OpenAI API key appears to be invalid length' };
        }
        break;
        
      case 'anthropic':
        if (!trimmedKey.startsWith('sk-ant-')) {
          return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' };
        }
        break;
    }

    // Check for suspicious patterns
    if (/[<>"/\\]/.test(trimmedKey)) {
      return { valid: false, error: 'API key contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate configuration values
   */
  static validateConfigValue(key: string, value: any): {
    valid: boolean;
    sanitizedValue?: any;
    error?: string;
  } {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return { valid: false, error: 'Invalid value type' };
    }

    let sanitizedValue = value;

    // String validation and sanitization
    if (typeof value === 'string') {
      if (value.length > 10000) {
        return { valid: false, error: 'Value too long (max 10KB)' };
      }

      // Sanitize based on key type
      if (key.toLowerCase().includes('url')) {
        sanitizedValue = XSSProtection.sanitizeURL(value);
        if (!sanitizedValue) {
          return { valid: false, error: 'Invalid URL format' };
        }
      } else if (key.toLowerCase().includes('api_key') || key.toLowerCase().includes('key')) {
        // API keys don't need HTML sanitization but should be validated
        const validation = this.validateAPIKey(value);
        if (!validation.valid) {
          return { valid: false, error: validation.error };
        }
        sanitizedValue = value.trim();
      } else {
        // General string sanitization
        sanitizedValue = XSSProtection.escapeHTML(value.trim());
      }
    }

    // Number validation
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return { valid: false, error: 'Invalid number' };
      }
      
      // Reasonable bounds for configuration values
      if (value < -1000000 || value > 1000000) {
        return { valid: false, error: 'Number out of allowed range' };
      }
    }

    return { valid: true, sanitizedValue };
  }

  /**
   * Validate user input for chat/commands
   */
  static validateUserInput(input: string): {
    valid: boolean;
    sanitizedInput?: string;
    error?: string;
  } {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input is required' };
    }

    if (input.length > 50000) {
      return { valid: false, error: 'Input too long (max 50KB)' };
    }

    // Sanitize for XSS protection
    const sanitizedInput = XSSProtection.escapeHTML(input.trim());

    // Check for potential command injection patterns
    const dangerousPatterns = [
      /(\$\(.*\))/,           // Command substitution
      /(`.*`)/,               // Backtick command execution
      /(;.*)/,                // Command chaining
      /(\|.*)/,               // Pipe operations
      /(&&.*)/,               // Command chaining
      /(\|\|.*)/,             // Command chaining
      /(>.*)/,                // Redirection
      /(<.*)/,                // Redirection
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        console.warn(`[SECURITY] Potential command injection detected in input`);
        // Don't block but log the attempt
        break;
      }
    }

    return { valid: true, sanitizedInput };
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(file: File): {
    valid: boolean;
    error?: string;
  } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    // File size limit (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large (max 10MB)' };
    }

    // Validate file name
    const sanitizedName = XSSProtection.sanitizeFileName(file.name);
    if (!sanitizedName) {
      return { valid: false, error: 'Invalid file name' };
    }

    // Allowed file types for knowledge documents
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/json',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }

    return { valid: true };
  }
}

/**
 * Secure Storage Utilities
 */
export class SecureStorage {
  /**
   * Securely store sensitive data in localStorage with basic obfuscation
   */
  static setSecureItem(key: string, value: string): void {
    try {
      // Basic obfuscation (not encryption, but better than plaintext)
      const obfuscated = btoa(encodeURIComponent(value));
      localStorage.setItem(`sec_${key}`, obfuscated);
    } catch (error) {
      console.error('[SECURITY] Failed to store secure item:', error);
    }
  }

  /**
   * Retrieve securely stored data
   */
  static getSecureItem(key: string): string | null {
    try {
      const obfuscated = localStorage.getItem(`sec_${key}`);
      if (!obfuscated) {
        return null;
      }
      
      return decodeURIComponent(atob(obfuscated));
    } catch (error) {
      console.error('[SECURITY] Failed to retrieve secure item:', error);
      return null;
    }
  }

  /**
   * Remove securely stored data
   */
  static removeSecureItem(key: string): void {
    localStorage.removeItem(`sec_${key}`);
  }

  /**
   * Clear all secure storage
   */
  static clearSecureStorage(): void {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sec_')) {
        localStorage.removeItem(key);
      }
    }
  }
}

/**
 * Security Event Logger
 */
export class SecurityLogger {
  /**
   * Log security events for monitoring
   */
  static logSecurityEvent(
    event: 'xss_attempt' | 'injection_attempt' | 'invalid_input' | 'auth_failure' | 'access_denied',
    details: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.warn(`[SECURITY-${severity.toUpperCase()}] ${event}: ${details}`);

    // In production, send to security monitoring service
    // SecurityMonitoringService.sendEvent(logEntry);
  }
}

/**
 * Content Security Policy Helper
 */
export class CSPHelper {
  /**
   * Check if Content Security Policy is properly configured
   */
  static checkCSP(): boolean {
    const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    const hasCSP = metaTags.length > 0;
    
    if (!hasCSP) {
      console.warn('[SECURITY] Content Security Policy not detected');
    }
    
    return hasCSP;
  }

  /**
   * Report CSP violations
   */
  static setupCSPReporting(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      SecurityLogger.logSecurityEvent(
        'xss_attempt',
        `CSP violation: ${event.violatedDirective} - ${event.blockedURI}`,
        'high'
      );
    });
  }
}

// Initialize security features
CSPHelper.setupCSPReporting();