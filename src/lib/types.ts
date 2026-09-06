/**
 * Domain types for DealerPulse.
 *
 * `Raw*` types mirror dealership_data.json exactly. Everything else is derived
 * in src/lib/data.ts, so the rest of the app never touches the raw shape.
 */

export const PIPELINE_STAGES = [
  'new',
  'contacted',
  'test_drive',
  'negotiation',
  'order_placed',
  'delivered',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type LeadStatus = PipelineStage | 'lost';

export const STAGE_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test Drive',
  negotiation: 'Negotiation',
  order_placed: 'Order Placed',
  delivered: 'Delivered',
  lost: 'Lost',
};

export type LeadSource =
  | 'website'
  | 'walk_in'
  | 'referral'
  | 'social_media'
  | 'phone_enquiry'
  | 'auto_expo';

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  walk_in: 'Walk-in',
  referral: 'Referral',
  social_media: 'Social Media',
  phone_enquiry: 'Phone Enquiry',
  auto_expo: 'Auto Expo',
};

// ---------------------------------------------------------------------------
// Raw dataset shapes
// ---------------------------------------------------------------------------

export interface RawStatusEvent {
  status: LeadStatus;
  timestamp: string;
  note: string;
}

export interface RawLead {
  id: string;
  customer_name: string;
  phone: string;
  source: LeadSource;
  model_interested: string;
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: RawStatusEvent[];
  expected_close_date: string;
  deal_value: number;
  lost_reason: string | null;
}

export interface RawBranch {
  id: string;
  name: string;
  city: string;
}

export interface RawSalesRep {
  id: string;
  name: string;
  branch_id: string;
  role: 'branch_manager' | 'sales_officer';
  joined: string;
}

export interface RawTarget {
  branch_id: string;
  month: string; // "2025-06"
  target_units: number;
  target_revenue: number;
}

export interface RawDelivery {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
}

export interface RawDataset {
  metadata: {
    generated_at: string;
    description: string;
    date_range: string;
    notes: string;
  };
  branches: RawBranch[];
  sales_reps: RawSalesRep[];
  leads: RawLead[];
  targets: RawTarget[];
  deliveries: RawDelivery[];
}

// ---------------------------------------------------------------------------
// Derived shapes
// ---------------------------------------------------------------------------

/** A single observed stage-to-stage transition, with its duration. */
export interface StageTransition {
  from: LeadStatus;
  to: LeadStatus;
  at: number; // epoch ms of the `to` event
  days: number;
}

/**
 * A lead with its journey pre-computed. Replaying `status_history` is the
 * single most expensive thing we do, so it happens exactly once at module load
 * and every metric downstream reads these fields instead.
 */
export interface Lead extends RawLead {
  createdAt: number;
  lastActivityAt: number;
  createdMonth: string;

  /** First time the lead entered each stage it ever reached. */
  stageEnteredAt: Partial<Record<LeadStatus, number>>;
  reachedStages: LeadStatus[];
  transitions: StageTransition[];

  /** Furthest point down the funnel, ignoring the terminal `lost` state. */
  furthestStage: PipelineStage;
  furthestStageIndex: number;

  isOpen: boolean;
  isWon: boolean;
  isLost: boolean;

  daysSinceActivity: number;
  daysInCurrentStage: number;
  ageDays: number;

  /** Delivery record, joined by lead id. Only ever set on won leads. */
  delivery: RawDelivery | null;
  deliveredMonth: string | null;

  /**
   * True when `status` is "lost" but the history never records the transition
   * and no reason was captured — a real data-integrity defect in the source
   * system, surfaced rather than silently patched. See DECISIONS.md.
   */
  isUndocumentedLoss: boolean;

  branchName: string;
  repName: string;
}

export interface Branch extends RawBranch {
  managerId: string | null;
  managerName: string | null;
  repIds: string[];
}

export interface SalesRep extends RawSalesRep {
  branchName: string;
}
