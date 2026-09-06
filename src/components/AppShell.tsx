'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { AS_OF } from '@/lib/data';
import { formatDate, formatMonth } from '@/lib/format';
import { RANGE_PRESETS, useFilter } from './FilterProvider';
import { ThemeToggle } from './ThemeToggle';
import {
  IconBranches,
  IconCalendar,
  IconOverview,
  IconPipeline,
  IconQueue,
} from './icons';
import { months } from '@/lib/data';

const NAV = [
  { href: '/', label: 'Overview', Icon: IconOverview },
  { href: '/branches', label: 'Branches', Icon: IconBranches },
  { href: '/actions', label: 'Action Queue', Icon: IconQueue },
  { href: '/pipeline', label: 'Pipeline', Icon: IconPipeline },
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
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              active
                ? 'bg-accent-tint text-accent-ink'
                : 'text-ink-2 hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <item.Icon className="size-3.5" />
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
        className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1"
      >
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setRange(preset.from, preset.to)}
            aria-pressed={activePresetId === preset.id}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
              activePresetId === preset.id
                ? 'bg-ink text-surface'
                : 'text-ink-3 hover:bg-surface-sunken hover:text-ink',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* The month bounds read as one chip, like a date-range control. */}
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-3">
        <IconCalendar className="size-3.5" />
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
      className="rounded-md bg-transparent py-0.5 text-[12px] font-semibold text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="flex items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="grid size-[26px] place-items-center rounded-[8px] bg-linear-to-b from-accent to-accent-hover text-[12px] font-extrabold text-ink shadow-raised ring-1 ring-black/5"
                >
                  D
                </span>
                <span className="text-[15px] font-semibold tracking-[-0.014em] text-ink">
                  DealerPulse
                </span>
              </Link>
              <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
                <NavLinks />
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <p className="hidden text-[12px] text-ink-3 lg:block">
                Data as of {formatDate(AS_OF)}
              </p>
              <ThemeToggle />
            </div>
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

      <div className="sticky top-14 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
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
        <p className="border-t border-line pt-6 text-[12px] text-ink-3">
          DealerPulse — synthetic dealership dataset, June–December 2025. All
          figures derive from lead status histories at read time.
        </p>
      </footer>
    </div>
  );
}
