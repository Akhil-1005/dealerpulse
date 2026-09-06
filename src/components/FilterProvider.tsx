'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { months } from '@/lib/data';

const FIRST = months[0];
const LAST = months[months.length - 1];

export interface RangePreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

/**
 * Presets are derived from the data's own extent rather than from the wall
 * clock, so "Last 3 months" means the last three months *of the export*.
 */
export const RANGE_PRESETS: RangePreset[] = [
  { id: 'm1', label: 'Last month', from: months[months.length - 1], to: LAST },
  { id: 'm3', label: 'Last 3 months', from: months[Math.max(0, months.length - 3)], to: LAST },
  { id: 'm6', label: 'Last 6 months', from: months[Math.max(0, months.length - 6)], to: LAST },
  { id: 'all', label: 'All time', from: FIRST, to: LAST },
];

interface FilterState {
  from: string;
  to: string;
  branchId: string | null;
  /** True while a filter change is being applied — used to hold the old view. */
  isPending: boolean;
  setRange: (from: string, to: string) => void;
  setBranch: (branchId: string | null) => void;
  reset: () => void;
  activePresetId: string | null;
  /** Preserves the current range when linking to another page. */
  withRange: (href: string) => string;
}

const FilterContext = createContext<FilterState | null>(null);

const clampMonth = (value: string | null, fallback: string) =>
  value && months.includes(value) ? value : fallback;

export function FilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const from = clampMonth(params.get('from'), FIRST);
  const rawTo = clampMonth(params.get('to'), LAST);
  // Guard against a hand-edited URL with the bounds inverted.
  const to = rawTo < from ? from : rawTo;
  const branchId = params.get('branch');

  const push = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router],
  );

  const setRange = useCallback(
    (nextFrom: string, nextTo: string) => {
      const next = new URLSearchParams(params.toString());
      // Keep the URL clean: the default range carries no parameters.
      if (nextFrom === FIRST) next.delete('from');
      else next.set('from', nextFrom);
      if (nextTo === LAST) next.delete('to');
      else next.set('to', nextTo);
      push(next);
    },
    [params, push],
  );

  const setBranch = useCallback(
    (nextBranch: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (nextBranch) next.set('branch', nextBranch);
      else next.delete('branch');
      push(next);
    },
    [params, push],
  );

  const reset = useCallback(() => push(new URLSearchParams()), [push]);

  const withRange = useCallback(
    (href: string) => {
      const carried = new URLSearchParams();
      if (from !== FIRST) carried.set('from', from);
      if (to !== LAST) carried.set('to', to);
      const query = carried.toString();
      return query ? `${href}?${query}` : href;
    },
    [from, to],
  );

  const value = useMemo<FilterState>(
    () => ({
      from,
      to,
      branchId,
      isPending,
      setRange,
      setBranch,
      reset,
      activePresetId:
        RANGE_PRESETS.find((p) => p.from === from && p.to === to)?.id ?? null,
      withRange,
    }),
    [from, to, branchId, isPending, setRange, setBranch, reset, withRange],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used inside <FilterProvider>');
  return ctx;
}
