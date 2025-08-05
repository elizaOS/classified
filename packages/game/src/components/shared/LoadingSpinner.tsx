/**
 * Loading Spinner Component
 * Professional loading states with various styles and configurations
 */

import React from 'react';

export type LoadingSize = 'small' | 'medium' | 'large';
export type LoadingVariant = 'spinner' | 'dots' | 'terminal';
export type LoadingLayout = 'inline' | 'center' | 'fullscreen';

interface LoadingSpinnerProps {
  /** Loading text to display */
  text?: string;
  /** Additional subtitle text */
  subtext?: string;
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Visual variant of the loader */
  variant?: LoadingVariant;
  /** Layout behavior */
  layout?: LoadingLayout;
  /** Custom className */
  className?: string;
  /** Show/hide the component */
  visible?: boolean;
  /** Terminal-style loading steps (for terminal variant) */
  terminalSteps?: string[];
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = 'Loading',
  subtext,
  size = 'medium',
  variant = 'spinner',
  layout = 'center',
  className = '',
  visible = true,
  terminalSteps = ['Initializing system...', 'Connecting to agent...', 'Loading interface...'],
}) => {
  const [currentStep, setCurrentStep] = React.useState(0);

  // Cycle through terminal steps
  React.useEffect(() => {
    if (variant === 'terminal' && terminalSteps.length > 0) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % terminalSteps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [variant, terminalSteps]);

  if (!visible) {
    return null;
  }

  const layoutClasses = {
    inline: 'inline-flex items-center gap-2',
    center: 'flex flex-col items-center justify-center min-h-[200px]',
    fullscreen: 'fixed inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-50'
  };

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-lg'
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex gap-1">
            <span className={`bg-terminal-green animate-pulse ${size === 'small' ? 'w-1.5 h-1.5' : size === 'large' ? 'w-3 h-3' : 'w-2 h-2'} [animation-delay:0ms]`}></span>
            <span className={`bg-terminal-green animate-pulse ${size === 'small' ? 'w-1.5 h-1.5' : size === 'large' ? 'w-3 h-3' : 'w-2 h-2'} [animation-delay:150ms]`}></span>
            <span className={`bg-terminal-green animate-pulse ${size === 'small' ? 'w-1.5 h-1.5' : size === 'large' ? 'w-3 h-3' : 'w-2 h-2'} [animation-delay:300ms]`}></span>
          </div>
        );

      case 'terminal':
        return (
          <div className="w-full max-w-md">
            {terminalSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 font-mono">
                <span className="text-terminal-green font-bold">{'>'}</span>
                <span
                  className={`text-terminal-green transition-opacity duration-300 ${
                    index <= currentStep ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {index <= currentStep ? step : ''}
                </span>
                {index === currentStep && (
                  <span className="inline-block w-2 h-4 bg-terminal-green animate-pulse" aria-hidden="true"></span>
                )}
              </div>
            ))}
          </div>
        );

      case 'spinner':
      default:
        return (
          <div 
            className={`border-2 border-terminal-green/20 border-t-terminal-green animate-spin ${sizeClasses[size]}`} 
            aria-hidden="true"
          ></div>
        );
    }
  };

  return (
    <div
      className={`${layoutClasses[layout]} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${text}${subtext ? ` - ${subtext}` : ''}`}
    >
      {variant !== 'terminal' && renderSpinner()}

      {variant === 'terminal' ? (
        renderSpinner()
      ) : (
        <>
          {text && (
            <div className={`text-terminal-green font-mono ${textSizeClasses[size]} ${layout === 'inline' ? '' : 'mt-4'}`}>
              {text}
              {variant === 'dots' && (
                <span className="inline-flex gap-0.5 ml-1">
                  <span className="inline-block w-1 h-1 bg-terminal-green animate-pulse [animation-delay:0ms]"></span>
                  <span className="inline-block w-1 h-1 bg-terminal-green animate-pulse [animation-delay:150ms]"></span>
                  <span className="inline-block w-1 h-1 bg-terminal-green animate-pulse [animation-delay:300ms]"></span>
                </span>
              )}
            </div>
          )}

          {subtext && (
            <div className="text-terminal-green/60 text-xs font-mono mt-1">{subtext}</div>
          )}
        </>
      )}
    </div>
  );
};

// Preset loading components for common use cases
export const InlineLoader: React.FC<{ text?: string }> = ({ text = 'Loading' }) => (
  <LoadingSpinner text={text} size="small" layout="inline" variant="dots" />
);

export const FullscreenLoader: React.FC<{
  text?: string;
  subtext?: string;
}> = ({ text = 'Loading ElizaOS', subtext = 'Initializing AI agent interface...' }) => (
  <LoadingSpinner
    text={text}
    subtext={subtext}
    size="large"
    layout="fullscreen"
    variant="spinner"
  />
);

export const TerminalLoader: React.FC<{
  steps?: string[];
  visible?: boolean;
}> = ({
  steps = [
    'Initializing ElizaOS system...',
    'Loading AI agent personality...',
    'Establishing secure connection...',
    'Interface ready!',
  ],
  visible = true,
}) => <LoadingSpinner variant="terminal" layout="center" terminalSteps={steps} visible={visible} />;

export default LoadingSpinner;