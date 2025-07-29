/**
 * Configuration Validation System
 * Validates required environment variables and configuration at startup
 */

interface RequiredConfig {
  key: string;
  description: string;
  required: boolean;
  validator?: (value: string) => boolean;
}

const BILLING_CONFIG: RequiredConfig[] = [
  {
    key: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key for payment processing',
    required: true,
    validator: (value: string) => value.startsWith('sk_'),
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook secret for signature verification',
    required: true,
    validator: (value: string) => value.startsWith('whsec_'),
  },
  {
    key: 'ALCHEMY_API_KEY',
    description: 'Alchemy API key for crypto payment verification',
    required: false, // Optional for crypto payments
  },
  {
    key: 'DATABASE_URL',
    description: 'Database connection URL',
    required: true,
    validator: (value: string) => value.includes('://'),
  },
];

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingOptional: string[];
}

export class ConfigValidator {
  /**
   * Validate all required configuration for billing system
   */
  static validateBillingConfig(): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      missingRequired: [],
      missingOptional: [],
    };

    for (const config of BILLING_CONFIG) {
      const value = process.env[config.key];

      if (!value) {
        if (config.required) {
          result.missingRequired.push(config.key);
          result.errors.push(
            `Missing required environment variable: ${config.key} - ${config.description}`,
          );
          result.isValid = false;
        } else {
          result.missingOptional.push(config.key);
          result.warnings.push(
            `Missing optional environment variable: ${config.key} - ${config.description}`,
          );
        }
        continue;
      }

      // Run custom validator if provided
      if (config.validator && !config.validator(value)) {
        result.errors.push(
          `Invalid format for ${config.key}: ${config.description}`,
        );
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate configuration and throw if invalid
   */
  static validateOrThrow(): void {
    const result = this.validateBillingConfig();

    if (!result.isValid) {
      const errorMessage = [
        'Billing system configuration validation failed:',
        ...result.errors,
        '',
        'Please check your environment variables and try again.',
      ].join('\n');

      throw new Error(errorMessage);
    }

    // Log warnings
    if (result.warnings.length > 0) {
      console.warn('Billing system configuration warnings:');
      result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }
  }

  /**
   * Check if specific configuration is available
   */
  static isConfigAvailable(key: string): boolean {
    return !!process.env[key];
  }

  /**
   * Get configuration value with fallback
   */
  static getConfig(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value && fallback !== undefined) {
      return fallback;
    }
    if (!value) {
      throw new Error(`Required configuration missing: ${key}`);
    }
    return value;
  }

  /**
   * Check if crypto payment features are available
   */
  static isCryptoPaymentAvailable(): boolean {
    return this.isConfigAvailable('ALCHEMY_API_KEY');
  }

  /**
   * Check if Stripe is properly configured
   */
  static isStripeConfigured(): boolean {
    return (
      this.isConfigAvailable('STRIPE_SECRET_KEY') &&
      this.isConfigAvailable('STRIPE_WEBHOOK_SECRET')
    );
  }
}

/**
 * Runtime configuration validation
 * Call this during application startup
 */
export function validateBillingConfigAtStartup(): void {
  try {
    ConfigValidator.validateOrThrow();
    console.log('✅ Billing system configuration validated successfully');
  } catch (error) {
    console.error('❌ Billing system configuration validation failed');
    console.error(error instanceof Error ? error.message : String(error));
    throw new Error('Billing system configuration validation failed');
  }
}
