/**
 * Alert rules — the "so what" layer.
 *
 * Every rule answers three questions a manager actually has: what is wrong,
 * how much is it worth, and what do I do this morning. Rules that cannot name
 * a rupee figure and a next action do not belong here.
 *
 * Deliberately few rules. An alert list nobody trusts is worse than no alert
 * list, so each branch contributes at most one health alert — whichever leak is
 * genuinely its primary problem — rather than one per failing metric.
 */
import { branches, leads } from './data';
import { formatDays, formatINR, formatPct } from './format';
import {
  worstRelativeLeak,
  computeFunnel,
  isStale,
  leadCohort,
  openLeads,
  overdueDays,
  staleLeads,
  sum,
  type Filter,
} from './metrics';
import { STAGE_LABELS, type Lead, type PipelineStage } from './types';

export type Severity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: Severity;
  /** The one number this alert is about. */
  headline: string;
  title: string;
  /** The diagnosis — why this is happening. */
  body: string;
  /** The recommended next step. */
  action: string;
  /** Rupees exposed, used for ranking. */
  valueAtRisk: number;
  branchId: string | null;
  /** Leads this alert is about, so the action queue can filter to them. */
  leadIds: string[];
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// Rule: orders placed but never delivered
// ---------------------------------------------------------------------------

function stuckDeliveries(f: Filter): Alert[] {
  const stuck = openLeads(f)
    .filter((l) => l.status === 'order_placed' && isStale(l))
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  if (!stuck.length) return [];

  const value = sum(stuck.map((l) => l.deal_value));
  const oldest = stuck[0];
  const severity: Severity = oldest.daysSinceActivity > 60 ? 'critical' : 'warning';

  return [
    {
      id: 'stuck-deliveries',
      severity,
      headline: formatINR(value),
      title: `${stuck.length} orders are signed but undelivered`,
      body:
        `These customers have already committed. Every one is past the 21-day ` +
        `delivery window, and the oldest has been waiting ${formatDays(
          oldest.daysSinceActivity,
        )} — ${oldest.customer_name} at ${oldest.branchName}, ` +
        `${formatINR(oldest.deal_value)}.`,
      action:
        'Revenue already won but not banked. Chase allocation, RTO and finance ' +
        'disbursement before these customers cancel.',
      valueAtRisk: value,
      branchId: f.branchId,
      leadIds: stuck.map((l) => l.id),
    },
  ];
}

// ---------------------------------------------------------------------------
// Rule: live leads going cold
// ---------------------------------------------------------------------------

