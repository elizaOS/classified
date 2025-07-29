'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <div className="flex items-center space-x-1 rounded-lg bg-fill p-1">
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex min-h-[44px] min-w-[44px] items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--focus-ring)] ${
            theme === value
              ? 'bg-background font-semibold text-typography-strong shadow-sm'
              : 'text-typography-weak hover:bg-fill-hover hover:text-typography-strong'
          } `}
          data-cy={`theme-${value}`}
          aria-label={`Switch to ${label} theme`}
          aria-pressed={theme === value}
          title={`Switch to ${label} theme${value === 'system' ? ` (currently ${resolvedTheme})` : ''}`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="flex h-10 min-h-[44px] w-10 min-w-[44px] items-center justify-center rounded-lg bg-fill text-typography-strong transition-colors hover:bg-fill-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--focus-ring)]"
      data-cy="theme-toggle"
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
      aria-pressed={resolvedTheme === 'dark'}
      title={`Current theme: ${resolvedTheme}. Click to switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme.`}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
