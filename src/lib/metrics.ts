import { AS_OF, branches, leads, months, salesReps, targets } from './data';
import {
  PIPELINE_STAGES,
  type Lead,
  type LeadSource,
  type PipelineStage,
} from './types';

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface Filter {
  /** Inclusive month bounds, e.g. "2025-06" .. "2025-12". */
  from: string;
  to: string;
  branchId: string | null;
  repId: string | null;
}

export const defaultFilter = (): Filter => ({
  from: months[0],
  to: months[months.length - 1],
  branchId: null,
  repId: null,
});

export function monthsInRange(from: string, to: string): string[] {
  return months.filter((m) => m >= from && m <= to);
}

/** The window immediately before `filter`, same length — used for deltas. */
export function previousWindow(filter: Filter): Filter | null {
  const span = monthsInRange(filter.from, filter.to).length;
  const startIdx = months.indexOf(filter.from);
  if (startIdx <= 0) return null;
  const prevEnd = startIdx - 1;
  const prevStart = Math.max(0, prevEnd - span + 1);
  return { ...filter, from: months[prevStart], to: months[prevEnd] };
}

const matchesOrg = (lead: Lead, f: Filter) =>
  (!f.branchId || lead.branch_id === f.branchId) &&
  (!f.repId || lead.assigned_to === f.repId);

/**
 * Leads by *creation* month — a cohort lens. Conversion and funnel metrics use
 * this so we always compare leads that entered the business in the same window,
 * rather than mixing a fresh lead with one that has had six months to close.
 */
export function leadCohort(f: Filter): Lead[] {
  return leads.filter(
    (l) => matchesOrg(l, f) && l.createdMonth >= f.from && l.createdMonth <= f.to,
  );
}

/**
 * Leads *delivered* within the window — a bookings lens. Revenue, units and
 * target attainment use this, because a sale belongs to the month it landed.
 */
export function deliveredIn(f: Filter): Lead[] {
  return leads.filter(
    (l) =>
      matchesOrg(l, f) &&
      l.deliveredMonth !== null &&
      l.deliveredMonth >= f.from &&
      l.deliveredMonth <= f.to,
  );
}

/**
 * Currently-open leads. Deliberately *not* date-filtered: a lead going cold is
 * a fact about right now, not about the reporting window. Org filters still
 * apply so a branch manager sees only their own queue.
 */
export function openLeads(f: Filter): Lead[] {
  return leads.filter((l) => l.isOpen && matchesOrg(l, f));
}

// ---------------------------------------------------------------------------
// Small statistical helpers
// ---------------------------------------------------------------------------

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

// ---------------------------------------------------------------------------
// Headline KPIs
// ---------------------------------------------------------------------------

export interface Kpis {
  newLeads: number;
  deliveredUnits: number;
  revenue: number;
  conversionRate: number;
  medianCycleDays: number;
  openPipelineValue: number;
  openLeadCount: number;
  targetUnits: number;
  targetRevenue: number;
  unitAttainment: number;
  revenueAttainment: number;
}

