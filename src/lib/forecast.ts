/**
 * Pipeline forecasting.
 *
 * Rather than extrapolating a trend line, we weight the *actual* open pipeline
 * by the historically observed probability that a lead at a given stage goes on
 * to deliver. That keeps the forecast explainable — a manager can point at any
 * number and see which deals it came from — and it degrades gracefully when a
 * branch has thin history, because it falls back to the company-wide rate.
 */
import { branches, leads } from './data';
import {
  PIPELINE_STAGES,
  type Lead,
  type PipelineStage,
} from './types';
import {
  median,
  openLeads,
  sum,
  type Filter,
} from './metrics';

/** Stages a lead can actually be sitting in while still open. */
export const OPEN_STAGES = PIPELINE_STAGES.filter(
  (s) => s !== 'delivered',
) as Exclude<PipelineStage, 'delivered'>[];

export interface StageOdds {
  stage: PipelineStage;
  /** Historical share of leads reaching this stage that ultimately delivered. */
  winRate: number;
  /** Median days from entering this stage to delivery, among those that won. */
  medianDaysToClose: number;
  /** How many closed leads this estimate is based on. */
  sampleSize: number;
}

const stageIdx = (s: PipelineStage) => PIPELINE_STAGES.indexOf(s);

/**
 * Win rate per stage, computed only from *settled* leads (delivered or lost).
 * Including still-open leads would drag every rate down, since an open lead has
 * simply not had the chance to convert yet.
 */
export function computeStageOdds(pool: Lead[] = leads): StageOdds[] {
  const settled = pool.filter((l) => !l.isOpen);

  return OPEN_STAGES.map((stage) => {
    const reached = settled.filter((l) => l.furthestStageIndex >= stageIdx(stage));
    const won = reached.filter((l) => l.isWon);

    const durations = won
      .map((l) => {
        const entered = l.stageEnteredAt[stage];
        const delivered = l.stageEnteredAt.delivered;
        return entered && delivered ? (delivered - entered) / 86_400_000 : null;
      })
      .filter((d): d is number => d !== null);

    return {
      stage,
      winRate: reached.length ? won.length / reached.length : 0,
      medianDaysToClose: median(durations),
      sampleSize: reached.length,
    };
  });
}

export interface ForecastedLead {
  lead: Lead;
  /** Base rate for the stage, before any ageing adjustment. */
  stageWinRate: number;
  /** Multiplier applied for time already overspent in the stage. */
  stalenessFactor: number;
  winProbability: number;
  expectedValue: number;
  expectedCloseDays: number;
}

/** Half-life, in days overdue, of a stalled lead's chance of closing. */
const DECAY_HALF_LIFE_DAYS = 30;

/**
 * Discounts a lead that has overrun the time its stage normally takes to close.
 *
 * Without this the model is dangerously optimistic: every settled lead that
 * ever reached `order_placed` in this dataset went on to deliver, so the raw
 * stage win rate is 100% — which would have the forecast confidently booking an
 * order that has sat untouched for 195 days. Overdue time is real evidence, and
 * a forecast that ignores it contradicts the very alerts sitting beside it.
 */
function stalenessFactor(daysInStage: number, medianDaysToClose: number): number {
  const overdue = daysInStage - medianDaysToClose;
  if (overdue <= 0) return 1;
  return Math.pow(0.5, overdue / DECAY_HALF_LIFE_DAYS);
}

export interface Forecast {
  /** Every open lead, weighted. */
  leads: ForecastedLead[];
  openCount: number;
  /** Unweighted face value of the pipeline. */
  pipelineValue: number;
  /** Probability-weighted value — what we actually expect to bank. */
  expectedRevenue: number;
  expectedUnits: number;
  /** What the stage rates alone would have predicted, before the ageing haircut. */
  unadjustedRevenue: number;
  /** Value written down purely because deals have overrun their stage. */
  ageingWritedown: number;
  /** Expected revenue from deals whose median close date is inside 30 days. */
  expectedRevenueNext30: number;
  expectedUnitsNext30: number;
  odds: StageOdds[];
}

export function computeForecast(f: Filter, pool: Lead[] = leads): Forecast {
  const odds = computeStageOdds(pool);
  const oddsByStage = new Map(odds.map((o) => [o.stage, o]));
  const open = openLeads(f);

  const forecasted: ForecastedLead[] = open.map((lead) => {
    const stage = lead.status as PipelineStage;
    const o = oddsByStage.get(stage);
    const stageWinRate = o?.winRate ?? 0;
    const medianDaysToClose = o?.medianDaysToClose ?? 30;

    const decay = stalenessFactor(lead.daysInCurrentStage, medianDaysToClose);
    const winProbability = stageWinRate * decay;

    // Time already spent in the stage counts against the median, floored at a
    // week so nothing is reported as closing yesterday.
    const remaining = Math.max(7, medianDaysToClose - lead.daysInCurrentStage);

    return {
      lead,
      stageWinRate,
      stalenessFactor: decay,
      winProbability,
      expectedValue: lead.deal_value * winProbability,
      expectedCloseDays: remaining,
    };
  });

  const next30 = forecasted.filter((x) => x.expectedCloseDays <= 30);
  const expectedRevenue = sum(forecasted.map((x) => x.expectedValue));
  const unadjustedRevenue = sum(
    forecasted.map((x) => x.lead.deal_value * x.stageWinRate),
  );

  return {
    leads: forecasted.sort((a, b) => b.expectedValue - a.expectedValue),
    openCount: open.length,
    pipelineValue: sum(open.map((l) => l.deal_value)),
    expectedRevenue,
    expectedUnits: sum(forecasted.map((x) => x.winProbability)),
    unadjustedRevenue,
    ageingWritedown: unadjustedRevenue - expectedRevenue,
    expectedRevenueNext30: sum(next30.map((x) => x.expectedValue)),
    expectedUnitsNext30: sum(next30.map((x) => x.winProbability)),
    odds,
  };
}

export interface BranchForecast {
  branchId: string;
  branchName: string;
  city: string;
  openCount: number;
  pipelineValue: number;
  expectedRevenue: number;
  expectedUnits: number;
}

export function branchForecasts(f: Filter): BranchForecast[] {
  return branches
    .map((branch) => {
      const fc = computeForecast({ ...f, branchId: branch.id, repId: null });
      return {
        branchId: branch.id,
        branchName: branch.name,
        city: branch.city,
        openCount: fc.openCount,
        pipelineValue: fc.pipelineValue,
        expectedRevenue: fc.expectedRevenue,
        expectedUnits: fc.expectedUnits,
      };
    })
    .sort((a, b) => b.expectedRevenue - a.expectedRevenue);
}
