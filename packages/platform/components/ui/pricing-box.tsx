import { CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import Button from './button';
import { useState } from 'react';

export default function PricingBox({
  planName,
  planPrice,
  billingOption = 'monthly',
  features,
  customPricing = false,
  subscribedTo = false,
}: {
  planName: string;
  planPrice?: number;
  billingOption?: 'monthly' | 'annualy';
  features?: Array<{
    featureName: string;
    featureIncluded: boolean;
  }>;
  customPricing?: boolean;
  subscribedTo?: boolean;
}) {
  const billingOptions = {
    monthly: 'mo',
    annualy: 'yr',
  };

  const [selectedPlan, setSelectedPlan] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-stroke-weak p-4">
      <span className="">{planName}</span>
      <span className="text-3xl font-bold text-typography-strong">
        {customPricing
          ? 'Custom'
          : `$${planPrice} / ${billingOptions[billingOption]}`}
      </span>
      <div className="flex flex-col gap-2 py-4">
        {features?.map((feature, index) => (
          <div key={index} className="flex items-center gap-2 py-1">
            <span>
              {feature.featureIncluded ? (
                <CheckCircledIcon className="h-4 w-4 text-success" />
              ) : (
                <CrossCircledIcon className="h-4 w-4" />
              )}
            </span>
            <span>{feature.featureName}</span>
          </div>
        ))}
      </div>
      {customPricing ? (
        <Button
          disabled={subscribedTo}
          className="w-full"
          handleClick={() => setSelectedPlan(!selectedPlan)}
        >
          Contact us
        </Button>
      ) : (
        <Button
          disabled={subscribedTo}
          className="w-full"
          handleClick={() => setSelectedPlan(!selectedPlan)}
        >
          {selectedPlan ? 'Selected' : `Select ${planName}`}
        </Button>
      )}
    </div>
  );
}
