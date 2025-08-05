/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive validation for user inputs to prevent security issues
 */

import { logger } from './logger';

const MAX_INPUT_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;
const MAX_NAME_LENGTH = 100;

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
}

export class InputValidator {
  /**
   * Sanitize text input by removing dangerous characters and scripts
   */
  static sanitizeText(input: string, maxLength: number = MAX_INPUT_LENGTH): ValidationResult {
    const errors: string[] = [];

    if (typeof input !== 'string') {
      return {
        isValid: false,
        sanitized: '',
        errors: ['Input must be a string'],
      };
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Check length
    if (sanitized.length > maxLength) {
      errors.push(`Input exceeds maximum length of ${maxLength} characters`);
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Prevent XSS by encoding HTML entities
    sanitized = this.escapeHtml(sanitized);

    // Remove any script tags or javascript: URLs
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // Remove event handlers

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Validate and sanitize URLs
   */
  static validateUrl(url: string): ValidationResult {
    const errors: string[] = [];
    let sanitized = url.trim();

    if (!sanitized) {
      return {
        isValid: false,
        sanitized: '',
        errors: ['URL is required'],
      };
    }

    if (sanitized.length > MAX_URL_LENGTH) {
      errors.push(`URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
      return {
        isValid: false,
        sanitized: sanitized.substring(0, MAX_URL_LENGTH),
        errors,
      };
    }

    try {
      const urlObj = new URL(sanitized);

      // Only allow http, https, ws, and wss protocols
      const allowedProtocols = ['http:', 'https:', 'ws:', 'wss:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        errors.push(`Invalid protocol. Allowed: ${allowedProtocols.join(', ')}`);
      }

      // Prevent javascript: and data: URLs
      if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
        errors.push('Potentially dangerous URL protocol');
      }

      // Check for localhost in production
      if (
        import.meta.env.PROD &&
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')
      ) {
        errors.push('Localhost URLs are not allowed in production');
      }

      // Reconstruct URL to ensure it's properly formatted
      sanitized = urlObj.toString();
    } catch (_e) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Validate email addresses
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const sanitized = email.trim().toLowerCase();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(sanitized)) {
      errors.push('Invalid email format');
    }

    if (sanitized.length > 254) {
      // RFC 5321
      errors.push('Email address too long');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Validate names (usernames, agent names, etc.)
   */
  static validateName(name: string, allowSpaces: boolean = true): ValidationResult {
    const errors: string[] = [];
    let sanitized = name.trim();

    if (!sanitized) {
      return {
        isValid: false,
        sanitized: '',
        errors: ['Name is required'],
      };
    }

    if (sanitized.length > MAX_NAME_LENGTH) {
      errors.push(`Name exceeds maximum length of ${MAX_NAME_LENGTH} characters`);
      sanitized = sanitized.substring(0, MAX_NAME_LENGTH);
    }

    // Allow only alphanumeric, spaces (if enabled), hyphens, and underscores
    const pattern = allowSpaces ? /^[a-zA-Z0-9\s\-_]+$/ : /^[a-zA-Z0-9\-_]+$/;

    if (!pattern.test(sanitized)) {
      errors.push(
        allowSpaces
          ? 'Name can only contain letters, numbers, spaces, hyphens, and underscores'
          : 'Name can only contain letters, numbers, hyphens, and underscores'
      );
    }

    // Prevent multiple consecutive spaces
    if (allowSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Validate numeric input
   */
  static validateNumber(
    input: string | number,
    min?: number,
    max?: number,
    allowDecimals: boolean = true
  ): ValidationResult {
    const errors: string[] = [];
    let sanitized = String(input).trim();

    // Remove any non-numeric characters except decimal point and minus
    sanitized = sanitized.replace(/[^\d.-]/g, '');

    // Validate format
    const pattern = allowDecimals ? /^-?\d+(\.\d+)?$/ : /^-?\d+$/;
    if (!pattern.test(sanitized)) {
      errors.push(allowDecimals ? 'Invalid number format' : 'Only whole numbers are allowed');
      return {
        isValid: false,
        sanitized,
        errors,
      };
    }

    const num = parseFloat(sanitized);

    if (isNaN(num)) {
      errors.push('Invalid number');
    } else {
      if (min !== undefined && num < min) {
        errors.push(`Number must be at least ${min}`);
      }
      if (max !== undefined && num > max) {
        errors.push(`Number must be at most ${max}`);
      }
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Validate JSON input
   */
  static validateJson(input: string): ValidationResult {
    const errors: string[] = [];
    let sanitized = input.trim();

    if (!sanitized) {
      return {
        isValid: false,
        sanitized: '',
        errors: ['JSON input is required'],
      };
    }

    try {
      // Parse and re-stringify to ensure proper formatting
      const parsed = JSON.parse(sanitized);
      sanitized = JSON.stringify(parsed, null, 2);
    } catch (e) {
      errors.push('Invalid JSON format');
      if (e instanceof Error) {
        errors.push(e.message);
      }
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return text.replace(/[&<>"'/]/g, (char) => map[char]);
  }

  /**
   * Validate file upload
   */
  static validateFile(
    file: File,
    allowedTypes?: string[],
    maxSizeMB: number = 10
  ): ValidationResult {
    const errors: string[] = [];
    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes

    if (!file) {
      return {
        isValid: false,
        sanitized: '',
        errors: ['No file provided'],
      };
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    if (allowedTypes && allowedTypes.length > 0) {
      const fileType = file.type || '';
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

      const isAllowed = allowedTypes.some((type) => {
        if (type.includes('*')) {
          // Handle wildcards like "image/*"
          const [category] = type.split('/');
          return fileType.startsWith(`${category}/`);
        }
        return fileType === type || fileExtension === type.replace('.', '');
      });

      if (!isAllowed) {
        errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      }
    }

    // Sanitize filename
    let sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Prevent directory traversal
    sanitizedName = sanitizedName.replace(/\.\./g, '');

    return {
      isValid: errors.length === 0,
      sanitized: sanitizedName,
      errors,
    };
  }

  /**
   * Validate and sanitize SQL-like queries (for search inputs)
   */
  static sanitizeSearchQuery(query: string): ValidationResult {
    const errors: string[] = [];
    let sanitized = query.trim();

    // Remove SQL injection attempts
    const sqlKeywords = [
      'DROP',
      'DELETE',
      'INSERT',
      'UPDATE',
      'EXEC',
      'EXECUTE',
      'CREATE',
      'ALTER',
      'TRUNCATE',
      'UNION',
      'SELECT.*FROM',
    ];

    const pattern = new RegExp(sqlKeywords.join('|'), 'gi');
    if (pattern.test(sanitized)) {
      logger.warn('Potential SQL injection attempt detected', { query });
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove special characters that could be used in injections
    sanitized = sanitized.replace(/[;'"\\]/g, '');

    // Limit length for search queries
    const maxSearchLength = 200;
    if (sanitized.length > maxSearchLength) {
      sanitized = sanitized.substring(0, maxSearchLength);
      errors.push(`Search query truncated to ${maxSearchLength} characters`);
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }
}

// Export convenience functions
export const {
  sanitizeText,
  validateUrl,
  validateEmail,
  validateName,
  validateNumber,
  validateJson,
  validateFile,
  sanitizeSearchQuery,
} = InputValidator;
