/**
 * Billing Settings Component
 * Manages auto-topup, billing alerts, and other billing preferences
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  CreditCard,
  Bell,
  AlertTriangle,
  Save,
  Loader2,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethods } from './payment-methods';

interface BillingSettings {
  autoTopUpEnabled: boolean;
  autoTopUpAmount: number;
  creditThreshold: number;
  lowBalanceAlerts: boolean;
  emailNotifications: boolean;
  weeklyReports: boolean;
  subscriptionTier: string;
  billingEmail: string;
}

interface BillingSettingsProps {
  organizationId: string;
  currentBalance: number;
}

export function BillingSettings({
  organizationId,
  currentBalance,
}: BillingSettingsProps) {
  const [settings, setSettings] = useState<BillingSettings>({
    autoTopUpEnabled: false,
    autoTopUpAmount: 50,
    creditThreshold: 10,
    lowBalanceAlerts: true,
    emailNotifications: true,
    weeklyReports: false,
    subscriptionTier: 'pay-as-you-go',
    billingEmail: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/billing/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings((prevSettings) => data.settings || prevSettings);
    } catch (error) {
      console.error('Failed to fetch billing settings:', error);
      toast.error('Failed to load billing settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (settings.autoTopUpAmount < 5) {
      newErrors.autoTopUpAmount = 'Auto top-up amount must be at least $5';
    }
    if (settings.autoTopUpAmount > 1000) {
      newErrors.autoTopUpAmount = 'Auto top-up amount cannot exceed $1,000';
    }
    if (settings.creditThreshold < 0) {
      newErrors.creditThreshold = 'Credit threshold cannot be negative';
    }
    if (settings.creditThreshold > settings.autoTopUpAmount) {
      newErrors.creditThreshold =
        'Credit threshold should be less than auto top-up amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveSettings = async () => {
    if (!validateSettings()) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Billing settings saved successfully');
    } catch (error) {
      console.error('Failed to save billing settings:', error);
      toast.error('Failed to save billing settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof BillingSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded bg-gray-200 dark:bg-gray-700"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto Top-up Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center">
          <DollarSign className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Auto Top-up
          </h3>
        </div>

        <div className="space-y-4">
          {/* Enable Auto Top-up */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Enable Auto Top-up
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically add credits when your balance falls below the
                threshold
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting('autoTopUpEnabled', !settings.autoTopUpEnabled)
              }
              className="flex items-center"
            >
              {settings.autoTopUpEnabled ? (
                <ToggleRight className="h-8 w-8 text-blue-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-gray-400" />
              )}
            </button>
          </div>

          {settings.autoTopUpEnabled && (
            <>
              {/* Credit Threshold */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Credit Threshold
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-500 dark:text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.creditThreshold}
                    onChange={(e) =>
                      updateSetting(
                        'creditThreshold',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className={`w-full rounded-lg border bg-white py-2 pl-8 pr-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${
                      errors.creditThreshold
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
                {errors.creditThreshold && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.creditThreshold}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  When your balance drops below this amount, auto top-up will
                  trigger
                </p>
              </div>

              {/* Auto Top-up Amount */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Auto Top-up Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    step="1"
                    value={settings.autoTopUpAmount}
                    onChange={(e) =>
                      updateSetting(
                        'autoTopUpAmount',
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className={`w-full rounded-lg border py-2 pl-8 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                      errors.autoTopUpAmount
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.autoTopUpAmount && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.autoTopUpAmount}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-600">
                  Amount to add when auto top-up is triggered ($5 - $1,000)
                </p>
              </div>

              {/* Current Status Alert */}
              {currentBalance <= settings.creditThreshold && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Auto Top-up Triggered
                      </p>
                      <p className="text-sm text-yellow-700">
                        Your current balance (${currentBalance.toFixed(2)}) is
                        below the threshold. Auto top-up will add $
                        {settings.autoTopUpAmount} to your account.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center">
          <Bell className="mr-2 h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        </div>

        <div className="space-y-4">
          {/* Low Balance Alerts */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Low Balance Alerts
              </label>
              <p className="text-sm text-gray-600">
                Get notified when your credit balance is running low
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting('lowBalanceAlerts', !settings.lowBalanceAlerts)
              }
              className="flex items-center"
            >
              {settings.lowBalanceAlerts ? (
                <ToggleRight className="h-8 w-8 text-blue-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-gray-400" />
              )}
            </button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Email Notifications
              </label>
              <p className="text-sm text-gray-600">
                Receive billing notifications via email
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  'emailNotifications',
                  !settings.emailNotifications,
                )
              }
              className="flex items-center"
            >
              {settings.emailNotifications ? (
                <ToggleRight className="h-8 w-8 text-blue-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-gray-400" />
              )}
            </button>
          </div>

          {/* Weekly Reports */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Weekly Usage Reports
              </label>
              <p className="text-sm text-gray-600">
                Receive weekly email reports with usage summaries
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting('weeklyReports', !settings.weeklyReports)
              }
              className="flex items-center"
            >
              {settings.weeklyReports ? (
                <ToggleRight className="h-8 w-8 text-blue-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center">
          <CreditCard className="mr-2 h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Current Plan
            </label>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <span className="text-sm capitalize text-gray-900">
                {settings.subscriptionTier.replace('-', ' ')}
              </span>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                Upgrade Plan
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Billing Email
            </label>
            <input
              type="email"
              value={settings.billingEmail}
              onChange={(e) => updateSetting('billingEmail', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="billing@example.com"
            />
            <p className="mt-1 text-sm text-gray-600">
              Billing notifications and invoices will be sent to this email
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <PaymentMethods organizationId={organizationId} />

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
