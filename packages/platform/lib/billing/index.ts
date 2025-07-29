/**
 * Billing module exports
 * Central access point for all billing functionality
 */

// Core billing services
import {
  getCreditBalance,
  addCredits,
  deductCredits,
  getCreditTransactions,
  getUsageStatistics,
  createPaymentIntent,
  createStripeCustomer,
  addInitialCredits,
} from '../server/services/billing-service';

export {
  getCreditBalance,
  addCredits,
  deductCredits,
  getCreditTransactions,
  getUsageStatistics,
  createPaymentIntent,
  createStripeCustomer,
  addInitialCredits,
};
export { CreditService } from './credit-service';
export { MarketplaceBillingService } from './marketplace-billing-service';

// Middleware for usage tracking
export {
  withCreditCheck,
  withModelUsageTracking,
  withStorageUsageTracking,
  trackUsage,
  trackModelUsage,
} from './credit-middleware';

// Types
export type { UsageContext, CreditUsageResult } from './credit-service';

export type { CreditDeductionConfig } from './credit-middleware';

export type {
  MarketplaceUsageContext,
  MarketplaceBillingResult,
} from './marketplace-billing-service';

// Billing service factory function
export function getBillingService() {
  return {
    async getOrganizationBilling(organizationId: string) {
      const balance = await getCreditBalance(organizationId);
      return {
        hasActiveSubscription: balance > 0,
        creditsRemaining: balance,
      };
    },
    async getSpendingLimits(organizationId: string) {
      // Default spending limits - can be extended later
      return {
        monthlyLimit: 1000,
      };
    },
    async getCurrentMonthSpending(organizationId: string) {
      const stats = await getUsageStatistics(organizationId, 'month');
      return stats.totalCreditsDeducted;
    },
  };
}
