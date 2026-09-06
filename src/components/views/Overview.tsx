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
  IconAlert,
  IconBranches,
  IconCheck,
  IconFunnel,
  IconPipeline,
  IconQueue,
  IconSource,
  IconTrendUp,
  IconUser,
} from '@/components/icons';
import {
  Avatar,
  Badge,
  Banner,
  Card,
  CardHeader,
  DrillLink,
  MiniBar,
  SectionTitle,
  StatCard,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { computeAlerts } from '@/lib/alerts';
import {
  formatDays,
  formatINR,
  formatMonth,
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
  const bestMonth = [...model.trend]
    .filter((t) => t.delivered > 0)
    .sort((a, b) => b.delivered - a.delivered)[0];

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* The story, before the numbers                                     */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <p className="mb-3 text-[11px] font-semibold tracking-[0.075em] text-ink-3 uppercase">
          The state of the business
        </p>
        {/* The headline is the one sentence to read. Tight tracking and a
            generous measure keep it feeling like a briefing, not a paragraph. */}
        <h1 className="max-w-5xl text-[25px] leading-[1.28] font-semibold tracking-[-0.023em] text-balance text-ink sm:text-[30px]">
          {narrative.headline}
        </h1>
        <ul className="mt-6 grid gap-x-10 gap-y-3.5 lg:grid-cols-2">
          {narrative.points.map((point, i) => (
            <li
              key={i}
              className="flex gap-3 text-[13px] leading-[1.65] text-ink-2"
            >
              <span
                aria-hidden
                className="mt-[7px] h-px w-3 shrink-0 bg-line-strong"
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        {bestMonth && (
          <div className="mt-6">
            <Banner icon={<IconTrendUp className="size-4" />}>
              Best month in the period: {formatMonth(bestMonth.month)} delivered{' '}
              {formatNumber(bestMonth.delivered)} vehicles worth{' '}
              {formatINR(bestMonth.revenue)}.
            </Banner>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Vital signs                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="New leads"
            value={formatNumber(kpis.newLeads)}
            delta={delta(kpis.newLeads, prevKpis?.newLeads)}
            series={model.trend.map((t) => t.newLeads)}
            icon={<IconUser />}
            chip="blue"
          />
          <StatCard
            label="Delivered"
            value={formatNumber(kpis.deliveredUnits)}
            delta={delta(kpis.deliveredUnits, prevKpis?.deliveredUnits)}
            hint="units"
            series={model.trend.map((t) => t.delivered)}
            icon={<IconCheck />}
            chip="mint"
          />
          <StatCard
            label="Revenue"
            value={formatINR(kpis.revenue)}
            delta={delta(kpis.revenue, prevKpis?.revenue)}
            series={model.trend.map((t) => t.revenue)}
            icon={<span className="text-[15px] font-bold">₹</span>}
            chip="gold"
          />
          <StatCard
            label="Lead → delivery"
            value={formatPct(kpis.conversionRate, 1)}
            delta={delta(kpis.conversionRate, prevKpis?.conversionRate)}
            series={model.trend.map((t) => t.conversionRate)}
            icon={<IconFunnel />}
            chip="violet"
          />
          <StatCard
            label="Median cycle"
            value={formatDays(kpis.medianCycleDays)}
            hint="lead to delivery"
            icon={<IconQueue />}
            chip="rose"
          />
          <StatCard
            label="Open pipeline"
            value={formatINR(kpis.openPipelineValue)}
            hint={`${formatNumber(kpis.openLeadCount)} live leads`}
            icon={<IconPipeline />}
            chip="blue"
          />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* What to do about it                                               */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionTitle
          icon={<IconAlert className="size-3.5" />}
          hint="Ranked by value at risk"
        >
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
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader
            icon={<IconBranches className="size-4" />}
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
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.name} id={row.id} size="sm" />
                      <span className="min-w-0">
                        <DrillLink href={withRange(`/branches/${row.id}`)}>
                          {row.name}
                        </DrillLink>
                        <span className="block text-[12px] text-ink-3">
                          {row.subtitle}
                        </span>
                      </span>
                    </div>
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
          icon={<IconTrendUp className="size-4" />}
          title="Delivered by month"
          subtitle="Units and revenue on their own scales, never combined onto one pair of axes. Targets are omitted from the plot on purpose — they run about four times actual delivery in this dataset, which would squash every real bar to a sliver. Switch to the figures to see them."
        />
        <TrendCharts data={model.trend} />
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Funnel + sources                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<IconFunnel className="size-4" />}
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
            icon={<IconSource className="size-4" />}
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
