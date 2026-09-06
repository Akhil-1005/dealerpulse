'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFilter } from '@/components/FilterProvider';
import {
  Badge,
  Card,
  DrillLink,
  EmptyState,
  SectionTitle,
  Stat,
  StatusDot,
} from '@/components/ui';
import { branches } from '@/lib/data';
import {
  formatDate,
  formatDays,
  formatINR,
  formatNumber,
} from '@/lib/format';
import {
  overdueDays,
  staleLeads,
  sum,
  type Filter,
} from '@/lib/metrics';
import { STAGE_LABELS, type Lead } from '@/lib/types';

type Lens = 'all' | 'orders' | 'cold';

const LENSES: { id: Lens; label: string; blurb: string }[] = [
  { id: 'all', label: 'Everything', blurb: 'Every lead past its follow-up window.' },
  {
    id: 'orders',
    label: 'Signed but undelivered',
    blurb:
      'Orders the customer has already committed to that have not been handed over. This is revenue won and not banked.',
  },
  {
    id: 'cold',
    label: 'Going cold',
    blurb:
      'Live leads that have had no activity for longer than their stage allows.',
  },
];

/** Severity of a stalled lead, from how far past its own threshold it has drifted. */
function urgency(lead: Lead): 'critical' | 'warning' {
  return overdueDays(lead) > 30 ? 'critical' : 'warning';
}

function toCsv(rows: Lead[]): string {
  const header = [
    'Lead ID',
    'Customer',
    'Phone',
    'Branch',
    'Owner',
    'Stage',
    'Deal value (INR)',
    'Days since activity',
    'Days overdue',
    'Model',
    'Source',
  ];
  const body = rows.map((lead) =>
    [
      lead.id,
      lead.customer_name,
      lead.phone,
      lead.branchName,
      lead.repName,
      STAGE_LABELS[lead.status],
      lead.deal_value,
      Math.round(lead.daysSinceActivity),
      Math.round(overdueDays(lead)),
      lead.model_interested,
      lead.source,
    ]
      // Quote every field and escape embedded quotes — customer names are free text.
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...body].join('\n');
}

