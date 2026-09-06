'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFilter } from '@/components/FilterProvider';
import {
  Badge,
  Card,
  DrillLink,
  MiniBar,
  Table,
  Td,
  Th,
} from '@/components/ui';
import {
  formatDays,
  formatINR,
  formatNumber,
  formatPct,
} from '@/lib/format';
import {
  branchScorecards,
  repScorecards,
  type Filter,
  type ScorecardRow,
} from '@/lib/metrics';

type SortKey = keyof Pick<
  ScorecardRow,
  | 'leads'
  | 'contactRate'
  | 'delivered'
  | 'conversionRate'
  | 'revenue'
  | 'atRiskValue'
  | 'medianCycleDays'
>;

const COLUMNS: { key: SortKey; label: string; render: (row: ScorecardRow) => string }[] = [
  { key: 'leads', label: 'Leads', render: (r) => formatNumber(r.leads) },
  { key: 'contactRate', label: 'Contacted', render: (r) => formatPct(r.contactRate) },
  { key: 'delivered', label: 'Delivered', render: (r) => formatNumber(r.delivered) },
  { key: 'conversionRate', label: 'Conversion', render: (r) => formatPct(r.conversionRate, 1) },
  { key: 'medianCycleDays', label: 'Median cycle', render: (r) => (r.medianCycleDays > 0 ? formatDays(r.medianCycleDays) : '—') },
  { key: 'atRiskValue', label: 'At risk', render: (r) => (r.atRiskValue > 0 ? formatINR(r.atRiskValue) : '—') },
];

export function Branches() {
  const { from, to, withRange } = useFilter();
  const [sort, setSort] = useState<SortKey>('revenue');
  const [scope, setScope] = useState<'branch' | 'rep'>('branch');

  const rows = useMemo(() => {
    const filter: Filter = { from, to, branchId: null, repId: null };
    const data = scope === 'branch' ? branchScorecards(filter) : repScorecards(filter);
    return [...data].sort((a, b) => b[sort] - a[sort]);
  }, [from, to, sort, scope]);

  const maxRevenue = Math.max(...rows.map((r) => r.revenue), 1);
  const companyConversion =
    rows.reduce((acc, r) => acc + r.delivered, 0) /
    Math.max(rows.reduce((acc, r) => acc + r.leads, 0), 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
          {scope === 'branch' ? 'Branches' : 'Sales reps'}
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Ranked side by side on the same period. Conversion is measured on the
          cohort of leads <em>created</em> in the window, so a branch is never
          flattered by old leads closing late.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Level"
          className="flex items-center gap-1 rounded-lg bg-surface-sunken p-1"
        >
          {(['branch', 'rep'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              aria-pressed={scope === option}
              className={clsx(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                scope === option
                  ? 'bg-surface text-ink shadow-raised'
                  : 'text-ink-2 hover:text-ink',
              )}
            >
              {option === 'branch' ? 'By branch' : 'By rep'}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-3">
          Group average conversion {formatPct(companyConversion, 1)}
        </p>
      </div>

      <Card padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>{scope === 'branch' ? 'Branch' : 'Rep'}</Th>
              {COLUMNS.map((column) => (
                <Th key={column.key} align="right">
                  <SortButton
                    active={sort === column.key}
                    onClick={() => setSort(column.key)}
                  >
                    {column.label}
                  </SortButton>
                </Th>
              ))}
              <Th>
                <SortButton active={sort === 'revenue'} onClick={() => setSort('revenue')}>
                  Revenue
                </SortButton>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lagging =
                row.leads >= 15 && row.conversionRate < companyConversion * 0.6;
              return (
                <tr key={row.id} className="hover:bg-surface-sunken">
                  <Td>
                    <DrillLink
                      href={withRange(
                        scope === 'branch' ? `/branches/${row.id}` : `/reps/${row.id}`,
                      )}
                    >
                      {row.name}
                    </DrillLink>
                    <span className="block text-[12px] text-ink-3">{row.subtitle}</span>
                  </Td>
                  {COLUMNS.map((column) => (
                    <Td key={column.key} align="right" numeric>
                      {column.key === 'conversionRate' && lagging ? (
                        <Badge tone="critical">{column.render(row)}</Badge>
                      ) : column.key === 'atRiskValue' && row.atRiskValue > 0 ? (
                        <span className="text-critical">{column.render(row)}</span>
                      ) : (
                        column.render(row)
                      )}
                    </Td>
                  ))}
                  <Td className="w-[170px]">
                    <span className="nums mb-1 block text-[12px] text-ink">
                      {formatINR(row.revenue)}
                    </span>
                    <MiniBar
                      value={row.revenue}
                      max={maxRevenue}
                      tone={lagging ? 'critical' : 'brand'}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded text-[11px] font-medium tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
      )}
    >
      {children}
      <span aria-hidden className={clsx('ml-1', !active && 'opacity-0')}>
        ↓
      </span>
    </button>
  );
}
