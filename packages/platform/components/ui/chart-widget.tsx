'use client';

import { ReactNode } from 'react';

interface ChartWidgetProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  error?: string;
  className?: string;
}

export function ChartWidget({
  title,
  children,
  actions,
  loading = false,
  error,
  className = '',
}: ChartWidgetProps) {
  if (loading) {
    return (
      <div
        className={`rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark ${className}`}
      >
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-1/3 rounded bg-fill dark:bg-fill"></div>
          <div className="h-64 rounded bg-fill dark:bg-fill"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark ${className}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-typography-strong dark:text-typography-strong-dark">
            {title}
          </h3>
          {actions}
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-error dark:text-error-dark">⚠️</div>
            <p className="text-sm text-typography-weak dark:text-typography-weak-dark">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-typography-strong dark:text-typography-strong-dark">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  color?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  color = 'text-brand dark:text-brand-dark',
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark">
        <div className="animate-pulse">
          <div className="mb-2 h-4 w-20 rounded bg-fill dark:bg-fill"></div>
          <div className="mb-1 h-8 w-16 rounded bg-fill dark:bg-fill"></div>
          <div className="h-3 w-24 rounded bg-fill dark:bg-fill"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-typography-weak dark:text-typography-weak-dark">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold text-typography-strong dark:text-typography-strong-dark">
            {value}
          </p>
          {change !== undefined && (
            <div className="mt-1 flex items-center">
              <span
                className={`flex items-center text-sm ${
                  change > 0
                    ? 'text-success dark:text-success'
                    : change < 0
                      ? 'text-error dark:text-error-dark'
                      : 'text-typography-weak dark:text-typography-weak-dark'
                }`}
              >
                {change > 0 && '↗'}
                {change < 0 && '↘'}
                {change === 0 && '→'}
                <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
              </span>
              <span className="ml-1 text-sm text-typography-weak dark:text-typography-weak-dark">
                {changeLabel}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`rounded-lg bg-fill p-3 dark:bg-fill ${color}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface SimpleBarChartProps {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  formatValue?: (value: number) => string;
}

export function SimpleBarChart({
  data,
  height = 200,
  formatValue = (v) => v.toString(),
}: SimpleBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-typography-weak dark:text-typography-weak-dark"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end justify-between px-2 pb-8">
        {data.map((point, index) => {
          const barHeight = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          const color = point.color || 'bg-brand dark:bg-brand-dark';

          return (
            <div
              key={index}
              className="flex max-w-16 flex-1 flex-col items-center"
            >
              <div
                className={`w-8 ${color} group relative cursor-pointer rounded-t-sm transition-all hover:opacity-80`}
                style={{
                  height: `${barHeight}%`,
                  minHeight: barHeight > 0 ? '4px' : '0px',
                }}
                title={`${formatValue(point.value)}`}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 transform whitespace-nowrap rounded bg-typography-strong px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 dark:bg-typography-strong-dark dark:text-background-dark">
                  {formatValue(point.value)}
                </div>
              </div>
              <span className="mt-2 origin-center -rotate-45 transform text-xs text-typography-weak dark:text-typography-weak-dark">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
}

export function ProgressBar({
  value,
  max,
  label,
  color = 'bg-brand dark:bg-brand-dark',
  showPercentage = true,
}: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between">
          <span className="text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
            {label}
          </span>
          {showPercentage && (
            <span className="text-sm text-typography-weak dark:text-typography-weak-dark">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-fill dark:bg-fill">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}
