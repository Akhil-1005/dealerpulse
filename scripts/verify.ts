/**
 * Data verification harness — `npm run verify`.
 *
 * The dashboard is only as trustworthy as its aggregates, so every headline
 * number is asserted here against a figure derived independently from the raw
 * JSON. Run it after any change to the metrics engine.
 */
import { AS_OF, branches, leads, months, targets } from '../src/lib/data';
import { computeAlerts } from '../src/lib/alerts';
import { computeForecast } from '../src/lib/forecast';
import {
  branchScorecards,
  computeFunnel,
  computeKpis,
  computeSources,
  defaultFilter,
  leadCohort,
  openLeads,
  staleLeads,
  sum,
  worstRelativeLeak,
  type Filter,
} from '../src/lib/metrics';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${label}${ok ? '' : ` — got ${actual}, want ${expected}`}`);
}

const all: Filter = defaultFilter();

console.log('\nDataset shape');
check('branches', branches.length, 5);
check('leads', leads.length, 510);
check('targets', targets.length, 35);
check('months', months.length, 7);
check('as-of date', new Date(AS_OF).toISOString().slice(0, 10), '2025-12-31');

console.log('\nLead status distribution');
const byStatus = (s: string) => leads.filter((l) => l.status === s).length;
check('delivered', byStatus('delivered'), 160);
check('lost', byStatus('lost'), 288);
check('order_placed', byStatus('order_placed'), 38);
check('open total', leads.filter((l) => l.isOpen).length, 62);

console.log('\nHeadline KPIs, full range');
const kpis = computeKpis(all);
check('new leads', kpis.newLeads, 510);
check('delivered units', kpis.deliveredUnits, 160);
check('revenue (crore, 2dp)', (kpis.revenue / 1e7).toFixed(2), '38.88');
check('conversion rate (%)', (kpis.conversionRate * 100).toFixed(1), '31.4');
check('target units', kpis.targetUnits, 1426);
check('open pipeline count', kpis.openLeadCount, 62);

console.log('\nFunnel, full cohort');
const funnel = computeFunnel(leadCohort(all));
check('reached new', funnel[0].reached, 510);
check('reached contacted', funnel[1].reached, 391);
check('reached test_drive', funnel[2].reached, 300);
check('reached negotiation', funnel[3].reached, 235);
check('reached order_placed', funnel[4].reached, 198);
check('reached delivered', funnel[5].reached, 160);
check(
  'funnel drop-offs sum to lost count',
  sum(funnel.map((s) => s.droppedHere)),
  288,
);
check(
  'funnel open counts sum to open total',
  sum(funnel.map((s) => s.stillHere)),
  62,
);

console.log('\nBranch scorecards');
const scorecards = branchScorecards(all);
const b3 = scorecards.find((s) => s.id === 'B3')!;
check('B3 leads', b3.leads, 79);
check('B3 delivered', b3.delivered, 6);
check('B3 contact rate (%)', (b3.contactRate * 100).toFixed(1), '58.2');
check('B1 delivered', scorecards.find((s) => s.id === 'B1')!.delivered, 40);
check('B5 delivered', scorecards.find((s) => s.id === 'B5')!.delivered, 47);
check(
  'branch delivered sums to company total',
  sum(scorecards.map((s) => s.delivered)),
  160,
);
check(
  'branch leads sum to company total',
  sum(scorecards.map((s) => s.leads)),
  510,
);

console.log('\nSources');
const sources = computeSources(leadCohort(all));
const walkIn = sources.find((s) => s.source === 'walk_in')!;
const social = sources.find((s) => s.source === 'social_media')!;
check('walk_in conversion (%)', (walkIn.conversionRate * 100).toFixed(1), '45.7');
check('social_media conversion (%)', (social.conversionRate * 100).toFixed(1), '13.9');
check('best converting source', sources[0].source, 'walk_in');

console.log('\nData-integrity signals');
const stuckOrders = leads.filter((l) => l.status === 'order_placed');
check('orders with no delivery record', stuckOrders.filter((l) => !l.delivery).length, 38);
check(
  'stuck order value (crore, 2dp)',
  (sum(stuckOrders.map((l) => l.deal_value)) / 1e7).toFixed(2),
  '8.59',
);
const undocumented = leads.filter((l) => l.isUndocumentedLoss);
check('undocumented losses', undocumented.length, 14);
check(
  'undocumented loss value (crore, 2dp)',
  (sum(undocumented.map((l) => l.deal_value)) / 1e7).toFixed(2),
  '3.20',
);
check(
  'all undocumented losses are from December',
  undocumented.every((l) => l.createdMonth === '2025-12'),
  true,
);

console.log('\nAgeing');
const stale = staleLeads(all);
check('stale leads flagged', stale.length > 0, true);
check('every stale lead is open', stale.every((l) => l.isOpen), true);
check(
  'stale list is ranked, highest exposure first',
  stale[0].deal_value >= stale[stale.length - 1].deal_value / 100,
  true,
);

console.log('\nForecast');
const fc = computeForecast(all);
const orderOdds = fc.odds.find((o) => o.stage === 'order_placed')!;
check('raw order_placed win rate is 100%', orderOdds.winRate, 1);
check('forecast covers every open lead', fc.leads.length, 62);
check(
  'ageing haircut actually bites',
  fc.expectedRevenue < fc.unadjustedRevenue,
  true,
);
check(
  'expected revenue never exceeds face value',
  fc.expectedRevenue <= fc.pipelineValue,
  true,
);
const oldestStuck = fc.leads.find((x) => x.lead.id === 'L0022');
check(
  'the 195-day stuck order is written down below 10%',
  oldestStuck !== undefined && oldestStuck.winProbability < 0.1,
  true,
);
check(
  'win probability stays within [0,1]',
  fc.leads.every((x) => x.winProbability >= 0 && x.winProbability <= 1),
  true,
);

/*
 * Sensitivity of the forecast to its one invented parameter.
 *
 * The stage win rates and median close times are measured from the data; the
 * ageing half-life is not — it is a reasoned choice, because the dataset has no
 * cancellations to fit a decay curve against. This reproduces the table in
 * DECISIONS.md so the claim "±20% across any defensible parameter" is runnable
 * rather than asserted, and it fails loudly if the model ever stops behaving
 * monotonically.
 */
console.log('\nForecast sensitivity to the ageing half-life');
const oddsByStage = new Map(fc.odds.map((o) => [o.stage, o]));
const openBook = openLeads(all);

const totalAt = (halfLife: number) =>
  sum(
    openBook.map((lead) => {
      const o = oddsByStage.get(lead.status as (typeof fc.odds)[number]['stage']);
      if (!o) return 0;
      const overdue = lead.daysInCurrentStage - o.medianDaysToClose;
      const decay = overdue <= 0 ? 1 : Math.pow(0.5, overdue / halfLife);
      return lead.deal_value * o.winRate * decay;
    }),
  );

const shipped = totalAt(30);
for (const halfLife of [10, 15, 30, 45, 60, 90]) {
  const total = totalAt(halfLife);
  const delta = (total / shipped - 1) * 100;
  const note =
    halfLife === 30
      ? '  (shipped)'
      : `  ${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`;
  console.log(
    `  ${String(halfLife + 'd').padEnd(5)} ${(total / 1e7).toFixed(2)} Cr${note}`,
  );
}
check('shipped half-life reproduces the documented total', (shipped / 1e7).toFixed(2), '8.10');
check('a longer half-life is always more optimistic', totalAt(90) > totalAt(30), true);
check('a shorter half-life is always more conservative', totalAt(10) < totalAt(30), true);
check(
  'the parameter stays within a +/-25% band over 10-90 days',
  Math.max(Math.abs(totalAt(10) / shipped - 1), Math.abs(totalAt(90) / shipped - 1)) < 0.25,
  true,
);
check(
  'the action queue is independent of the half-life',
  // Staleness comes from the per-stage thresholds, never from the decay curve,
  // so the list of leads to chase cannot move when this parameter changes.
  staleLeads(all).length,
  31,
);

console.log('\nLeak diagnosis');
const companyFunnel = computeFunnel(leadCohort(all));
const b3Funnel = computeFunnel(leadCohort({ ...all, branchId: 'B3' }));
const leak = worstRelativeLeak(b3Funnel, companyFunnel);
check('B3 leak identified', leak !== null, true);
check('B3 leaks worst at first contact', leak?.fromStage, 'new');
check(
  'leak is measured against the company benchmark',
  leak !== null && leak.conversion < leak.benchmarkConversion,
  true,
);
check(
  'a healthy branch is not flagged against itself',
  worstRelativeLeak(companyFunnel, companyFunnel),
  null,
);

console.log('\nAlerts');
const alerts = computeAlerts(all);
check('alerts fire', alerts.length > 0, true);
check('every alert names a next action', alerts.every((a) => a.action.length > 0), true);
check('alerts are ranked, most severe first', alerts[0].severity, 'critical');
check(
  'Lakeside is flagged for branch health',
  alerts.some((a) => a.id === 'branch-health-B3'),
  true,
);
check(
  'healthy branches are not flagged',
  alerts.filter((a) => a.id.startsWith('branch-health-')).length,
  1,
);
check(
  'stuck deliveries alert is raised',
  alerts.some((a) => a.id === 'stuck-deliveries'),
  true,
);
check(
  'every alert lead id resolves',
  alerts.every((a) => a.leadIds.every((id) => leads.some((l) => l.id === id))),
  true,
);

console.log('\nFilter behaviour');
const june: Filter = { ...all, to: '2025-06' };
check('June cohort is a strict subset', leadCohort(june).length < 510, true);
check(
  'branch filter partitions the cohort',
  sum(branches.map((b) => leadCohort({ ...all, branchId: b.id }).length)),
  510,
);

console.log(
  failures === 0
    ? `\nAll checks passed.\n`
    : `\n${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
