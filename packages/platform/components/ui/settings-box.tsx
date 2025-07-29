import React, { ForwardedRef, forwardRef, useState } from 'react';
import Button from '@/components/ui/button';

interface SettingsBoxProps {
  variant?: string;
  title?: string;
  description?: string;
  note?: string | React.ReactNode;
  disabled?: boolean;
  onSettingSubmit: () => Promise<void>;
  children?: React.ReactNode;
  submitText?: string;
  showSubmitButton?: boolean;
}

const SettingsBox = forwardRef<HTMLFormElement, SettingsBoxProps>(
  (
    {
      variant = 'default',
      title = 'Your Name',
      description = 'This will be your display name on Dashboard MVP',
      note,
      disabled = true,
      onSettingSubmit,
      children,
      submitText = 'Save Changes',
      showSubmitButton = true,
    },
    ref,
  ) => {
    // const { isSubmitting } = useLastSubmit();
    const [disableSubmit, setDisableSubmit] = useState(false);

    return (
      <form
        ref={ref}
        onSubmit={async (e) => {
          e.preventDefault();

          // const submitted = isSubmitting();

          // if (submitted) {
          // 	return;
          // }

          setDisableSubmit(true);

          await onSettingSubmit()
            .then(() => {
              setDisableSubmit(false);
            })
            .catch(() => {
              setDisableSubmit(false);
            });
        }}
        className={`flex flex-col border ${
          variant === 'destructive'
            ? 'border-error-stroke-weak'
            : 'border-stroke-weak'
        } w-full max-w-4xl gap-2 rounded-md`}
      >
        <div className="flex flex-col gap-4 px-8 py-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-gray text-sm">{description}</p>
          </div>
          {children}
        </div>

        <div
          className={`flex items-center justify-between gap-8 rounded-b-md px-8 py-6 ${
            variant === 'destructive'
              ? 'border-t border-error-stroke-weak'
              : 'bg-fill'
          }`}
        >
          <div
            className={`text-sm text-typography-weak ${submitText ? 'py-3' : ''}`}
          >
            {note}
          </div>

          {showSubmitButton && (
            <Button
              variant={variant === 'destructive' ? 'destructive' : ''}
              type="submit"
              disabled={disabled || disableSubmit}
              loading={disableSubmit}
            >
              {submitText}
            </Button>
          )}
        </div>
      </form>
    );
  },
);

SettingsBox.displayName = 'SettingsBox';

export default SettingsBox;
