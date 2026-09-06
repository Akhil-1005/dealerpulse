'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { notFound } from 'next/navigation';
import { useFilter } from '@/components/FilterProvider';
import { FunnelView } from '@/components/charts';
import {
  Badge,
  Card,
  CardHeader,
  DrillLink,
  EmptyState,
  Stat,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { getRep } from '@/lib/data';
import {
  formatDate,
  formatDays,
  formatINR,
  formatNumber,
  formatPct,
} from '@/lib/format';
import {
  computeFunnel,
  computeKpis,
  computeLossReasons,
  isStale,
  leadCohort,
  openLeads,
  previousWindow,
  repScorecards,
  type Filter,
} from '@/lib/metrics';
import { STAGE_LABELS } from '@/lib/types';

export function RepDetail({ repId }: { repId: string }) {
  const { from, to, withRange } = useFilter();
  const rep = getRep(repId);

  const model = useMemo(() => {
    if (!rep) return null;

    const filter: Filter = { from, to, branchId: null, repId };
    const branchFilter: Filter = { from, to, branchId: rep.branch_id, repId: null };
    const previous = previousWindow(filter);

    const cohort = leadCohort(filter);
    const peers = repScorecards(branchFilter);
    const ranked = [...peers].sort((a, b) => b.conversionRate - a.conversionRate);

    return {
      kpis: computeKpis(filter),
      prevKpis: previous ? computeKpis(previous) : null,
      branchKpis: computeKpis(branchFilter),
      cohort,
      funnel: computeFunnel(cohort),
      branchFunnel: computeFunnel(leadCohort(branchFilter)),
      losses: computeLossReasons(cohort),
      open: openLeads(filter).sort((a, b) => b.deal_value - a.deal_value),
      rank: ranked.findIndex((r) => r.id === repId) + 1,
      peerCount: ranked.length,
    };
  }, [rep, repId, from, to]);

  if (!rep) notFound();
  if (!model) return null;

  const { kpis, prevKpis, branchKpis } = model;
  const delta = (current: number, previousValue: number | undefined) =>
    prevKpis && previousValue !== undefined && previousValue > 0
      ? current / previousValue - 1
      : null;

  const ahead = kpis.conversionRate >= branchKpis.conversionRate;

  return (
    <div className="space-y-8">
      <header>
        <Link
          href={withRange(`/branches/${rep.branch_id}`)}
          className="rounded text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          ← {rep.branchName}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
            {rep.name}
          </h1>
          <Badge tone={rep.role === 'branch_manager' ? 'brand' : 'neutral'}>
            {rep.role === 'branch_manager' ? 'Branch Manager' : 'Sales Officer'}
          </Badge>
          <span className="text-[13px] text-ink-3">
            At {rep.branchName} since {formatDate(rep.joined)}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-2">
          {model.cohort.length === 0 ? (
            'No leads were assigned to this rep in the selected period.'
          ) : (
            <>
              {rep.name} was assigned {formatNumber(kpis.newLeads)} leads and
              delivered {formatNumber(model.cohort.filter((l) => l.isWon).length)} of
              them —{' '}
              <strong className="font-semibold text-ink">
                {formatPct(kpis.conversionRate, 1)}
              </strong>
              , against {formatPct(branchKpis.conversionRate, 1)} for the branch.
              {model.rank > 0 &&
                ` That ranks ${model.rank} of ${model.peerCount} at ${rep.branchName}.`}
            </>
          )}
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 xl:grid-cols-5">
          <Stat
            label="Leads assigned"
            value={formatNumber(kpis.newLeads)}
            delta={delta(kpis.newLeads, prevKpis?.newLeads)}
          />
          <Stat
            label="Delivered"
            value={formatNumber(kpis.deliveredUnits)}
            delta={delta(kpis.deliveredUnits, prevKpis?.deliveredUnits)}
          />
          <Stat label="Revenue" value={formatINR(kpis.revenue)} />
          <Stat
            label="Conversion"
            value={formatPct(kpis.conversionRate, 1)}
            tone={ahead ? 'good' : 'critical'}
            hint={`branch ${formatPct(branchKpis.conversionRate, 1)}`}
          />
          <Stat
            label="Open book"
            value={formatINR(kpis.openPipelineValue)}
            hint={`${formatNumber(kpis.openLeadCount)} live leads`}
          />
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Funnel against the branch"
            subtitle="Bars are this rep; the orange marker is the branch average."
          />
          <FunnelView
            steps={model.funnel}
            total={model.cohort.length}
            benchmark={model.branchFunnel}
          />
        </Card>

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Live book"
              subtitle="Every open lead this rep is carrying, largest first."
            />
          </div>
          {model.open.length === 0 ? (
            <div className="px-5 pb-6 sm:px-6">
              <EmptyState
                title="No open leads"
                body="This rep has nothing live in the pipeline right now."
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
                {model.open.map((lead) => (
                  <tr key={lead.id}>
                    <Td>
                      <span className="font-medium text-ink">{lead.customer_name}</span>
                      <span className="block text-[12px] text-ink-3">
                        {lead.model_interested}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={isStale(lead) ? 'critical' : 'neutral'}>
                        {STAGE_LABELS[lead.status]}
                      </Badge>
                    </Td>
                    <Td align="right" numeric>
                      <span className={isStale(lead) ? 'font-medium text-critical' : ''}>
                        {formatDays(lead.daysSinceActivity)}
                      </span>
                    </Td>
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

      {model.losses.length > 0 && (
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Losses in this period"
              subtitle="What this rep's lost leads gave as their reason."
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Reason</Th>
                <Th align="right">Leads</Th>
                <Th align="right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {model.losses.map((loss) => (
                <tr key={loss.reason}>
                  <Td className="font-medium text-ink">{loss.reason}</Td>
                  <Td align="right" numeric>{formatNumber(loss.count)}</Td>
                  <Td align="right" numeric>{formatINR(loss.value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <p className="text-[12px] text-ink-3">
        Looking at the wider picture?{' '}
        <DrillLink href={withRange(`/branches/${rep.branch_id}`)}>
          Back to {rep.branchName}
        </DrillLink>
      </p>
    </div>
  );
}
