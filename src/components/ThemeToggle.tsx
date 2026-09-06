'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dealerpulse-theme';

/**
 * Applies a theme choice.
 *
 * "system" removes the attribute entirely rather than resolving it to a value,
 * so the CSS media query stays in charge and the page follows the OS if the
 * user changes it while the tab is open.
 */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function read(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private browsing or blocked storage — fall back to following the OS.
  }
  return 'system';
}

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
        <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.4v1.7M8 12.9v1.7M14.6 8h-1.7M3.1 8H1.4M12.67 3.33l-1.2 1.2M4.53 11.47l-1.2 1.2M12.67 12.67l-1.2-1.2M4.53 4.53l-1.2-1.2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
        <rect
          x="1.9"
          y="2.6"
          width="12.2"
          height="8.4"
          rx="1.3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M5.6 13.6h4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none">
        <path
          d="M13.4 9.68A5.6 5.6 0 0 1 6.32 2.6a5.6 5.6 0 1 0 7.08 7.08Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  // Starts at the server-rendered default and syncs on mount, so the markup
  // React hydrates against always matches what the server sent.
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(read());
    setMounted(true);
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice still applies for this page view; it just will not persist.
    }
  };

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-pressed={mounted ? theme === option.value : undefined}
          title={option.label}
          className={clsx(
            'grid size-7 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            mounted && theme === option.value
              ? 'bg-surface text-ink shadow-raised'
              : 'text-ink-3 hover:text-ink',
          )}
        >
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Runs before first paint, ahead of React, so a dark-mode user never sees a
 * white flash. Kept as a string because it must be inlined in <head> — the
 * bundle loads far too late to prevent the flash.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
