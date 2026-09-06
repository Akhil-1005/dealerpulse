'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { AS_OF } from '@/lib/data';
import { formatDate, formatMonth } from '@/lib/format';
import { RANGE_PRESETS, useFilter } from './FilterProvider';
import { months } from '@/lib/data';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/branches', label: 'Branches' },
  { href: '/actions', label: 'Action Queue' },
  { href: '/pipeline', label: 'Pipeline' },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { withRange } = useFilter();

  return (
    <>
      {NAV.map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={withRange(item.href)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              active
                ? 'bg-brand-tint text-brand-strong'
                : 'text-ink-2 hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * One filter row, above everything it scopes. Per-chart filters are deliberately
 * absent — every card on the page re-renders against this same slice.
 */
function RangeBar() {
  const { from, to, setRange, activePresetId } = useFilter();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div
        role="group"
        aria-label="Time range presets"
        className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-sunken p-1"
      >
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setRange(preset.from, preset.to)}
            aria-pressed={activePresetId === preset.id}
            className={clsx(
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              activePresetId === preset.id
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(16,22,31,0.08)]'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <label className="sr-only" htmlFor="range-from">
          From month
        </label>
        <MonthSelect
          id="range-from"
          value={from}
          onChange={(next) => setRange(next, next > to ? next : to)}
        />
        <span aria-hidden>–</span>
        <label className="sr-only" htmlFor="range-to">
          To month
        </label>
        <MonthSelect
          id="range-to"
          value={to}
          onChange={(next) => setRange(next < from ? next : from, next)}
        />
      </div>
    </div>
  );
}

function MonthSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      {months.map((month) => (
        <option key={month} value={month}>
          {formatMonth(month)}
        </option>
      ))}
    </select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isPending } = useFilter();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="flex items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="grid size-7 place-items-center rounded-md bg-brand text-[13px] font-bold text-white"
                >
                  D
                </span>
                <span className="text-[15px] font-semibold tracking-tight text-ink">
                  DealerPulse
                </span>
              </Link>
              <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
                <NavLinks />
              </nav>
            </div>

            <p className="hidden text-[12px] text-ink-3 lg:block">
              Data as of {formatDate(AS_OF)}
            </p>
          </div>

          {/* Tablet/mobile nav drops to its own scrollable row. */}
          <nav
            aria-label="Primary"
            className="-mx-1 flex items-center gap-1 overflow-x-auto pb-2 md:hidden"
          >
            <NavLinks />
          </nav>
        </div>
      </header>

      <div className="sticky top-14 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 py-2.5 sm:px-6">
          <RangeBar />
        </div>
      </div>

      {/*
        On a filter change we hold the previous render at reduced opacity rather
        than flashing skeletons — no layout jump, and the numbers you were
        reading stay on screen until the new ones are ready.
      */}
      <main
        className={clsx(
          'mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8',
          isPending && 'is-stale-view',
        )}
      >
        {children}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-6">
        <p className="text-[12px] text-ink-3">
          DealerPulse — synthetic dealership dataset, June–December 2025. All
          figures derive from lead status histories at read time.
        </p>
      </footer>
    </div>
  );
}
