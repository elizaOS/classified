import Spinner from './spinner';
import Link from 'next/link';

function Button({
  className,
  children,
  type = 'button',
  variant,
  loading = false,
  disabled,
  handleClick,
  href,
  ...props
}: {
  className?: string;
  color?: string;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: string;
  loading?: boolean;
  disabled?: boolean;
  handleClick?: () => void;
  href?: string;
  [key: string]: any; // Allow any additional props like data-cy
}) {
  // const backgroundColor = color ? `bg-${color}` : undefined;
  // TODO: create variants for destructive, outline, ghost, link, icon, text w/ icon
  // reference: https://ui.shadcn.com/docs/components/button

  if (variant === 'link') {
    return (
      <Link
        className={`${className} text-typography-strong hover:text-typography-strong`}
        onClick={handleClick}
        href={href || ''}
        {...props}
      >
        {children}
      </Link>
    );
  }

  if (variant === 'destructive') {
    return (
      <button
        type={type}
        disabled={loading || disabled}
        className={`btn btn-destructive whitespace-nowrap ${className} ${
          (loading || disabled) && 'btn-disabled'
        }`}
        onClick={handleClick}
        {...props}
      >
        {loading && <Spinner />}

        {children}
      </button>
    );
  }

  if (variant === 'unstyled') {
    return (
      <button
        type={type}
        disabled={loading || disabled}
        className={`${className} whitespace-nowrap ${
          (loading || disabled) && 'btn-disabled'
        } group flex items-center`}
        onClick={handleClick}
        {...props}
      >
        <span className={loading ? 'pr-2' : ''}>{loading && <Spinner />}</span>

        {children}
      </button>
    );
  }

  const buttonClasses =
    variant === 'secondary'
      ? 'btn btn-secondary'
      : variant === 'destructive'
        ? 'btn btn-destructive'
        : variant === 'brand'
          ? 'btn btn-brand'
          : variant === 'outline'
            ? 'btn btn-outline'
            : variant === 'outline-brand'
              ? 'btn btn-outline-brand'
              : 'btn btn-accent';

  return (
    <button
      type={type}
      disabled={loading || disabled}
      className={`${className} ${buttonClasses} whitespace-nowrap ${
        (loading || disabled) && 'btn-disabled'
      } group flex items-center`}
      onClick={handleClick}
      {...props}
    >
      <span className={loading ? 'pr-2' : ''}>
        {loading && (
          <Spinner variant={variant === 'brand' ? 'light' : 'dark'} />
        )}
      </span>

      {children}
    </button>
  );
}

export default Button;
export { Button };
