/**
 * Advanced Security Headers Middleware
 *
 * Implements comprehensive security headers to protect against common web vulnerabilities
 * including XSS, CSRF, clickjacking, and other security threats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../logger';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp?: {
    enabled: boolean;
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };

  // HTTP Strict Transport Security
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  // X-Frame-Options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;

  // X-Content-Type-Options
  noSniff?: boolean;

  // X-XSS-Protection
  xssProtection?: boolean;

  // Referrer Policy
  referrerPolicy?: string;

  // Permissions Policy
  permissionsPolicy?: Record<string, string[]>;

  // Custom headers
  customHeaders?: Record<string, string>;
}

const defaultConfig: SecurityHeadersConfig = {
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
        'https://cdnjs.cloudflare.com',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
      ],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
      ],
      'connect-src': ["'self'", 'wss:', 'ws:', 'https://api.elizaos.ai'],
      'media-src': ["'self'", 'data:', 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    },
    reportOnly: false,
  },
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameOptions: 'DENY',
  noSniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    accelerometer: ["'none'"],
    'ambient-light-sensor': ["'none'"],
    autoplay: ["'self'"],
    battery: ["'none'"],
    camera: ["'none'"],
    'cross-origin-isolated': ["'none'"],
    'display-capture': ["'none'"],
    'document-domain': ["'none'"],
    'encrypted-media': ["'none'"],
    'execution-while-not-rendered': ["'none'"],
    'execution-while-out-of-viewport': ["'none'"],
    fullscreen: ["'self'"],
    geolocation: ["'none'"],
    gyroscope: ["'none'"],
    'keyboard-map': ["'none'"],
    magnetometer: ["'none'"],
    microphone: ["'none'"],
    midi: ["'none'"],
    'navigation-override': ["'none'"],
    payment: ["'none'"],
    'picture-in-picture': ["'none'"],
    'publickey-credentials-get': ["'none'"],
    'screen-wake-lock': ["'none'"],
    'sync-xhr': ["'none'"],
    usb: ["'none'"],
    'web-share': ["'none'"],
    'xr-spatial-tracking': ["'none'"],
  },
  customHeaders: {
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
  },
};

/**
 * Security Headers Middleware
 */
export class SecurityHeaders {
  private config: SecurityHeadersConfig;

  constructor(config: Partial<SecurityHeadersConfig> = {}) {
    this.config = this.mergeConfig(defaultConfig, config);
  }

  /**
   * Apply security headers to response
   */
  apply(request: NextRequest, response: NextResponse): NextResponse {
    try {
      // Apply CSP
      if (this.config.csp?.enabled) {
        this.applyCsp(response);
      }

      // Apply HSTS
      if (this.config.hsts?.enabled && this.isSecureRequest(request)) {
        this.applyHsts(response);
      }

      // Apply frame options
      if (this.config.frameOptions) {
        response.headers.set('X-Frame-Options', this.config.frameOptions);
      }

      // Apply no-sniff
      if (this.config.noSniff) {
        response.headers.set('X-Content-Type-Options', 'nosniff');
      }

      // Apply XSS protection
      if (this.config.xssProtection) {
        response.headers.set('X-XSS-Protection', '1; mode=block');
      }

      // Apply referrer policy
      if (this.config.referrerPolicy) {
        response.headers.set('Referrer-Policy', this.config.referrerPolicy);
      }

      // Apply permissions policy
      if (this.config.permissionsPolicy) {
        this.applyPermissionsPolicy(response);
      }

      // Apply custom headers
      if (this.config.customHeaders) {
        Object.entries(this.config.customHeaders).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      }

      // Add security-related meta headers
      response.headers.set('X-Powered-By', ''); // Remove default Next.js header
      response.headers.set('Server', ''); // Remove server information
      response.headers.set('X-ElizaOS-Security', 'enabled');

      return response;
    } catch (error) {
      logger.error('Failed to apply security headers', error as Error);
      return response;
    }
  }

  /**
   * Apply Content Security Policy
   */
  private applyCsp(response: NextResponse): void {
    if (!this.config.csp?.directives) {
      return;
    }

    const directives = Object.entries(this.config.csp.directives)
      .map(([directive, values]) => {
        if (values.length === 0) {
          return directive;
        }
        return `${directive} ${values.join(' ')}`;
      })
      .join('; ');

    const headerName = this.config.csp.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    let cspValue = directives;
    if (this.config.csp.reportUri) {
      cspValue += `; report-uri ${this.config.csp.reportUri}`;
    }

    response.headers.set(headerName, cspValue);
  }

