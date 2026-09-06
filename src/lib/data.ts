import raw from '@/data/dealership_data.json';
import {
  PIPELINE_STAGES,
  type Branch,
  type Lead,
  type LeadStatus,
  type PipelineStage,
  type RawDataset,
  type RawDelivery,
  type RawLead,
  type SalesRep,
  type StageTransition,
} from './types';

const dataset = raw as unknown as RawDataset;

const MS_PER_DAY = 86_400_000;

const ts = (iso: string) => new Date(iso).getTime();
const days = (from: number, to: number) => (to - from) / MS_PER_DAY;

/**
 * The dataset is a fixed historical export ending 31 Dec 2025. Anchoring "now"
 * to the wall clock would make every ageing metric read as months stale, so we
 * anchor to the most recent event in the data itself. Derived rather than
 * hard-coded, so the dashboard stays correct if the export is refreshed.
 */
export const AS_OF: number = dataset.leads.reduce((latest, lead) => {
  const last = ts(lead.last_activity_at);
  return last > latest ? last : latest;
}, 0);

const stageIndex = new Map<string, number>(
  PIPELINE_STAGES.map((stage, i) => [stage, i]),
);

// --- lookup tables -------------------------------------------------------

const branchById = new Map(dataset.branches.map((b) => [b.id, b]));
const repById = new Map(dataset.sales_reps.map((r) => [r.id, r]));
const deliveryByLeadId = new Map<string, RawDelivery>(
  dataset.deliveries.map((d) => [d.lead_id, d]),
);

export const branches: Branch[] = dataset.branches.map((branch) => {
  const reps = dataset.sales_reps.filter((r) => r.branch_id === branch.id);
  const manager = reps.find((r) => r.role === 'branch_manager') ?? null;
  return {
    ...branch,
    managerId: manager?.id ?? null,
    managerName: manager?.name ?? null,
    repIds: reps.map((r) => r.id),
  };
});

export const salesReps: SalesRep[] = dataset.sales_reps.map((rep) => ({
  ...rep,
  branchName: branchById.get(rep.branch_id)?.name ?? 'Unknown',
}));

export const targets = dataset.targets;
export const deliveries = dataset.deliveries;
export const metadata = dataset.metadata;

// --- lead enrichment -----------------------------------------------------

/**
 * Replays a lead's `status_history` into the shape every metric needs:
 * when it hit each stage, how long each hop took, and how stale it is now.
 *
 * Two source-data defects are handled here rather than downstream:
 *   1. 14 leads carry `status: "lost"` with no matching history event and no
 *      `lost_reason`. We trust `status` as the current state, flag the lead,
 *      and let the UI report the gap instead of hiding it.
 *   2. 38 leads sit at `order_placed` with no delivery record at all — real
 *      stuck orders, not a broken join. `delivery` is simply null for them.
 */
function enrich(lead: RawLead): Lead {
  const createdAt = ts(lead.created_at);
  const lastActivityAt = ts(lead.last_activity_at);

  const stageEnteredAt: Partial<Record<LeadStatus, number>> = {};
  const transitions: StageTransition[] = [];

  let previous: { status: LeadStatus; at: number } | null = null;
  for (const event of lead.status_history) {
    const at = ts(event.timestamp);
    // First entry wins: a lead that revisits a stage keeps its original date.
    if (stageEnteredAt[event.status] === undefined) {
      stageEnteredAt[event.status] = at;
    }
    if (previous) {
      transitions.push({
        from: previous.status,
        to: event.status,
        at,
        days: days(previous.at, at),
      });
    }
    previous = { status: event.status, at };
  }

  const historyStatuses = lead.status_history.map((e) => e.status);
  const isUndocumentedLoss =
    lead.status === 'lost' && !historyStatuses.includes('lost');

  // Current status is authoritative even when the history failed to record it.
  const reachedStages: LeadStatus[] = [...new Set([...historyStatuses, lead.status])];

  let furthestStageIndex = 0;
  for (const stage of reachedStages) {
    const i = stageIndex.get(stage);
    if (i !== undefined && i > furthestStageIndex) furthestStageIndex = i;
  }

  const isWon = lead.status === 'delivered';
  const isLost = lead.status === 'lost';
  const isOpen = !isWon && !isLost;

  const enteredCurrent = stageEnteredAt[lead.status] ?? lastActivityAt;
  const delivery = deliveryByLeadId.get(lead.id) ?? null;

  return {
    ...lead,
    createdAt,
    lastActivityAt,
    createdMonth: lead.created_at.slice(0, 7),

    stageEnteredAt,
    reachedStages,
    transitions,

    furthestStage: PIPELINE_STAGES[furthestStageIndex] as PipelineStage,
    furthestStageIndex,

    isOpen,
    isWon,
    isLost,

    daysSinceActivity: days(lastActivityAt, AS_OF),
    daysInCurrentStage: days(enteredCurrent, AS_OF),
    ageDays: days(createdAt, isOpen ? AS_OF : lastActivityAt),

    delivery,
    deliveredMonth: delivery ? delivery.delivery_date.slice(0, 7) : null,

    isUndocumentedLoss,

    branchName: branchById.get(lead.branch_id)?.name ?? 'Unknown',
    repName: repById.get(lead.assigned_to)?.name ?? 'Unassigned',
  };
}

/** Every lead, enriched. Computed once at module load. */
export const leads: Lead[] = dataset.leads
  .map(enrich)
  .sort((a, b) => a.createdAt - b.createdAt);

export const leadById = new Map(leads.map((l) => [l.id, l]));
export const getBranch = (id: string) => branches.find((b) => b.id === id);
export const getRep = (id: string) => salesReps.find((r) => r.id === id);

/** Every month present in the data, ascending — drives the range picker. */
export const months: string[] = [...new Set(targets.map((t) => t.month))].sort();