export function computeKpis(f: Filter): Kpis {
  const cohort = leadCohort(f);
  const won = deliveredIn(f);
  const open = openLeads(f);

  const cycleTimes = cohort
    .filter((l) => l.isWon)
    .map((l) => (l.lastActivityAt - l.createdAt) / 86_400_000);

  const scopedTargets = targets.filter(
    (t) =>
      t.month >= f.from &&
      t.month <= f.to &&
      (!f.branchId || t.branch_id === f.branchId),
  );
  const targetUnits = sum(scopedTargets.map((t) => t.target_units));
  const targetRevenue = sum(scopedTargets.map((t) => t.target_revenue));
  const revenue = sum(won.map((l) => l.deal_value));

  return {
    newLeads: cohort.length,
    deliveredUnits: won.length,
    revenue,
    conversionRate: ratio(cohort.filter((l) => l.isWon).length, cohort.length),
    medianCycleDays: median(cycleTimes),
    openPipelineValue: sum(open.map((l) => l.deal_value)),
    openLeadCount: open.length,
    targetUnits,
    targetRevenue,
    // Targets are set per branch, so a rep-level filter cannot be reconciled
    // against them. Attainment is suppressed rather than shown misleadingly.
    unitAttainment: f.repId ? 0 : ratio(won.length, targetUnits),
    revenueAttainment: f.repId ? 0 : ratio(revenue, targetRevenue),
  };
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export interface FunnelStep {
  stage: PipelineStage;
  reached: number;
  /** Share of the previous stage that made it here. */
  stepConversion: number;
  /** Share of the whole cohort that made it here. */
  overallConversion: number;
  /** Lost leads whose journey ended at this stage. */
  droppedHere: number;
  /** Open leads sitting at this stage right now. */
  stillHere: number;
  medianDaysToNext: number;
}

export function computeFunnel(cohort: Lead[]): FunnelStep[] {
  const reachedCount = (stage: PipelineStage) =>
    cohort.filter((l) => l.furthestStageIndex >= PIPELINE_STAGES.indexOf(stage))
      .length;

  return PIPELINE_STAGES.map((stage, i) => {
    const reached = reachedCount(stage);
    const previous =
      i === 0 ? cohort.length : reachedCount(PIPELINE_STAGES[i - 1]);
    const next = PIPELINE_STAGES[i + 1];

    const hops = next
      ? cohort.flatMap((l) =>
          l.transitions
            .filter((t) => t.from === stage && t.to === next)
            .map((t) => t.days),
        )
      : [];

    return {
      stage,
      reached,
      stepConversion: i === 0 ? 1 : ratio(reached, previous),
      overallConversion: ratio(reached, cohort.length),
      droppedHere: cohort.filter((l) => l.isLost && l.furthestStage === stage)
        .length,
      stillHere: cohort.filter((l) => l.isOpen && l.status === stage).length,
      medianDaysToNext: median(hops),
    };
  });
}

/** The single worst leak in a funnel — what the branch page leads with. */
export function biggestLeak(steps: FunnelStep[]): FunnelStep | null {
  const candidates = steps
    .slice(1)
    .filter((s) => s.reached > 0 || s.droppedHere > 0);
  if (!candidates.length) return null;
  return candidates.reduce((worst, s) =>
    s.stepConversion < worst.stepConversion ? s : worst,
  );
}

export interface LeakDiagnosis {
  fromStage: PipelineStage;
  toStage: PipelineStage;
  conversion: number;
  benchmarkConversion: number;
  leadsLost: number;
  /** Leads lost beyond what the benchmark rate would predict. */
  excessLost: number;
}

/**
 * Where a funnel leaks *worse than its benchmark*, ranked by the number of
 * leads that excess costs.
 *
 * Ranking purely by the lowest conversion rate picks whichever stage happens to
 * be narrowest, which is usually late in the funnel where the volumes are tiny.
 * A branch losing 15 extra leads at first contact has a far bigger problem than
 * one losing 3 extra at negotiation, and this is what points a manager at the
 * fix that actually pays.
 */
export function worstRelativeLeak(
  steps: FunnelStep[],
  benchmark: FunnelStep[],
): LeakDiagnosis | null {
  let worst: LeakDiagnosis | null = null;

  for (let i = 1; i < steps.length; i += 1) {
    const entered = steps[i - 1].reached;
    if (entered === 0) continue;

    const leadsLost = entered - steps[i].reached;
    const benchmarkConversion = benchmark[i]?.stepConversion ?? 0;
    const excessLost = leadsLost - entered * (1 - benchmarkConversion);

    if (!worst || excessLost > worst.excessLost) {
      worst = {
        fromStage: steps[i - 1].stage,
        toStage: steps[i].stage,
        conversion: steps[i].stepConversion,
        benchmarkConversion,
        leadsLost,
        excessLost,
      };
    }
  }

  // A gap of under one lead is either rounding noise or not worth a manager's
  // morning. Comparing a funnel against itself must yield nothing at all, and
  // floating-point residue would otherwise report a leak of ~1e-14 leads.
  return worst && worst.excessLost >= 1 ? worst : null;
}

// ---------------------------------------------------------------------------
// Branch and rep comparison
// ---------------------------------------------------------------------------

export interface ScorecardRow {
  id: string;
  name: string;
  subtitle: string;
  leads: number;
  contacted: number;
  contactRate: number;
  delivered: number;
  conversionRate: number;
  revenue: number;
  targetRevenue: number;
  revenueAttainment: number;
  openValue: number;
  atRiskValue: number;
  medianCycleDays: number;
}

function scorecard(
  id: string,
  name: string,
  subtitle: string,
  cohort: Lead[],
  won: Lead[],
  open: Lead[],
  targetRevenue: number,
): ScorecardRow {
  const revenue = sum(won.map((l) => l.deal_value));
  const contacted = cohort.filter((l) => l.furthestStageIndex >= 1).length;
  const cycles = cohort
    .filter((l) => l.isWon)
    .map((l) => (l.lastActivityAt - l.createdAt) / 86_400_000);

  return {
    id,
    name,
    subtitle,
    leads: cohort.length,
    contacted,
    contactRate: ratio(contacted, cohort.length),
    delivered: won.length,
    conversionRate: ratio(cohort.filter((l) => l.isWon).length, cohort.length),
    revenue,
    targetRevenue,
    revenueAttainment: ratio(revenue, targetRevenue),
    openValue: sum(open.map((l) => l.deal_value)),
    atRiskValue: sum(open.filter(isStale).map((l) => l.deal_value)),
    medianCycleDays: median(cycles),
  };
}

export function branchScorecards(f: Filter): ScorecardRow[] {
  return branches.map((branch) => {
    const scoped: Filter = { ...f, branchId: branch.id, repId: null };
    const targetRevenue = sum(
      targets
        .filter(
          (t) =>
            t.branch_id === branch.id && t.month >= f.from && t.month <= f.to,
        )
        .map((t) => t.target_revenue),
    );
    return scorecard(
      branch.id,
      branch.name,
      branch.city,
      leadCohort(scoped),
      deliveredIn(scoped),
      openLeads(scoped),
      targetRevenue,
    );
  });
}

export function repScorecards(f: Filter): ScorecardRow[] {
  const roster = f.branchId
    ? salesReps.filter((r) => r.branch_id === f.branchId)
    : salesReps;

  return roster.map((rep) => {
    const scoped: Filter = { ...f, repId: rep.id, branchId: null };
    // Within a single branch the branch name under every row is noise, so the
    // subtitle carries the role instead. Across all branches it is the opposite.
    const subtitle =
      rep.role === 'branch_manager'
        ? 'Branch Manager'
        : f.branchId
          ? 'Sales Officer'
          : rep.branchName;
    return scorecard(
      rep.id,
      rep.name,
      subtitle,
      leadCohort(scoped),
      deliveredIn(scoped),
      openLeads(scoped),
      0,
    );
  });
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export interface TrendPoint {
  month: string;
  newLeads: number;
  delivered: number;
  revenue: number;
  targetUnits: number;
  targetRevenue: number;
  lost: number;
  /** Cohort conversion for the month — powers the KPI sparklines. */
  conversionRate: number;
}

export function computeTrend(f: Filter): TrendPoint[] {
  return monthsInRange(f.from, f.to).map((month) => {
    const window: Filter = { ...f, from: month, to: month };
    const cohort = leadCohort(window);
    const won = deliveredIn(window);
    const scopedTargets = targets.filter(
      (t) => t.month === month && (!f.branchId || t.branch_id === f.branchId),
    );
    return {
      month,
      newLeads: cohort.length,
      delivered: won.length,
      revenue: sum(won.map((l) => l.deal_value)),
      targetUnits: sum(scopedTargets.map((t) => t.target_units)),
      targetRevenue: sum(scopedTargets.map((t) => t.target_revenue)),
      lost: cohort.filter((l) => l.isLost).length,
      conversionRate: ratio(cohort.filter((l) => l.isWon).length, cohort.length),
    };
  });
}

// ---------------------------------------------------------------------------
// Source and loss analysis
// ---------------------------------------------------------------------------

export interface SourceRow {
  source: LeadSource;
  leads: number;
  delivered: number;
  conversionRate: number;
  revenue: number;
  avgDealValue: number;
}

export function computeSources(cohort: Lead[]): SourceRow[] {
  const bySource = new Map<LeadSource, Lead[]>();
  for (const lead of cohort) {
    const bucket = bySource.get(lead.source) ?? [];
    bucket.push(lead);
    bySource.set(lead.source, bucket);
  }

  return [...bySource.entries()]
    .map(([source, group]) => {
      const won = group.filter((l) => l.isWon);
      return {
        source,
        leads: group.length,
        delivered: won.length,
        conversionRate: ratio(won.length, group.length),
        revenue: sum(won.map((l) => l.deal_value)),
        avgDealValue: sum(group.map((l) => l.deal_value)) / group.length,
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate);
}

export interface LossRow {
  reason: string;
  count: number;
  value: number;
}

export function computeLossReasons(cohort: Lead[]): LossRow[] {
  const byReason = new Map<string, LossRow>();
  for (const lead of cohort.filter((l) => l.isLost)) {
    const reason = lead.lost_reason ?? 'No reason recorded';
    const row = byReason.get(reason) ?? { reason, count: 0, value: 0 };
    row.count += 1;
    row.value += lead.deal_value;
    byReason.set(reason, row);
  }
  return [...byReason.values()].sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Ageing
// ---------------------------------------------------------------------------

/**
 * Per-stage patience thresholds. A brand-new enquiry going quiet for two days
 * is a problem; an order awaiting delivery is not, until it passes the observed
 * p90 of roughly 29 days. A single flat threshold would bury the genuine
 * emergencies under dozens of false positives, so each stage gets its own.
 */
export const STALE_THRESHOLD_DAYS: Record<PipelineStage, number> = {
  new: 2,
  contacted: 5,
  test_drive: 7,
  negotiation: 10,
  order_placed: 21,
  delivered: Infinity,
};

export function isStale(lead: Lead): boolean {
  if (!lead.isOpen) return false;
  const threshold = STALE_THRESHOLD_DAYS[lead.status as PipelineStage];
  return lead.daysSinceActivity >= threshold;
}

/** How far past its own stage threshold a lead has drifted. */
export function overdueDays(lead: Lead): number {
  const threshold = STALE_THRESHOLD_DAYS[lead.status as PipelineStage];
  return Number.isFinite(threshold) ? lead.daysSinceActivity - threshold : 0;
}

/**
 * Stale leads, ranked by rupees-at-risk weighted by how overdue they are, so
 * the top of the list is genuinely the most valuable thing to chase today.
 */
export function staleLeads(f: Filter): Lead[] {
  return openLeads(f)
    .filter(isStale)
    .sort((a, b) => b.deal_value * overdueDays(b) - a.deal_value * overdueDays(a));
}

export { AS_OF };
