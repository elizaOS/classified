/**
 * Billing Configuration
 * Centralized configuration for billing, pricing, and subscription management
 */

export interface BillingConfig {
  // Initial credits for new organizations
  initialCredits: {
    amount: number;
    description: string;
  };

  // Organization limits
  agentLimits: {
    free: number;
    basic: number;
    pro: number;
    premium: number;
    enterprise: number;
  };

  // Subscription tiers
  subscriptionTiers: {
    [tier: string]: {
      name: string;
      priceId: string;
      price: number; // USD per month
      agentLimit: number;
      features: string[];
      description: string;
    };
  };

  // Auto top-up settings
  autoTopUp: {
    defaultThreshold: number;
    defaultAmount: number;
    minimumAmount: number;
    maximumAmount: number;
  };

  // Pricing model settings
  pricing: {
    minimumCharge: number;
    currency: string;
    billingCycle: 'monthly' | 'annual';
  };
}

/**
 * Load billing configuration from environment variables with fallbacks
 */
export function loadBillingConfig(): BillingConfig {
  return {
    initialCredits: {
      amount: parseFloat(process.env.INITIAL_CREDITS_AMOUNT || '5.0'),
      description:
        process.env.INITIAL_CREDITS_DESCRIPTION ||
        'Welcome bonus - free credits',
    },

    agentLimits: {
      free: parseInt(process.env.AGENT_LIMIT_FREE || '2', 10),
      basic: parseInt(process.env.AGENT_LIMIT_BASIC || '5', 10),
      pro: parseInt(process.env.AGENT_LIMIT_PRO || '15', 10),
      premium: parseInt(process.env.AGENT_LIMIT_PREMIUM || '50', 10),
      enterprise: parseInt(process.env.AGENT_LIMIT_ENTERPRISE || '100', 10),
    },

    subscriptionTiers: {
      free: {
        name: 'Free',
        priceId: '', // No Stripe price for free tier
        price: 0,
        agentLimit: parseInt(process.env.AGENT_LIMIT_FREE || '2', 10),
        features: ['2 AI Agents', 'Basic Support', '$5 free credits'],
        description: 'Perfect for getting started',
      },
      basic: {
        name: 'Basic',
        priceId: process.env.STRIPE_PRICE_ID_BASIC || '',
        price: parseFloat(process.env.BASIC_TIER_PRICE || '29.0'),
        agentLimit: parseInt(process.env.AGENT_LIMIT_BASIC || '5', 10),
        features: ['5 AI Agents', 'Email Support', 'Advanced Analytics'],
        description: 'For small teams and projects',
      },
      pro: {
        name: 'Pro',
        priceId: process.env.STRIPE_PRICE_ID_PRO || '',
        price: parseFloat(process.env.PRO_TIER_PRICE || '99.0'),
        agentLimit: parseInt(process.env.AGENT_LIMIT_PRO || '15', 10),
        features: [
          '15 AI Agents',
          'Priority Support',
          'Custom Plugins',
          'API Access',
        ],
        description: 'For growing businesses',
      },
      premium: {
        name: 'Premium',
        priceId: process.env.STRIPE_PRICE_ID_PREMIUM || '',
        price: parseFloat(process.env.PREMIUM_TIER_PRICE || '299.0'),
        agentLimit: parseInt(process.env.AGENT_LIMIT_PREMIUM || '50', 10),
        features: [
          '50 AI Agents',
          '24/7 Support',
          'White-label Options',
          'Advanced Security',
        ],
        description: 'For large organizations',
      },
      enterprise: {
        name: 'Enterprise',
        priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
        price: parseFloat(process.env.ENTERPRISE_TIER_PRICE || '999.0'),
        agentLimit: parseInt(process.env.AGENT_LIMIT_ENTERPRISE || '100', 10),
        features: [
          '100+ AI Agents',
          'Dedicated Support',
          'Custom Integrations',
          'SLA',
        ],
        description: 'For enterprise deployments',
      },
    },

    autoTopUp: {
      defaultThreshold: parseFloat(
        process.env.AUTO_TOPUP_DEFAULT_THRESHOLD || '10.0',
      ),
      defaultAmount: parseFloat(
        process.env.AUTO_TOPUP_DEFAULT_AMOUNT || '50.0',
      ),
      minimumAmount: parseFloat(
        process.env.AUTO_TOPUP_MINIMUM_AMOUNT || '10.0',
      ),
      maximumAmount: parseFloat(
        process.env.AUTO_TOPUP_MAXIMUM_AMOUNT || '1000.0',
      ),
    },

    pricing: {
      minimumCharge: parseFloat(process.env.MINIMUM_CHARGE || '0.0001'),
      currency: process.env.BILLING_CURRENCY || 'usd',
      billingCycle:
        (process.env.BILLING_CYCLE as 'monthly' | 'annual') || 'monthly',
    },
  };
}

/**
 * Get agent limit for organization based on subscription tier
 */
export function getAgentLimitForTier(
  tier: string,
  billingConfig?: BillingConfig,
): number {
  const config = billingConfig || loadBillingConfig();

  if (tier in config.subscriptionTiers) {
    return config.subscriptionTiers[tier].agentLimit;
  }

  // Default to free tier limit
  return config.agentLimits.free;
}

/**
 * Validate billing configuration
 */
export function validateBillingConfig(config: BillingConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate initial credits
  if (config.initialCredits.amount < 0) {
    errors.push('Initial credits amount must be non-negative');
  }

  // Validate agent limits
  const limits = Object.values(config.agentLimits);
  if (limits.some((limit) => limit < 1)) {
    errors.push('All agent limits must be at least 1');
  }

  // Validate subscription tiers
  for (const [tier, tierConfig] of Object.entries(config.subscriptionTiers)) {
    if (tierConfig.price < 0) {
      errors.push(`Price for ${tier} tier must be non-negative`);
    }

    if (tierConfig.agentLimit < 1) {
      errors.push(`Agent limit for ${tier} tier must be at least 1`);
    }

    // Validate price IDs for paid tiers
    if (tierConfig.price > 0 && !tierConfig.priceId) {
      errors.push(`Price ID is required for paid ${tier} tier`);
    }
  }

  // Validate auto top-up settings
  if (config.autoTopUp.defaultThreshold < 0) {
    errors.push('Auto top-up threshold must be non-negative');
  }

  if (config.autoTopUp.minimumAmount > config.autoTopUp.maximumAmount) {
    errors.push('Auto top-up minimum amount cannot exceed maximum amount');
  }

  // Validate pricing
  if (config.pricing.minimumCharge < 0) {
    errors.push('Minimum charge must be non-negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Global configuration instance
let _billingConfig: BillingConfig | null = null;

/**
 * Get the global billing configuration instance
 */
export function getBillingConfig(): BillingConfig {
  if (!_billingConfig) {
    _billingConfig = loadBillingConfig();

    // Validate configuration in development
    if (process.env.NODE_ENV === 'development') {
      const validation = validateBillingConfig(_billingConfig);
      if (!validation.isValid) {
        console.warn(
          'Billing configuration validation warnings:',
          validation.errors,
        );
      }
    }
  }

  return _billingConfig;
}

export default getBillingConfig;
