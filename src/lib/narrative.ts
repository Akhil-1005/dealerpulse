/**
 * The plain-English read of the period.
 *
 * A CEO should not have to assemble the story from six cards. This composes the
 * same computed metrics into a few sentences that say what happened, what is
 * wrong, and what is working — and it is generated from the data, so it stays
 * true when the filters change or the export is refreshed.
 *
 * Everything here is deterministic and derived. Nothing is a fixed string about
 * a specific branch.
 */
import { computeAlerts } from './alerts';
import { computeForecast } from './forecast';
import { formatINR, formatMonth, formatNumber, formatPct } from './format';
import {
  branchScorecards,
  cohortMaturity,
  computeKpis,
  computeTrend,
  monthsInRange,
  previousWindow,
  type Filter,
} from './metrics';

export interface Narrative {
  /** One sentence, the thing to know. */
  headline: string;
  /** Supporting sentences, in priority order. */
  points: string[];
}

export function buildNarrative(f: Filter): Narrative {
  const kpis = computeKpis(f);
  const scorecards = branchScorecards(f).filter((s) => s.leads > 0);
  const alerts = computeAlerts(f);
  const forecast = computeForecast(f);
  const trend = computeTrend(f);
  const span = monthsInRange(f.from, f.to);

  const period =
    span.length === 1
      ? formatMonth(span[0])
      : `${formatMonth(f.from)} to ${formatMonth(f.to)}`;

  if (kpis.newLeads === 0) {
    return {
      headline: `No leads were recorded between ${period}.`,
      points: ['Widen the time range to see activity.'],
    };
  }

  const points: string[] = [];

  // --- headline: volume and conversion, with direction of travel -----------
  const prev = previousWindow(f);
  const prevKpis = prev ? computeKpis(prev) : null;
  const revenueDelta =
    prevKpis && prevKpis.revenue > 0
      ? kpis.revenue / prevKpis.revenue - 1
      : null;

  const direction =
    revenueDelta === null
      ? ''
      : revenueDelta > 0.02
        ? `, up ${formatPct(revenueDelta)} on the previous ${span.length === 1 ? 'month' : 'period'}`
        : revenueDelta < -0.02
          ? `, down ${formatPct(Math.abs(revenueDelta))} on the previous ${span.length === 1 ? 'month' : 'period'}`
          : ', broadly flat on the previous period';

  const headline =
    `${formatNumber(kpis.newLeads)} leads came in between ${period} and ` +
    `${formatNumber(kpis.deliveredUnits)} vehicles were delivered, worth ` +
    `${formatINR(kpis.revenue)}${direction}.`;

  // --- the spread between branches ----------------------------------------
  // Only when the cohort has had time to close. On a window ending at the edge
  // of the export every branch reads near zero, and reporting that as a spread
  // ("0.0% to 5.3%") describes elapsed time while sounding like performance.
  //
  // The immature case says nothing here on purpose. The maturity caveat is a
  // statement about method, not about the business, and this list is the CEO's
  // read of the business; the page carries the explanation once, in the notice
  // directly above these points, rather than twice in two wordings.
  const maturity = cohortMaturity(f);

  if (maturity.isMature && scorecards.length > 1) {
    const ranked = [...scorecards].sort((a, b) => b.conversionRate - a.conversionRate);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (worst.conversionRate > 0 && best.conversionRate / worst.conversionRate >= 1.5) {
      points.push(
        `Performance is uneven: ${best.name} converts ${formatPct(best.conversionRate, 1)} ` +
          `of its leads while ${worst.name} converts ${formatPct(worst.conversionRate, 1)}. ` +
          `That is the same product and the same price list, so the gap is process, not market.`,
      );
    } else {
      points.push(
        `The five branches are converting within a normal band, ` +
          `${formatPct(worst.conversionRate, 1)} to ${formatPct(best.conversionRate, 1)}.`,
      );
    }
  }

  // --- the single biggest actionable item ---------------------------------
  const worstAlert = alerts.find((a) => a.severity === 'critical') ?? alerts[0];
  if (worstAlert) {
    points.push(`${worstAlert.title} — ${worstAlert.headline}. ${worstAlert.action}`);
  }

  // --- what the pipeline implies ------------------------------------------
  if (forecast.openCount > 0) {
    const writedownShare =
      forecast.unadjustedRevenue > 0
        ? forecast.ageingWritedown / forecast.unadjustedRevenue
        : 0;
    points.push(
      `${formatNumber(forecast.openCount)} leads are still open, carrying ` +
        `${formatINR(forecast.pipelineValue)} at face value. Weighted by how leads at ` +
        `each stage have historically closed, and discounted for the ones that have ` +
        `stalled, that is worth about ${formatINR(forecast.expectedRevenue)}` +
        (writedownShare > 0.15
          ? ` — the ageing discount alone removes ${formatPct(writedownShare)} of it.`
          : '.'),
    );
  }

  // --- the target caveat, stated once and plainly -------------------------
  if (kpis.targetUnits > 0 && kpis.unitAttainment < 0.4) {
    const totalLeads = kpis.newLeads;
    points.push(
      `Against target the picture looks alarming — ${formatNumber(kpis.deliveredUnits)} ` +
        `units against a target of ${formatNumber(kpis.targetUnits)}. Treat that with ` +
        `caution: the targets covering this period total ${formatNumber(kpis.targetUnits)} units ` +
        `against only ${formatNumber(totalLeads)} leads received in it, so they are not ` +
        `reachable by any branch and are better read as a relative benchmark than a goal.`,
    );
  }

  // --- a positive worth protecting ----------------------------------------
  const bestMonth = [...trend].sort((a, b) => b.delivered - a.delivered)[0];
  if (bestMonth && trend.length > 1 && bestMonth.delivered > 0) {
    points.push(
      `${formatMonth(bestMonth.month)} was the strongest month at ` +
        `${formatNumber(bestMonth.delivered)} deliveries.`,
    );
  }

  return { headline, points };
}