  /**
   * Apply HTTP Strict Transport Security
   */
  private applyHsts(response: NextResponse): void {
    if (!this.config.hsts) {
      return;
    }

    let hstsValue = `max-age=${this.config.hsts.maxAge || 31536000}`;

    if (this.config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (this.config.hsts.preload) {
      hstsValue += '; preload';
    }

    response.headers.set('Strict-Transport-Security', hstsValue);
  }

  /**
   * Apply Permissions Policy
   */
  private applyPermissionsPolicy(response: NextResponse): void {
    if (!this.config.permissionsPolicy) {
      return;
    }

    const policies = Object.entries(this.config.permissionsPolicy)
      .map(([directive, values]) => {
        if (values.length === 0) {
          return `${directive}=()`;
        }
        return `${directive}=(${values.join(' ')})`;
      })
      .join(', ');

    response.headers.set('Permissions-Policy', policies);
  }

  /**
   * Check if request is secure (HTTPS)
   */
  private isSecureRequest(request: NextRequest): boolean {
    return (
      request.url.startsWith('https://') ||
      request.headers.get('x-forwarded-proto') === 'https'
    );
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(
    defaultConfig: SecurityHeadersConfig,
    userConfig: Partial<SecurityHeadersConfig>,
  ): SecurityHeadersConfig {
    const merged = { ...defaultConfig };

    if (userConfig.csp) {
      merged.csp = {
        ...defaultConfig.csp,
        ...userConfig.csp,
        directives: {
          ...defaultConfig.csp?.directives,
          ...userConfig.csp.directives,
        },
      };
    }

    if (userConfig.hsts) {
      merged.hsts = {
        ...defaultConfig.hsts,
        ...userConfig.hsts,
      };
    }

    if (userConfig.permissionsPolicy) {
      merged.permissionsPolicy = {
        ...defaultConfig.permissionsPolicy,
        ...userConfig.permissionsPolicy,
      };
    }

    if (userConfig.customHeaders) {
      merged.customHeaders = {
        ...defaultConfig.customHeaders,
        ...userConfig.customHeaders,
      };
    }

    // Override other simple properties
    Object.keys(userConfig).forEach((key) => {
      if (
        !['csp', 'hsts', 'permissionsPolicy', 'customHeaders'].includes(key)
      ) {
        (merged as any)[key] = (userConfig as any)[key];
      }
    });

    return merged;
  }

  /**
   * Create middleware function for Next.js
   */
  static createMiddleware(config?: Partial<SecurityHeadersConfig>) {
    const headers = new SecurityHeaders(config);

    return function securityHeadersMiddleware(request: NextRequest) {
      const response = NextResponse.next();
      return headers.apply(request, response);
    };
  }

  /**
   * Create API route wrapper
   */
  static createApiWrapper(config?: Partial<SecurityHeadersConfig>) {
    const headers = new SecurityHeaders(config);

    return function withSecurityHeaders<T extends (...args: any[]) => any>(
      handler: T,
    ): T {
      return (async (...args: Parameters<T>) => {
        const [request] = args;
        const result = await handler(...args);

        if (result instanceof NextResponse) {
          return headers.apply(request, result);
        }

        return result;
      }) as T;
    };
  }

  /**
   * Validate CSP directives
   */
  static validateCspDirectives(directives: Record<string, string[]>): string[] {
    const validDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'media-src',
      'object-src',
      'child-src',
      'frame-src',
      'worker-src',
      'manifest-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'plugin-types',
      'sandbox',
      'upgrade-insecure-requests',
      'block-all-mixed-content',
      'require-sri-for',
      'reflected-xss',
      'referrer',
      'report-uri',
      'report-to',
    ];

    const errors: string[] = [];

    Object.keys(directives).forEach((directive) => {
      if (!validDirectives.includes(directive)) {
        errors.push(`Invalid CSP directive: ${directive}`);
      }
    });

    return errors;
  }

  /**
   * Generate CSP report endpoint
   */
  static async handleCspReport(request: NextRequest): Promise<NextResponse> {
    try {
      const report = await request.json();

      logger.warn('CSP Violation Report', {
        report,
        userAgent: request.headers.get('user-agent'),
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        timestamp: new Date().toISOString(),
      });

      // Store CSP violations for analysis
      // In production, you might want to store these in a database
      // or send to a security monitoring service

      return NextResponse.json({ status: 'received' });
    } catch (error) {
      logger.error('Failed to process CSP report', error as Error);
      return NextResponse.json(
        { error: 'Failed to process report' },
        { status: 400 },
      );
    }
  }
}

// Export default instance with production-ready configuration
export const securityHeaders = new SecurityHeaders();

// Export middleware function for easy use
export const securityHeadersMiddleware = SecurityHeaders.createMiddleware();

// Export API wrapper for route handlers
export const withSecurityHeaders = SecurityHeaders.createApiWrapper();
