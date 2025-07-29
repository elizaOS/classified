'use client';

import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import SettingsBox from '@/components/ui/settings-box';
import { DotsHorizontalIcon, GearIcon } from '@radix-ui/react-icons';
import Header from '@/components/ui/header';
import PricingBox from '@/components/ui/pricing-box';

export default function BillingPage() {
  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">
        <h1>Plans</h1>

        <div className="flex w-full justify-between gap-4">
          <PricingBox
            planName="Basic"
            planPrice={10}
            billingOption="monthly"
            features={[
              {
                featureName: '10K monthly API calls',
                featureIncluded: true,
              },
              {
                featureName: 'Email support',
                featureIncluded: true,
              },
              {
                featureName: 'Custom domain',
                featureIncluded: false,
              },
              {
                featureName: 'Priority support',
                featureIncluded: false,
              },
              {
                featureName: 'Unlimited API calls',
                featureIncluded: false,
              },
              {
                featureName: 'Private slack channel',
                featureIncluded: false,
              },
              {
                featureName: 'Single sign-on',
                featureIncluded: false,
              },
              {
                featureName: 'API rate limiting',
                featureIncluded: false,
              },
              {
                featureName: 'Advanced analytics',
                featureIncluded: false,
              },
              {
                featureName: 'Custom integrations',
                featureIncluded: false,
              },
            ]}
          />

          <PricingBox
            planName="Pro"
            planPrice={29}
            billingOption="monthly"
            features={[
              {
                featureName: '100K monthly API calls',
                featureIncluded: true,
              },
              {
                featureName: 'Priority email support',
                featureIncluded: true,
              },
              {
                featureName: 'Custom domain',
                featureIncluded: true,
              },
              {
                featureName: 'Priority support',
                featureIncluded: true,
              },
              {
                featureName: 'API rate limiting',
                featureIncluded: true,
              },
              {
                featureName: 'Unlimited API calls',
                featureIncluded: false,
              },
              {
                featureName: 'Private slack channel',
                featureIncluded: false,
              },
              {
                featureName: 'Single sign-on',
                featureIncluded: false,
              },
              {
                featureName: 'Advanced analytics',
                featureIncluded: false,
              },
              {
                featureName: 'Custom integrations',
                featureIncluded: false,
              },
            ]}
          />

          <PricingBox
            planName="Premium"
            planPrice={49}
            billingOption="monthly"
            features={[
              {
                featureName: 'Unlimited API calls',
                featureIncluded: true,
              },
              {
                featureName: '24/7 Priority email support',
                featureIncluded: true,
              },
              {
                featureName: 'Custom domain',
                featureIncluded: true,
              },
              {
                featureName: 'Priority support',
                featureIncluded: true,
              },
              {
                featureName: 'Private slack channel',
                featureIncluded: true,
              },
              {
                featureName: 'API rate limiting',
                featureIncluded: true,
              },
              {
                featureName: 'Advanced analytics',
                featureIncluded: true,
              },
              {
                featureName: 'Unlimited API calls',
                featureIncluded: true,
              },
              {
                featureName: 'Single sign-on',
                featureIncluded: false,
              },
              {
                featureName: 'Custom integrations',
                featureIncluded: false,
              },
            ]}
          />
        </div>

        <div className="flex w-full justify-between gap-4">
          <PricingBox
            planName="Enterprise"
            customPricing={true}
            features={[
              {
                featureName: 'Unlimited API calls',
                featureIncluded: true,
              },
              {
                featureName: '24/7 Priority email support',
                featureIncluded: true,
              },
              {
                featureName: 'Custom domain',
                featureIncluded: true,
              },
              {
                featureName: 'Priority support',
                featureIncluded: true,
              },
              {
                featureName: 'Private slack channel',
                featureIncluded: true,
              },
              {
                featureName: 'API rate limiting',
                featureIncluded: true,
              },
              {
                featureName: 'Advanced analytics',
                featureIncluded: true,
              },
              {
                featureName: 'Single sign-on',
                featureIncluded: true,
              },
              {
                featureName: 'Unlimited API calls',
                featureIncluded: true,
              },
              {
                featureName: 'Custom integrations',
                featureIncluded: true,
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}
