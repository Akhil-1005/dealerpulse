'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatINR,
  formatINRAxis,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatPct,
} from '@/lib/format';
import type { FunnelStep, ScorecardRow, TrendPoint } from '@/lib/metrics';
import { STAGE_LABELS } from '@/lib/types';
import { Table, Td, Th } from './ui';

const SERIES_1 = 'var(--color-series-1)';
const SERIES_2 = 'var(--color-series-2)';
const CRITICAL = 'var(--color-critical)';
const MUTED = 'var(--color-mark-muted)';

const AXIS = {
  stroke: 'var(--color-line-strong)',
  fontSize: 11,
  fill: 'var(--color-ink-3)',
} as const;

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

function TooltipShell({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[12px] font-semibold text-ink">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[12px]">
            {row.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            )}
            <span className="text-ink-2">{row.label}</span>
            <span className="nums ml-auto font-medium text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every chart ships a table-view twin. Colour never carries a value on its own,
 * and the numbers stay reachable without a pointer.
 */
function ChartWithTable({
  chart,
  table,
  tableLabel = 'table',
}: {
  chart: ReactNode;
  table: ReactNode;
  tableLabel?: string;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {showTable ? 'Show chart' : `Show ${tableLabel}`}
        </button>
      </div>
      {showTable ? table : chart}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend — units and revenue as small multiples, never a dual axis
// ---------------------------------------------------------------------------

export function TrendCharts({ data }: { data: TrendPoint[] }) {
  return (
    <ChartWithTable
      tableLabel="figures"
      chart={
        <div className="grid gap-6 lg:grid-cols-2">
          <TrendPanel
            title="Units delivered"
            data={data}
            valueKey="delivered"
            targetKey="targetUnits"
            format={formatNumber}
            axisFormat={(v: number) => String(v)}
          />
          <TrendPanel
            title="Revenue delivered"
            data={data}
            valueKey="revenue"
            targetKey="targetRevenue"
            format={(v: number) => formatINR(v)}
            axisFormat={formatINRAxis}
          />
        </div>
      }
      table={<TrendTable data={data} />}
    />
  );
}

/**
 * Actuals only, deliberately.
 *
 * Plotting the target series alongside would be honest but unreadable: the
 * targets in this dataset run roughly four times actual delivery, so a shared
 * axis squashes every real bar to a sliver and the chart stops communicating.
 * The targets are not hidden — they sit in the table view, one toggle away, and
 * attainment is stated in words on the overview. A chart nobody can read is not
 * a more honest chart.
 */
function TrendPanel({
  title,
  data,
  valueKey,
  targetKey,
  format,
  axisFormat,
}: {
  title: string;
  data: TrendPoint[];
  valueKey: 'delivered' | 'revenue';
  targetKey: 'targetUnits' | 'targetRevenue';
  format: (v: number) => string;
  axisFormat: (v: number) => string;
}) {
  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-[13px] font-medium text-ink-2">
        {title}
      </figcaption>
      {/* Height includes the x-axis band so labels are never clipped. */}
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={{ stroke: AXIS.stroke }}
              tick={{ fontSize: AXIS.fontSize, fill: AXIS.fill }}
              dy={4}
            />
            <YAxis
              tickFormatter={axisFormat}
              tickLine={false}
              axisLine={false}
              width={46}
              tick={{ fontSize: AXIS.fontSize, fill: AXIS.fill }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-sunken)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipShell
                    title={formatMonth(String(label))}
                    rows={[
                      {
                        label: 'Delivered',
                        value: format(Number(payload[0]?.payload?.[valueKey] ?? 0)),
                        color: SERIES_1,
                      },
                      {
                        label: 'Target (see note)',
                        value: format(Number(payload[0]?.payload?.[targetKey] ?? 0)),
                      },
                    ]}
                  />
                ) : null
              }
            />
            {/* One series, so no legend box — the caption names it. Values are
                carried by the axis, the tooltip and the table view. */}
            <Bar
              dataKey={valueKey}
              name="Delivered"
              fill={SERIES_1}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              // Bars re-mount on every filter change; replaying a grow-in
              // animation each time reads as flicker rather than polish.
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function TrendTable({ data }: { data: TrendPoint[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Month</Th>
          <Th align="right">New leads</Th>
          <Th align="right">Delivered</Th>
          <Th align="right">Target units</Th>
          <Th align="right">Revenue</Th>
          <Th align="right">Target revenue</Th>
        </tr>
      </thead>
      <tbody>
        {data.map((point) => (
          <tr key={point.month}>
            <Td className="font-medium text-ink">{formatMonth(point.month)}</Td>
            <Td align="right" numeric>{formatNumber(point.newLeads)}</Td>
            <Td align="right" numeric>{formatNumber(point.delivered)}</Td>
            <Td align="right" numeric>{formatNumber(point.targetUnits)}</Td>
            <Td align="right" numeric>{formatINR(point.revenue)}</Td>
            <Td align="right" numeric>{formatINR(point.targetRevenue)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Branch comparison — one series, one colour, the outlier called out
// ---------------------------------------------------------------------------

export function BranchComparisonChart({
  rows,
  highlightId,
}: {
  rows: ScorecardRow[];
  highlightId?: string | null;
}) {
  const data = [...rows].sort((a, b) => b.conversionRate - a.conversionRate);

  return (
    <ChartWithTable
      tableLabel="figures"
      chart={
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--color-line)" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatPct(v)}
                tickLine={false}
                axisLine={{ stroke: AXIS.stroke }}
                tick={{ fontSize: AXIS.fontSize, fill: AXIS.fill }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={124}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--color-ink-2)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-sunken)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as ScorecardRow;
                  return (
                    <TooltipShell
                      title={`${row.name} · ${row.subtitle}`}
                      rows={[
                        { label: 'Lead → delivered', value: formatPct(row.conversionRate, 1) },
                        { label: 'Leads', value: formatNumber(row.leads) },
                        { label: 'Delivered', value: formatNumber(row.delivered) },
                        { label: 'Revenue', value: formatINR(row.revenue) },
                      ]}
                    />
                  );
                }}
              />
              <Bar
                dataKey="conversionRate"
                radius={[0, 4, 4, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              >
                {data.map((row) => (
                  <Cell
                    key={row.id}
                    // Colour follows the entity's condition, not its rank: only a
                    // branch that is genuinely in trouble takes the status hue.
                    fill={row.id === highlightId ? CRITICAL : SERIES_1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<BranchComparisonTable rows={data} />}
    />
  );
}

function BranchComparisonTable({ rows }: { rows: ScorecardRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Branch</Th>
          <Th align="right">Leads</Th>
          <Th align="right">Contacted</Th>
          <Th align="right">Delivered</Th>
          <Th align="right">Conversion</Th>
          <Th align="right">Revenue</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="font-medium text-ink">{row.name}</Td>
            <Td align="right" numeric>{formatNumber(row.leads)}</Td>
            <Td align="right" numeric>{formatPct(row.contactRate)}</Td>
            <Td align="right" numeric>{formatNumber(row.delivered)}</Td>
            <Td align="right" numeric>{formatPct(row.conversionRate, 1)}</Td>
            <Td align="right" numeric>{formatINR(row.revenue)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

/**
 * Built from layout primitives rather than a charting library: a funnel is a
 * proportion list, and doing it by hand lets the drop-off sit *between* the
 * stages where it belongs, which no stock funnel chart does well.
 *
 * Bar length already encodes magnitude, so every stage shares one hue — ramping
 * the colour too would spend the only free channel restating the length.
 */
export function FunnelView({
  steps,
  total,
  benchmark,
  leakStage,
}: {
  steps: FunnelStep[];
  total: number;
  /** Optional company-wide funnel to compare a branch against. */
  benchmark?: FunnelStep[] | null;
  leakStage?: string | null;
}) {
  if (total === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-ink-3">
        No leads in this period.
      </p>
    );
  }

  return (
    <ChartWithTable
      tableLabel="figures"
      chart={
        <div>
          {benchmark && (
            <div className="mb-4 flex items-center gap-4 text-[12px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: SERIES_1 }}
                />
                This branch
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded"
                  style={{ background: SERIES_2 }}
                />
                Company average
              </span>
            </div>
          )}

          <ol className="space-y-1">
            {steps.map((step, i) => {
              const width = (step.reached / total) * 100;
              const benchWidth = benchmark
                ? (benchmark[i].overallConversion) * 100
                : null;
              const isLeak = leakStage === step.stage;
              const previous = i === 0 ? null : steps[i - 1];
              const lostHere = previous ? previous.reached - step.reached : 0;

              return (
                <li key={step.stage}>
                  {previous && lostHere > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-1 text-[11px]">
                      <span
                        aria-hidden
                        className="ml-1 h-3 w-px bg-line-strong"
                      />
                      <span
                        className={clsx(
                          isLeak ? 'font-medium text-critical' : 'text-ink-3',
                        )}
                      >
                        −{formatNumber(lostHere)} dropped
                        {isLeak && ' · biggest leak'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="w-[92px] shrink-0 text-[12px] font-medium text-ink-2 sm:w-[104px]">
                      {STAGE_LABELS[step.stage]}
                    </span>

                    <div className="relative h-7 min-w-0 flex-1 rounded-md bg-surface-sunken">
                      <div
                        className={clsx(
                          'h-full rounded-md transition-[width] duration-300',
                          isLeak ? 'bg-critical' : 'bg-brand',
                        )}
                        style={{ width: `${Math.max(width, 1.5)}%` }}
                      />
                      {benchWidth !== null && (
                        <span
                          aria-hidden
                          title="Company average"
                          className="absolute inset-y-0 w-0.5 rounded"
                          style={{
                            left: `calc(${Math.min(benchWidth, 100)}% - 1px)`,
                            background: SERIES_2,
                          }}
                        />
                      )}
                    </div>

                    <span className="nums w-[104px] shrink-0 text-right text-[12px] text-ink-2 sm:w-[132px]">
                      <span className="font-semibold text-ink">
                        {formatNumber(step.reached)}
                      </span>{' '}
                      <span className="text-ink-3">
                        ({formatPct(step.overallConversion)})
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      }
      table={<FunnelTable steps={steps} benchmark={benchmark} />}
    />
  );
}

function FunnelTable({
  steps,
  benchmark,
}: {
  steps: FunnelStep[];
  benchmark?: FunnelStep[] | null;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Stage</Th>
          <Th align="right">Reached</Th>
          <Th align="right">Step conversion</Th>
          {benchmark && <Th align="right">Company step</Th>}
          <Th align="right">Dropped here</Th>
          <Th align="right">Still open</Th>
          <Th align="right">Median to next</Th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step, i) => (
          <tr key={step.stage}>
            <Td className="font-medium text-ink">{STAGE_LABELS[step.stage]}</Td>
            <Td align="right" numeric>{formatNumber(step.reached)}</Td>
            <Td align="right" numeric>
              {i === 0 ? '—' : formatPct(step.stepConversion)}
            </Td>
            {benchmark && (
              <Td align="right" numeric>
                {i === 0 ? '—' : formatPct(benchmark[i].stepConversion)}
              </Td>
            )}
            <Td align="right" numeric>{formatNumber(step.droppedHere)}</Td>
            <Td align="right" numeric>{formatNumber(step.stillHere)}</Td>
            <Td align="right" numeric>
              {step.medianDaysToNext > 0
                ? `${step.medianDaysToNext.toFixed(1)}d`
                : '—'}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Horizontal magnitude bars — reused for sources and loss reasons
// ---------------------------------------------------------------------------

export function RankedBars({
  rows,
  valueFormat,
  /**
   * Widens the label gutter for long categories. Lead sources are one or two
   * words and fit the default; delivery delay reasons are full phrases
   * ("Vehicle allocation delayed from factory") and truncate to nonsense
   * without this.
   */
  longLabels = false,
}: {
  rows: { key: string; label: string; value: number; note?: string; tone?: 'brand' | 'critical' }[];
  valueFormat: (value: number) => string;
  longLabels?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length) {
    return <p className="py-6 text-center text-[13px] text-ink-3">Nothing to show.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3">
          <span
            title={row.label}
            className={clsx(
              'shrink-0 truncate text-[12px] text-ink-2',
              longLabels
                ? 'w-[128px] sm:w-[236px] lg:w-[268px]'
                : 'w-[104px] sm:w-[140px]',
            )}
          >
            {row.label}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={clsx(
                'h-full rounded-full',
                row.tone === 'critical' ? 'bg-critical' : 'bg-brand',
              )}
              style={{ width: `${max > 0 ? Math.max((row.value / max) * 100, 2) : 0}%` }}
            />
          </div>
          <span className="nums w-[92px] shrink-0 text-right text-[12px] font-medium text-ink">
            {valueFormat(row.value)}
          </span>
          {row.note && (
            <span className="nums hidden w-[78px] shrink-0 text-right text-[12px] whitespace-nowrap text-ink-3 sm:block">
              {row.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export { MUTED };
