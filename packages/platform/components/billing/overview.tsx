/**
 * Billing Overview Component
 * Displays current credit balance and key billing metrics
 */

'use client';

import { useState } from 'react';
import { CreditCard, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface BillingOverviewProps {
  overview: {
    creditBalance: number;
    monthlyUsage: number;
    monthlyPurchases: number;
    usageBreakdown: Record<string, number>;
    subscriptionTier: string;
    nextBillingDate?: string | null;
  };
  organizationId: string;
}

export function BillingOverview({ overview }: BillingOverviewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refresh the page to get latest data
    window.location.reload();
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 50) {
      return 'text-success dark:text-success';
    }
    if (balance > 20) {
      return 'text-warning dark:text-warning';
    }
    return 'text-error dark:text-error-dark';
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 50) {
      return '✅';
    }
    if (balance > 20) {
      return '⚠️';
    }
    return '🔴';
  };

  return (
    <div
      className="rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark"
      data-testid="billing-overview"
    >
      <div className="mb-6 flex items-center justify-between">
        <h2
          className="text-xl font-semibold text-typography-strong dark:text-typography-strong-dark"
          data-testid="overview-title"
        >
          Account Overview
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-sm text-brand hover:opacity-80 disabled:opacity-50 dark:text-brand-dark"
          data-testid="refresh-billing"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Credit Balance - Featured */}
      <div className="mb-6 rounded-lg border border-secondary-stroke-weak bg-secondary-fill p-6 dark:border-secondary-stroke-weak dark:bg-secondary-fill">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-secondary-typography-strong dark:text-secondary-typography-strong-dark">
              Current Credit Balance
            </p>
            <div className="mt-1 flex items-center">
              <span
                className="text-3xl font-bold text-secondary-typography-strong dark:text-secondary-typography-strong-dark"
                data-testid="credit-balance"
              >
                ${overview.creditBalance.toFixed(2)}
              </span>
              <span className="ml-2 text-lg" data-testid="balance-indicator">
                {getBalanceIcon(overview.creditBalance)}
              </span>
            </div>
            <p
              className={`mt-1 text-sm ${getBalanceColor(overview.creditBalance)}`}
              data-testid="balance-status"
            >
              {overview.creditBalance > 50
                ? 'Healthy balance'
                : overview.creditBalance > 20
                  ? 'Consider adding credits soon'
                  : 'Low balance - add credits now'}
            </p>
          </div>
          <CreditCard className="h-12 w-12 text-secondary-typography-strong dark:text-secondary-typography-strong-dark" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        className="grid grid-cols-1 gap-6 md:grid-cols-3"
        data-testid="metrics-grid"
      >
        {/* Monthly Usage */}
        <div className="rounded-lg bg-fill p-4 dark:bg-fill">
          <div className="flex items-center">
            <TrendingUp className="mr-3 h-8 w-8 text-error dark:text-error-dark" />
            <div>
              <p className="text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
                This Month Usage
              </p>
              <p
                className="text-2xl font-bold text-typography-strong dark:text-typography-strong-dark"
                data-testid="monthly-usage-amount"
              >
                ${overview.monthlyUsage.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly Purchases */}
        <div className="rounded-lg bg-fill p-4 dark:bg-fill">
          <div className="flex items-center">
            <DollarSign className="mr-3 h-8 w-8 text-success dark:text-success" />
            <div>
              <p className="text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
                This Month Purchases
              </p>
              <p
                className="text-2xl font-bold text-typography-strong dark:text-typography-strong-dark"
                data-testid="monthly-purchases-amount"
              >
                ${overview.monthlyPurchases.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Tier */}
        <div className="rounded-lg bg-fill p-4 dark:bg-fill">
          <div className="flex items-center">
            <Calendar className="mr-3 h-8 w-8 text-brand dark:text-brand-dark" />
            <div>
              <p className="text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
                Subscription
              </p>
              <p
                className="text-lg font-bold capitalize text-typography-strong dark:text-typography-strong-dark"
                data-testid="subscription-display"
              >
                {overview.subscriptionTier.replace('-', ' ')}
              </p>
              {overview.nextBillingDate && (
                <p
                  className="text-xs text-typography-weak dark:text-typography-weak-dark"
                  data-testid="next-billing-date"
                >
                  Next:{' '}
                  {new Date(overview.nextBillingDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Low Balance Warning */}
      {overview.creditBalance < 20 && (
        <div
          className="mt-6 rounded-lg border border-warning-stroke-weak bg-warning-fill p-4 dark:border-warning-stroke-weak dark:bg-warning-fill"
          data-testid="low-balance-warning"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-xl text-warning dark:text-warning">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-stroke-strong dark:text-warning-stroke-strong">
                Low Credit Balance
              </h3>
              <p className="mt-1 text-sm text-warning dark:text-warning">
                Your credit balance is running low. Consider adding more credits
                to avoid service interruptions.
              </p>
            </div>
            <div className="ml-auto">
              <a
                href="#credit-purchase"
                className="text-sm font-medium text-warning-stroke-strong hover:opacity-80 dark:text-warning-stroke-strong"
                data-testid="add-credits-link"
              >
                Add Credits →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Critical Balance Alert */}
      {overview.creditBalance < 5 && (
        <div
          className="mt-4 rounded-lg border border-error-stroke-weak bg-error-fill p-4 dark:border-error-stroke-weak dark:bg-error-fill"
          data-testid="critical-balance-alert"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-xl text-error dark:text-error-dark">
                🚨
              </span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-error-stroke-strong dark:text-error-stroke-strong">
                Critical: Very Low Balance
              </h3>
              <p className="mt-1 text-sm text-error dark:text-error-dark">
                Your balance is critically low. Add credits immediately to
                prevent service suspension.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