function coldLeads(f: Filter): Alert[] {
  const cold = staleLeads(f).filter((l) => l.status !== 'order_placed');
  if (!cold.length) return [];

  const value = sum(cold.map((l) => l.deal_value));
  const worst = cold[0];

  // Which stage is leaking most attention?
  const byStage = new Map<PipelineStage, number>();
  for (const lead of cold) {
    const stage = lead.status as PipelineStage;
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
  }
  const [topStage, topCount] = [...byStage.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  return [
    {
      id: 'cold-leads',
      severity: cold.length >= 5 ? 'warning' : 'info',
      headline: formatINR(value),
      title: `${cold.length} active leads have gone quiet`,
      body:
        `Each is past the follow-up window for its stage. The largest is ` +
        `${worst.customer_name} at ${worst.branchName} — ${formatINR(
          worst.deal_value,
        )}, untouched for ${formatDays(worst.daysSinceActivity)} at ` +
        `${STAGE_LABELS[worst.status]}. ${topCount} of them are stalled at ` +
        `${STAGE_LABELS[topStage]}.`,
      action: `Assign follow-up calls today, starting from the top of the action queue.`,
      valueAtRisk: value,
      branchId: f.branchId,
      leadIds: cold.map((l) => l.id),
    },
  ];
}

// ---------------------------------------------------------------------------
// Rule: a branch converting far below the group
// ---------------------------------------------------------------------------

function branchHealth(f: Filter): Alert[] {
  const company = leadCohort({ ...f, branchId: null, repId: null });
  if (company.length < 20) return [];

  const companyConversion =
    company.filter((l) => l.isWon).length / company.length;
  const companyFunnel = computeFunnel(company);

  const scope = f.branchId ? branches.filter((b) => b.id === f.branchId) : branches;

  return scope.flatMap((branch): Alert[] => {
    const cohort = leadCohort({ ...f, branchId: branch.id, repId: null });
    if (cohort.length < 15) return [];

    const conversion = cohort.filter((l) => l.isWon).length / cohort.length;
    // Only fire when a branch is materially adrift, not merely below average.
    if (conversion >= companyConversion * 0.6) return [];

    const funnel = computeFunnel(cohort);
    const leak = worstRelativeLeak(funnel, companyFunnel);

    const avgDeal = sum(cohort.map((l) => l.deal_value)) / cohort.length;
    // What closing the gap to the group average would have been worth.
    const gapValue = (companyConversion - conversion) * cohort.length * avgDeal;

    const where = leak
      ? `The damage is done early, at ${STAGE_LABELS[leak.fromStage]} → ` +
        `${STAGE_LABELS[leak.toStage]}: ${branch.name} moves ` +
        `${formatPct(leak.conversion)} of leads through that step against ` +
        `${formatPct(leak.benchmarkConversion)} across the group, which is ` +
        `roughly ${Math.round(leak.excessLost)} extra leads lost there alone.`
      : '';

    // Where the fix belongs depends on which step is leaking. A first-contact
    // failure is an operations problem; a late-stage one is a selling problem.
    const remedy =
      leak && leak.fromStage === 'new'
        ? `Start with lead handling and follow-up discipline, not with the reps' ` +
          `closing skills — most of these leads are never worked at all.`
        : leak && (leak.fromStage === 'contacted' || leak.fromStage === 'test_drive')
          ? `Look at test drive scheduling and handover quality before anything else.`
          : `Sit in on live negotiations before changing anything structural.`;

    return [
      {
        id: `branch-health-${branch.id}`,
        severity: 'critical',
        headline: formatPct(conversion, 1),
        title: `${branch.name} is converting far below the group`,
        body:
          `${branch.name} turns ${formatPct(conversion, 1)} of its leads into ` +
          `deliveries, against ${formatPct(companyConversion, 1)} company-wide. ` +
          where,
        action:
          `Closing the gap to the group average on the same ${cohort.length} leads ` +
          `is worth about ${formatINR(gapValue)}. ${remedy}`,
        valueAtRisk: gapValue,
        branchId: branch.id,
        leadIds: cohort.filter((l) => l.isLost).map((l) => l.id),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Rule: leads closed as lost with nothing recorded
// ---------------------------------------------------------------------------

function undocumentedLosses(f: Filter): Alert[] {
  const affected = leadCohort(f).filter((l) => l.isUndocumentedLoss);
  if (!affected.length) return [];

  const value = sum(affected.map((l) => l.deal_value));
  const monthsAffected = [...new Set(affected.map((l) => l.createdMonth))];
  const byBranch = new Map<string, number>();
  for (const lead of affected) {
    byBranch.set(lead.branch_id, (byBranch.get(lead.branch_id) ?? 0) + 1);
  }
  const [worstBranchId, worstCount] = [...byBranch.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const worstBranch = branches.find((b) => b.id === worstBranchId);

  return [
    {
      id: 'undocumented-losses',
      severity: 'warning',
      headline: String(affected.length),
      title: 'Leads closed as lost with no reason and no stage change',
      body:
        `${affected.length} leads worth ${formatINR(value)} were marked lost ` +
        `without a recorded reason and without the transition ever being logged. ` +
        `All of them were created in ${monthsAffected.join(', ')}, all were still ` +
        `mid-funnel, and ${worstCount} came from ${worstBranch?.name ?? 'one branch'}.` +
        ` That pattern points at a process or CRM defect, not ${affected.length} ` +
        `unrelated coincidences.`,
      action:
        'Audit how leads are being closed at month-end — these may be recoverable, ' +
        'and the reporting is under-counting real loss reasons either way.',
      valueAtRisk: value,
      branchId: f.branchId,
      leadIds: affected.map((l) => l.id),
    },
  ];
}

// ---------------------------------------------------------------------------
// Rule: reps sitting on stalled value
// ---------------------------------------------------------------------------

function repBacklog(f: Filter): Alert[] {
  const stale = staleLeads(f);
  if (stale.length < 4) return [];

  const byRep = new Map<string, Lead[]>();
  for (const lead of stale) {
    const bucket = byRep.get(lead.assigned_to) ?? [];
    bucket.push(lead);
    byRep.set(lead.assigned_to, bucket);
  }

  const ranked = [...byRep.entries()]
    .map(([repId, group]) => ({
      repId,
      group,
      value: sum(group.map((l) => l.deal_value)),
    }))
    .sort((a, b) => b.value - a.value);

  const top = ranked[0];
  if (!top || top.group.length < 3) return [];

  const rep = top.group[0];
  return [
    {
      id: `rep-backlog-${top.repId}`,
      severity: 'info',
      headline: formatINR(top.value),
      title: `${rep.repName} is carrying the largest stalled book`,
      body:
        `${top.group.length} of ${rep.repName}'s leads at ${rep.branchName} are ` +
        `past their follow-up window, the oldest by ` +
        `${formatDays(Math.max(...top.group.map(overdueDays)))}.`,
      action: 'Review this book in the next one-to-one, or redistribute it.',
      valueAtRisk: top.value,
      branchId: rep.branch_id,
      leadIds: top.group.map((l) => l.id),
    },
  ];
}

// ---------------------------------------------------------------------------

export function computeAlerts(f: Filter): Alert[] {
  return [
    ...stuckDeliveries(f),
    ...branchHealth(f),
    ...coldLeads(f),
    ...undocumentedLosses(f),
    ...repBacklog(f),
  ].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.valueAtRisk - a.valueAtRisk,
  );
}

/** Total exposure across alerts, de-duplicated by lead. */
export function totalValueAtRisk(alerts: Alert[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const alert of alerts) {
    for (const id of alert.leadIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const lead = leads.find((l) => l.id === id);
      if (lead?.isOpen) total += lead.deal_value;
    }
  }
  return total;
}
