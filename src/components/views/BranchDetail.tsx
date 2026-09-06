'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { notFound } from 'next/navigation';
import { useFilter } from '@/components/FilterProvider';
import { AlertStrip } from '@/components/AlertList';
import { FunnelView, RankedBars } from '@/components/charts';
import {
  Badge,
  Card,
  CardHeader,
  DrillLink,
  EmptyState,
  MiniBar,
  StatCard,
  Table,
  Td,
  Th,
} from '@/components/ui';
import {
  IconCheck,
  IconFunnel,
  IconPipeline,
  IconQueue,
  IconUser,
} from '@/components/icons';
import { computeAlerts } from '@/lib/alerts';
import { getBranch } from '@/lib/data';
import {
  formatDays,
  formatINR,
  formatNumber,
  formatPct,
} from '@/lib/format';
import {
  computeFunnel,
  computeKpis,
  computeLossReasons,
  computeSources,
  leadCohort,
  previousWindow,
  repScorecards,
  staleLeads,
  worstRelativeLeak,
  type Filter,
} from '@/lib/metrics';
import { SOURCE_LABELS, STAGE_LABELS } from '@/lib/types';

export function BranchDetail({ branchId }: { branchId: string }) {
  const { from, to, withRange } = useFilter();
  const branch = getBranch(branchId);

  const model = useMemo(() => {
    if (!branch) return null;

    const filter: Filter = { from, to, branchId, repId: null };
    const company: Filter = { from, to, branchId: null, repId: null };
    const previous = previousWindow(filter);

    const cohort = leadCohort(filter);
    const companyCohort = leadCohort(company);
    const funnel = computeFunnel(cohort);
    const companyFunnel = computeFunnel(companyCohort);

    return {
      filter,
      kpis: computeKpis(filter),
      prevKpis: previous ? computeKpis(previous) : null,
      companyKpis: computeKpis(company),
      cohort,
      funnel,
      companyFunnel,
      leak: worstRelativeLeak(funnel, companyFunnel),
      reps: repScorecards(filter).sort((a, b) => b.revenue - a.revenue),
      alerts: computeAlerts(filter),
      losses: computeLossReasons(cohort),
      sources: computeSources(cohort),
      stale: staleLeads(filter),
    };
  }, [branch, branchId, from, to]);

  if (!branch) notFound();
  if (!model) return null;

  const { kpis, prevKpis, companyKpis, leak } = model;

  const delta = (current: number, previousValue: number | undefined) =>
    prevKpis && previousValue !== undefined && previousValue > 0
      ? current / previousValue - 1
      : null;

  const maxRevenue = Math.max(...model.reps.map((r) => r.revenue), 1);
  const behind = kpis.conversionRate < companyKpis.conversionRate;

  return (
    <div className="space-y-8">
      <header>
        <Link
          href={withRange('/branches')}
          className="rounded text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          ← All branches
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
            {branch.name}
          </h1>
          <Badge>{branch.city}</Badge>
          {branch.managerName && (
            <span className="text-[13px] text-ink-2">
              Managed by{' '}
              <DrillLink href={withRange(`/reps/${branch.managerId}`)}>
                {branch.managerName}
              </DrillLink>
            </span>
          )}
        </div>

        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-2">
          {model.cohort.length === 0 ? (
            'No leads were created at this branch in the selected period.'
          ) : (
            <>
              {branch.name} converted{' '}
              <strong className="font-semibold text-ink">
                {formatPct(kpis.conversionRate, 1)}
              </strong>{' '}
              of its {formatNumber(kpis.newLeads)} leads, against{' '}
              {formatPct(companyKpis.conversionRate, 1)} across the group.
              {leak && (
                <>
                  {' '}
                  Its weakest step relative to the group is{' '}
                  <strong className="font-semibold text-ink">
                    {STAGE_LABELS[leak.fromStage]} → {STAGE_LABELS[leak.toStage]}
                  </strong>
                  , where it moves {formatPct(leak.conversion)} through against{' '}
                  {formatPct(leak.benchmarkConversion)} company-wide — about{' '}
                  {formatNumber(Math.round(leak.excessLost))} leads lost beyond
                  what the group rate would predict.
                </>
              )}
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={<IconUser />}
            chip="blue"
            label="New leads"
            value={formatNumber(kpis.newLeads)}
            delta={delta(kpis.newLeads, prevKpis?.newLeads)}
          />
          <StatCard
            icon={<IconCheck />}
            chip="mint"
            label="Delivered"
            value={formatNumber(kpis.deliveredUnits)}
            delta={delta(kpis.deliveredUnits, prevKpis?.deliveredUnits)}
          />
          <StatCard
            icon={<span className="text-[15px] font-bold">₹</span>}
            chip="gold"
            label="Revenue"
            value={formatINR(kpis.revenue)}
            delta={delta(kpis.revenue, prevKpis?.revenue)}
          />
          <StatCard
            icon={<IconFunnel />}
            chip="violet"
            label="Conversion"
            value={formatPct(kpis.conversionRate, 1)}
            tone={behind ? 'critical' : 'good'}
            hint={`group ${formatPct(companyKpis.conversionRate, 1)}`}
          />
          <StatCard
            icon={<IconQueue />}
            chip="rose"
            label="Median cycle"
            value={kpis.medianCycleDays > 0 ? formatDays(kpis.medianCycleDays) : '—'}
            hint={`group ${formatDays(companyKpis.medianCycleDays)}`}
          />
          <StatCard
            label="Open pipeline"
            value={formatINR(kpis.openPipelineValue)}
            hint={`${formatNumber(kpis.openLeadCount)} live leads`}
            icon={<IconPipeline />}
            chip="blue"
          />
      </div>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
          Open issues here
        </h2>
        <AlertStrip alerts={model.alerts} />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Funnel against the group"
            subtitle="Bars are this branch. The orange marker on each bar is where the company average sits, so a short bar beside a far marker is the leak."
          />
          <FunnelView
            steps={model.funnel}
            total={model.cohort.length}
            benchmark={model.companyFunnel}
            leakStage={leak?.toStage ?? null}
          />
        </Card>

        <Card>
          <CardHeader
            title="Why leads were lost"
            subtitle="Recorded reasons for every lost lead in this period."
          />
          {model.losses.length ? (
            <RankedBars
              rows={model.losses.map((loss) => ({
                key: loss.reason,
                label: loss.reason,
                value: loss.count,
                note: formatINR(loss.value),
                tone: loss.reason === 'No reason recorded' ? 'critical' : 'brand',
              }))}
              valueFormat={(v) => formatNumber(v)}
            />
          ) : (
            <EmptyState
              tone="good"
              title="No losses recorded"
              body="No lead created at this branch in this period has been closed as lost."
            />
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Reps at this branch"
            subtitle="Conversion is on leads created in the period. Click through for an individual's book."
          />
        </div>
        {model.reps.length === 0 ? (
          <div className="px-5 pb-6 sm:px-6">
            <EmptyState
              title="No reps to show"
              body="No sales reps are assigned to this branch."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Rep</Th>
                <Th align="right">Leads</Th>
                <Th align="right">Contacted</Th>
                <Th align="right">Delivered</Th>
                <Th align="right">Conversion</Th>
                <Th align="right">At risk</Th>
                <Th>Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {model.reps.map((rep) => (
                <tr key={rep.id} className="hover:bg-surface-sunken">
                  <Td>
                    <DrillLink href={withRange(`/reps/${rep.id}`)}>{rep.name}</DrillLink>
                    <span className="block text-[12px] text-ink-3">{rep.subtitle}</span>
                  </Td>
                  <Td align="right" numeric>{formatNumber(rep.leads)}</Td>
                  <Td align="right" numeric>{formatPct(rep.contactRate)}</Td>
                  <Td align="right" numeric>{formatNumber(rep.delivered)}</Td>
                  <Td align="right" numeric>{formatPct(rep.conversionRate, 1)}</Td>
                  <Td align="right" numeric>
                    {rep.atRiskValue > 0 ? (
                      <span className="text-critical">{formatINR(rep.atRiskValue)}</span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="w-[160px]">
                    <span className="nums mb-1 block text-[12px] text-ink">
                      {formatINR(rep.revenue)}
                    </span>
                    <MiniBar value={rep.revenue} max={maxRevenue} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Source mix"
            subtitle="Conversion by where the lead came from."
          />
          {model.sources.length ? (
            <RankedBars
              rows={model.sources.map((source) => ({
                key: source.source,
                label: SOURCE_LABELS[source.source],
                value: source.conversionRate,
                note: `${formatNumber(source.leads)} leads`,
              }))}
              valueFormat={(v) => formatPct(v, 1)}
            />
          ) : (
            <EmptyState title="No leads in period" body="Widen the time range." />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Needs chasing today"
              subtitle="Open leads at this branch past their follow-up window."
              action={
                <Link
                  href={withRange('/actions')}
                  className="rounded text-[13px] font-medium text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  Full queue →
                </Link>
              }
            />
          </div>
          {model.stale.length === 0 ? (
            <div className="px-5 pb-6 sm:px-6">
              <EmptyState
                tone="good"
                title="Nothing overdue"
                body="Every open lead at this branch is inside its follow-up window."
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Stage</Th>
                  <Th align="right">Quiet for</Th>
                  <Th align="right">Value</Th>
                </tr>
              </thead>
              <tbody>
                {model.stale.slice(0, 8).map((lead) => (
                  <tr key={lead.id}>
                    <Td>
                      <span className="font-medium text-ink">{lead.customer_name}</span>
                      <span className="block text-[12px] text-ink-3">{lead.repName}</span>
                    </Td>
                    <Td>
                      <Badge tone="warning">{STAGE_LABELS[lead.status]}</Badge>
                    </Td>
                    <Td align="right" numeric>{formatDays(lead.daysSinceActivity)}</Td>
                    <Td align="right" numeric className="font-medium text-ink">
                      {formatINR(lead.deal_value)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
