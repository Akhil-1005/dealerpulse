/** Prints alert copy and the forecast so the wording can be reviewed as text. */
import { computeAlerts, totalValueAtRisk } from '../src/lib/alerts';
import { branchForecasts, computeForecast } from '../src/lib/forecast';
import { defaultFilter } from '../src/lib/metrics';
import { formatINR, formatPct } from '../src/lib/format';

const f = defaultFilter();

const alerts = computeAlerts(f);
console.log(`\n=== ALERTS (${alerts.length}) — total exposure ${formatINR(totalValueAtRisk(alerts))} ===\n`);
for (const a of alerts) {
  console.log(`[${a.severity.toUpperCase()}] ${a.headline}  ${a.title}`);
  console.log(`   ${a.body}`);
  console.log(`   -> ${a.action}`);
  console.log(`   (${a.leadIds.length} leads, at risk ${formatINR(a.valueAtRisk)})\n`);
}

const fc = computeForecast(f);
console.log('=== FORECAST ===');
console.log(`open: ${fc.openCount} leads, face value ${formatINR(fc.pipelineValue)}`);
console.log(`expected: ${fc.expectedUnits.toFixed(1)} units, ${formatINR(fc.expectedRevenue)}`);
console.log(`unadjusted: ${formatINR(fc.unadjustedRevenue)}, ageing writedown ${formatINR(fc.ageingWritedown)}`);
console.log(`next 30d: ${fc.expectedUnitsNext30.toFixed(1)} units, ${formatINR(fc.expectedRevenueNext30)}`);
console.log('\nstage odds:');
for (const o of fc.odds) {
  console.log(`  ${o.stage.padEnd(13)} win ${formatPct(o.winRate, 1).padStart(6)}  median ${o.medianDaysToClose.toFixed(1)}d to close  n=${o.sampleSize}`);
}
console.log('\nby branch:');
for (const b of branchForecasts(f)) {
  console.log(`  ${b.branchName.padEnd(18)} ${String(b.openCount).padStart(2)} open  face ${formatINR(b.pipelineValue).padStart(10)}  expected ${formatINR(b.expectedRevenue).padStart(10)} (${b.expectedUnits.toFixed(1)} units)`);
}
console.log();
