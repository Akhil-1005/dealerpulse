'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useFilter } from '@/components/FilterProvider';
import { AlertList } from '@/components/AlertList';
import {
  BranchComparisonChart,
  FunnelView,
  RankedBars,
  TrendCharts,
} from '@/components/charts';
import {
  Badge,
  Card,
  CardHeader,
  DrillLink,
  MiniBar,
  SectionTitle,
  Stat,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { computeAlerts } from '@/lib/alerts';
import {
  formatDays,
  formatINR,
  formatNumber,
  formatPct,
} from '@/lib/format';
import {
  branchScorecards,
  computeFunnel,
  computeKpis,
  computeSources,
  computeTrend,
  leadCohort,
  previousWindow,
  worstRelativeLeak,
  type Filter,
} from '@/lib/metrics';
import { buildNarrative } from '@/lib/narrative';
import { SOURCE_LABELS } from '@/lib/types';

export function Overview() {
  const { from, to, withRange } = useFilter();

  const model = useMemo(() => {
    const filter: Filter = { from, to, branchId: null, repId: null };
    const previous = previousWindow(filter);

    const kpis = computeKpis(filter);
    const prevKpis = previous ? computeKpis(previous) : null;
    const cohort = leadCohort(filter);
    const funnel = computeFunnel(cohort);
    const scorecards = branchScorecards(filter);

    // The branch furthest below the group — the one the chart calls out.
    const active = scorecards.filter((s) => s.leads >= 15);
    const groupConversion =
      cohort.length > 0 ? cohort.filter((l) => l.isWon).length / cohort.length : 0;
    const struggling =
      active
        .filter((s) => s.conversionRate < groupConversion * 0.6)
        .sort((a, b) => a.conversionRate - b.conversionRate)[0] ?? null;

    const leak = worstRelativeLeak(funnel, funnel);

    return {
      filter,
      kpis,
      prevKpis,
      cohort,
      funnel,
      leak,
      scorecards: [...scorecards].sort((a, b) => b.revenue - a.revenue),
      struggling,
      alerts: computeAlerts(filter),
      trend: computeTrend(filter),
      sources: computeSources(cohort),
      narrative: buildNarrative(filter),
    };
  }, [from, to]);

  const { kpis, prevKpis, narrative, alerts, scorecards, struggling } = model;

  const delta = (current: number, previousValue: number | undefined) =>
    prevKpis && previousValue !== undefined && previousValue > 0
      ? current / previousValue - 1
      : null;

  const maxRevenue = Math.max(...scorecards.map((s) => s.revenue), 1);

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* The story, before the numbers                                     */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <h1 className="text-[22px] leading-snug font-semibold tracking-tight text-ink sm:text-[26px]">
          {narrative.headline}
        </h1>
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
          {narrative.points.map((point, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2"
            >
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Vital signs                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="New leads"
            value={formatNumber(kpis.newLeads)}
            delta={delta(kpis.newLeads, prevKpis?.newLeads)}
          />
          <Stat
            label="Delivered"
            value={formatNumber(kpis.deliveredUnits)}
            delta={delta(kpis.deliveredUnits, prevKpis?.deliveredUnits)}
            hint="units"
          />
          <Stat
            label="Revenue"
            value={formatINR(kpis.revenue)}
            delta={delta(kpis.revenue, prevKpis?.revenue)}
          />
          <Stat
            label="Lead → delivery"
            value={formatPct(kpis.conversionRate, 1)}
            delta={delta(kpis.conversionRate, prevKpis?.conversionRate)}
          />
          <Stat
            label="Median cycle"
            value={formatDays(kpis.medianCycleDays)}
            hint="lead to delivery"
          />
          <Stat
            label="Open pipeline"
            value={formatINR(kpis.openPipelineValue)}
            hint={`${formatNumber(kpis.openLeadCount)} live leads`}
          />
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* What to do about it                                               */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionTitle hint="Ranked by value at risk">
          Needs attention
        </SectionTitle>
        <AlertList
          alerts={alerts}
          hrefFor={(alert) =>
            alert.id.startsWith('branch-health-')
              ? withRange(`/branches/${alert.branchId}`)
              : withRange('/actions')
          }
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Branch comparison                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader
            title="Lead-to-delivery conversion by branch"
            subtitle={
              struggling
                ? `${struggling.name} is highlighted because it converts below two-thirds of the group rate.`
                : 'All five branches are converting within a normal band.'
            }
          />
          <BranchComparisonChart
            rows={scorecards}
            highlightId={struggling?.id ?? null}
          />
        </Card>

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Branch scorecard"
              subtitle="Click a branch to drill into its funnel and reps."
              action={
                <Link
                  href={withRange('/branches')}
                  className="rounded text-[13px] font-medium text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  All branches →
                </Link>
              }
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Branch</Th>
                <Th align="right">Leads</Th>
                <Th align="right">Delivered</Th>
                <Th align="right">Conv.</Th>
                <Th>Revenue</Th>
                <Th align="right">At risk</Th>
              </tr>
            </thead>
            <tbody>
              {scorecards.map((row) => (
                <tr key={row.id} className="hover:bg-surface-sunken">
                  <Td>
                    <DrillLink href={withRange(`/branches/${row.id}`)}>
                      {row.name}
                    </DrillLink>
                    <span className="block text-[12px] text-ink-3">{row.subtitle}</span>
                  </Td>
                  <Td align="right" numeric>{formatNumber(row.leads)}</Td>
                  <Td align="right" numeric>{formatNumber(row.delivered)}</Td>
                  <Td align="right" numeric>
                    {row.id === struggling?.id ? (
                      <Badge tone="critical">{formatPct(row.conversionRate, 1)}</Badge>
                    ) : (
                      formatPct(row.conversionRate, 1)
                    )}
                  </Td>
                  <Td className="w-[150px]">
                    <span className="nums mb-1 block text-[12px] text-ink">
                      {formatINR(row.revenue)}
                    </span>
                    <MiniBar value={row.revenue} max={maxRevenue} />
                  </Td>
                  <Td align="right" numeric>
                    {row.atRiskValue > 0 ? (
                      <span className="text-critical">{formatINR(row.atRiskValue)}</span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Trend                                                             */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Delivered by month"
          subtitle="Units and revenue on their own scales, never combined onto one pair of axes. Targets are omitted from the plot on purpose — they run about four times actual delivery in this dataset, which would squash every real bar to a sliver. Switch to the figures to see them."
        />
        <TrendCharts data={model.trend} />
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Funnel + sources                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Where leads are lost"
            subtitle={`Of ${formatNumber(kpis.newLeads)} leads created in this period, ${formatNumber(model.funnel[5].reached)} reached delivery.`}
          />
          <FunnelView
            steps={model.funnel}
            total={model.cohort.length}
            leakStage={null}
          />
        </Card>

        <Card>
          <CardHeader
            title="Which sources actually convert"
            subtitle="Share of each source's leads that reached delivery."
          />
          <RankedBars
            rows={model.sources.map((source) => ({
              key: source.source,
              label: SOURCE_LABELS[source.source],
              value: source.conversionRate,
              note: `${formatNumber(source.leads)} leads`,
            }))}
            valueFormat={(v) => formatPct(v, 1)}
          />
          {model.sources.length > 1 && (
            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-2">
              {SOURCE_LABELS[model.sources[0].source]} converts at{' '}
              {formatPct(model.sources[0].conversionRate, 1)} against{' '}
              {formatPct(model.sources[model.sources.length - 1].conversionRate, 1)}{' '}
              for {SOURCE_LABELS[model.sources[model.sources.length - 1].source]} —
              a gap worth acting on before spending more at the weaker end.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