export function ActionQueue() {
  const { from, to, branchId, setBranch } = useFilter();
  const [lens, setLens] = useState<Lens>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const model = useMemo(() => {
    const filter: Filter = { from, to, branchId, repId: null };
    const all = staleLeads(filter);
    const orders = all.filter((l) => l.status === 'order_placed');
    const cold = all.filter((l) => l.status !== 'order_placed');
    return { all, orders, cold };
  }, [from, to, branchId]);

  const rows =
    lens === 'orders' ? model.orders : lens === 'cold' ? model.cold : model.all;

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dealerpulse-action-queue-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeLens = LENSES.find((l) => l.id === lens)!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
          Action queue
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Every open lead that has gone quiet for longer than its stage allows,
          ranked by rupees at risk weighted by how overdue it is. Thresholds vary
          by stage — a new enquiry is chased after 2 days, an order awaiting
          delivery after 21 — so the list stays short enough to work through.
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
          <Stat
            label="Leads to chase"
            value={formatNumber(model.all.length)}
            tone={model.all.length > 0 ? 'critical' : 'good'}
          />
          <Stat
            label="Value at risk"
            value={formatINR(sum(model.all.map((l) => l.deal_value)))}
          />
          <Stat
            label="Signed, undelivered"
            value={formatINR(sum(model.orders.map((l) => l.deal_value)))}
            hint={`${formatNumber(model.orders.length)} orders`}
          />
          <Stat
            label="Longest wait"
            value={
              model.all.length
                ? formatDays(Math.max(...model.all.map((l) => l.daysSinceActivity)))
                : '—'
            }
          />
        </div>
      </Card>

      {/* Lens + branch scope, in one row above the list. */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Queue lens"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-sunken p-1"
        >
          {LENSES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLens(option.id)}
              aria-pressed={lens === option.id}
              className={clsx(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                lens === option.id
                  ? 'bg-surface text-ink shadow-raised'
                  : 'text-ink-2 hover:text-ink',
              )}
            >
              {option.label}
              <span className="nums ml-1.5 text-ink-3">
                {option.id === 'orders'
                  ? model.orders.length
                  : option.id === 'cold'
                    ? model.cold.length
                    : model.all.length}
              </span>
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="queue-branch">
          Branch
        </label>
        <select
          id="queue-branch"
          value={branchId ?? ''}
          onChange={(e) => setBranch(e.target.value || null)}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={download}
          disabled={!rows.length}
          className="ml-auto rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Export CSV
        </button>
      </div>

      <p className="text-[13px] leading-relaxed text-ink-2">{activeLens.blurb}</p>

      {rows.length === 0 ? (
        <EmptyState
          tone="good"
          title="Queue is clear"
          body="Nothing in this scope is past its follow-up window. Try widening the time range or switching branch."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((lead) => {
              const isOpen = expanded === lead.id;
              const tone = urgency(lead);
              return (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : lead.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:-outline-offset-2 sm:px-6"
                  >
                    <StatusDot tone={tone} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {lead.customer_name}
                      </p>
                      <p className="truncate text-[12px] text-ink-3">
                        {lead.model_interested} · {lead.branchName} · {lead.repName}
                      </p>
                    </div>

                    <div className="hidden w-[128px] shrink-0 sm:block">
                      <Badge tone={tone === 'critical' ? 'critical' : 'warning'}>
                        {STAGE_LABELS[lead.status]}
                      </Badge>
                    </div>

                    <div className="w-[92px] shrink-0 text-right">
                      <p className="nums text-[13px] font-medium text-ink">
                        {formatDays(lead.daysSinceActivity)}
                      </p>
                      <p className="nums text-[11px] text-ink-3">
                        {formatDays(overdueDays(lead))} over
                      </p>
                    </div>

                    <div className="w-[88px] shrink-0 text-right">
                      <p className="nums text-[13px] font-semibold text-ink">
                        {formatINR(lead.deal_value)}
                      </p>
                    </div>

                    <span
                      aria-hidden
                      className={clsx(
                        'shrink-0 text-ink-3 transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    >
                      ›
                    </span>
                  </button>

                  {isOpen && <LeadJourney lead={lead} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

/**
 * The lead's full recorded journey. This is the payoff of keeping every
 * `status_history` entry — a manager picking up a stalled deal can see exactly
 * what was last said to the customer and when.
 */
function LeadJourney({ lead }: { lead: Lead }) {
  const { withRange } = useFilter();

  return (
    <div className="border-t border-line bg-surface-sunken px-5 py-5 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <SectionTitle>Journey</SectionTitle>
          <ol className="space-y-3">
            {lead.status_history.map((event, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={clsx(
                      'mt-1 size-2 shrink-0 rounded-full',
                      i === lead.status_history.length - 1
                        ? 'bg-brand'
                        : 'bg-line-strong',
                    )}
                  />
                  {i < lead.status_history.length - 1 && (
                    <span aria-hidden className="w-px flex-1 bg-line-strong" />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-[13px] font-medium text-ink">
                    {STAGE_LABELS[event.status]}
                    <span className="nums ml-2 font-normal text-ink-3">
                      {formatDate(event.timestamp)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
                    {event.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <dl className="space-y-3 text-[13px]">
          <Detail label="Lead ID" value={lead.id} />
          <Detail label="Phone" value={lead.phone} />
          <Detail label="Source" value={lead.source.replace(/_/g, ' ')} />
          <Detail label="Expected close" value={formatDate(lead.expected_close_date)} />
          <Detail
            label="Owner"
            value={
              <DrillLink href={withRange(`/reps/${lead.assigned_to}`)}>
                {lead.repName}
              </DrillLink>
            }
          />
          <Detail
            label="Branch"
            value={
              <DrillLink href={withRange(`/branches/${lead.branch_id}`)}>
                {lead.branchName}
              </DrillLink>
            }
          />
        </dl>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink capitalize">{value}</dd>
    </div>
  );
}
