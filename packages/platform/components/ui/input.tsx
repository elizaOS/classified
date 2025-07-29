'use client';

import React, { forwardRef, ForwardedRef, ChangeEvent } from 'react';
import Spinner from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AsteriskIcon } from 'lucide-react';

interface InputProps {
  id?: string;
  className?: string;
  variant?: string;
  size?: string;
  weight?: string;
  type: string;
  placeholder?: string;
  value?: string;
  name?: string;
  label?: string;
  htmlFor?: string;
  handleChange?: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  onChange?: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  link?: string;
  linkText?: string;
  autoFocus?: boolean;
  placeholderStyle?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  prefix?: string | React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  tooltip?: string;
  success?: boolean;
  hint?: React.ReactNode;
  accept?: string;
  minLength?: number;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      className,
      variant,
      size = 'text-sm',
      weight = 'font-regular',
      type = 'text',
      placeholder,
      value,
      name,
      label,
      htmlFor,
      handleChange,
      onChange,
      onKeyPress,
      autoFocus = false,
      placeholderStyle = 'placeholder-typography-weak',
      loading,
      icon,
      prefix,
      required,
      disabled,
      tooltip = 'false',
      hint,
      accept,
      minLength,
    }: InputProps,
    ref: ForwardedRef<HTMLInputElement>,
  ) => {
    if (variant === 'unstyled' || type === 'file') {
      return (
        <input
          disabled={disabled}
          ref={ref}
          value={value}
          type={type}
          placeholder={placeholder}
          name={name}
          id={id || htmlFor}
          className={`${className} ${size} ${weight} text-high-contrast-text ${placeholderStyle} outline-none`}
          onChange={onChange || handleChange}
          autoFocus={autoFocus}
          required={required}
          accept={accept}
          minLength={minLength}
        />
      );
    }

    if (variant === 'textarea') {
      const Label = ({
        htmlFor,
        label,
        required,
        tooltip,
        hint,
      }: {
        htmlFor: string;
        label: string;
        required?: boolean;
        tooltip?: string;
        hint?: React.ReactNode;
      }) => (
        <div className="flex items-center justify-between">
          <label
            htmlFor={htmlFor}
            className={`text-sm ${weight} flex items-center gap-2`}
          >
            {label}
            {required && tooltip === 'true' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-stroke-weak p-2.5 text-typography-strong">
                      <span>
                        <AsteriskIcon width={14} height={14} />
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Required</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </label>
          {hint && <span className="text-sm text-typography-weak">{hint}</span>}
        </div>
      );

      return (
        <div className="flex flex-col gap-2">
          {label && (
            <Label
              htmlFor={htmlFor || ''}
              label={label}
              required={required}
              tooltip={tooltip}
              hint={hint}
            />
          )}
          <textarea
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            name={name}
            id={id || htmlFor}
            className={`${size} ${weight} transition-effect group flex items-center justify-between overflow-hidden rounded-lg border border-stroke-weak bg-fill p-3 text-typography-strong outline-none hover:border-stroke-medium ${className} min-h-[100px]`}
            onChange={onChange || handleChange}
            autoFocus={autoFocus}
            required={required}
            minLength={minLength}
          />
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={htmlFor}
              className={`text-sm ${weight} flex items-center gap-2`}
            >
              {label}
              {required && tooltip === 'true' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-stroke-weak p-2.5 text-typography-strong">
                        <span>
                          <AsteriskIcon width={14} height={14} />
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Required</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </label>
            {hint && (
              <span className="hidden text-sm text-typography-weak md:block">
                {hint}
              </span>
            )}
          </div>
        )}
        <div
          className={`${disabled ? 'opacity-70' : 'hover:border-stroke-medium'} transition-effect bg-app-bg group flex items-center justify-between overflow-hidden rounded-lg border border-stroke-weak bg-fill`}
        >
          <div className="flex w-full">
            {prefix && (
              <div className="p select-none border-r border-stroke-weak bg-fill p-3 font-medium group-hover:border-stroke-medium">
                <span className={`${size} font-medium`}>{prefix}</span>
              </div>
            )}

            <input
              disabled={disabled}
              ref={ref}
              value={value}
              type={type}
              placeholder={placeholder}
              name={name}
              id={id || htmlFor}
              className={`${className} ${size} ${weight} ${disabled ? 'cursor-not-allowed' : ''} placeholder-typography-weak/50 flex-grow bg-transparent p-3 text-typography-strong outline-none`}
              onChange={onChange || handleChange}
              onKeyPress={onKeyPress}
              autoFocus={autoFocus}
              data-autofocus={autoFocus}
              required={required}
              minLength={minLength}
            />
          </div>

          {icon && (
            <div className="flex items-center justify-center pr-3">
              {loading ? (
                <span className="">
                  <Spinner variant="light" />
                </span>
              ) : (
                <span className="">{icon}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
export { Input };
