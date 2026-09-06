'use client';

import { useMemo } from 'react';
import { useFilter } from '@/components/FilterProvider';
import { RankedBars } from '@/components/charts';
import {
  Badge,
  Card,
  CardHeader,
  DrillLink,
  EmptyState,
  MiniBar,
  StatCard,
  Table,
  Td,
  Th,
} from '@/components/ui';
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconPipeline,
} from '@/components/icons';
import {
  formatDays,
  formatINR,
  formatNumber,
  formatPct,
} from '@/lib/format';
import { branchForecasts, computeForecast } from '@/lib/forecast';
import { type Filter } from '@/lib/metrics';
import { STAGE_LABELS } from '@/lib/types';

export function Pipeline() {
  const { from, to, withRange } = useFilter();

  const model = useMemo(() => {
    const filter: Filter = { from, to, branchId: null, repId: null };
    return {
      forecast: computeForecast(filter),
      byBranch: branchForecasts(filter),
    };
  }, [from, to]);

  const { forecast } = model;
  const writedownShare =
    forecast.unadjustedRevenue > 0
      ? forecast.ageingWritedown / forecast.unadjustedRevenue
      : 0;

  if (forecast.openCount === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
          Pipeline forecast
        </h1>
        <EmptyState
          title="No open pipeline"
          body="Every lead in the dataset has either been delivered or closed as lost."
        />
      </div>
    );
  }

  const maxBranchValue = Math.max(...model.byBranch.map((b) => b.pipelineValue), 1);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">
          Pipeline forecast
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Not a trend line. Every open lead is weighted by how leads at its stage
          have <em>actually</em> closed in this dataset, then discounted for time
          it has already overrun. That keeps the number explainable — you can
          point at any rupee and see which deals it came from.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={<IconPipeline />}
            chip="blue"
            label="Open pipeline"
            value={formatINR(forecast.pipelineValue)}
            hint={`${formatNumber(forecast.openCount)} leads, face value`}
          />
          <StatCard
            icon={<IconCheck />}
            chip="mint"
            label="Expected to close"
            value={formatINR(forecast.expectedRevenue)}
            hint={`${forecast.expectedUnits.toFixed(1)} units, risk-adjusted`}
            tone="good"
          />
          <StatCard
            icon={<IconAlert />}
            chip="rose"
            label="Ageing write-down"
            value={formatINR(forecast.ageingWritedown)}
            hint={`${formatPct(writedownShare)} of the raw estimate`}
            tone={writedownShare > 0.2 ? 'critical' : 'neutral'}
          />
          <StatCard
            label="Likely within 30 days"
            value={formatINR(forecast.expectedRevenueNext30)}
            hint={`${forecast.expectedUnitsNext30.toFixed(1)} units`}
            icon={<IconCalendar />}
            chip="violet"
          />
      </div>

      {writedownShare > 0.15 && (
        <Card className="border-warning/30 bg-warning-tint">
          <h2 className="text-[15px] font-semibold text-ink">
            Read the write-down before you read the forecast
          </h2>
          <p className="mt-2 max-w-4xl text-[13px] leading-relaxed text-ink-2">
            Taken at face value, the stage-by-stage close rates would put this
            pipeline at {formatINR(forecast.unadjustedRevenue)}. Every settled
            lead that ever reached <strong>Order Placed</strong> in this dataset
            went on to deliver, so that stage carries a raw win rate of 100% — and
            an un-adjusted model would happily book an order that has sat
            untouched for six months. Discounting for overrun time removes{' '}
            <strong className="text-ink">{formatINR(forecast.ageingWritedown)}</strong>{' '}
            of it. The gap between the two numbers is, quite literally, the cost
            of the stalled deliveries sitting in the action queue.
          </p>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="How each stage has actually closed"
              subtitle="Measured on settled leads only — still-open leads are excluded, since they have not had their chance to convert yet."
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Stage reached</Th>
                <Th align="right">Went on to deliver</Th>
                <Th align="right">Median days to close</Th>
                <Th align="right">Sample</Th>
              </tr>
            </thead>
            <tbody>
              {forecast.odds.map((odd) => (
                <tr key={odd.stage}>
                  <Td className="font-medium text-ink">{STAGE_LABELS[odd.stage]}</Td>
                  <Td align="right" numeric>{formatPct(odd.winRate, 1)}</Td>
                  <Td align="right" numeric>
                    {odd.medianDaysToClose > 0
                      ? formatDays(odd.medianDaysToClose)
                      : '—'}
                  </Td>
                  <Td align="right" numeric className="text-ink-3">
                    {formatNumber(odd.sampleSize)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            title="Expected revenue by branch"
            subtitle="Risk-adjusted, so a branch whose pipeline has gone stale falls below its face value."
          />
          <RankedBars
            rows={model.byBranch.map((branch) => ({
              key: branch.branchId,
              label: branch.branchName,
              value: branch.expectedRevenue,
              note: `${formatNumber(branch.openCount)} open`,
            }))}
            valueFormat={(v) => formatINR(v)}
          />

          <div className="mt-5 border-t border-line pt-5">
            <p className="mb-3 text-[12px] font-medium tracking-wide text-ink-3 uppercase">
              Face value vs expected
            </p>
            <ul className="space-y-3">
              {model.byBranch.map((branch) => {
                const retained =
                  branch.pipelineValue > 0
                    ? branch.expectedRevenue / branch.pipelineValue
                    : 0;
                return (
                  <li key={branch.branchId}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
                      <DrillLink href={withRange(`/branches/${branch.branchId}`)}>
                        {branch.branchName}
                      </DrillLink>
                      <span className="nums text-ink-2">
                        {formatINR(branch.expectedRevenue)} of{' '}
                        {formatINR(branch.pipelineValue)}
                        <span
                          className={
                            retained < 0.5 ? 'ml-2 text-critical' : 'ml-2 text-ink-3'
                          }
                        >
                          {formatPct(retained)} held
                        </span>
                      </span>
                    </div>
                    <MiniBar
                      value={branch.pipelineValue}
                      max={maxBranchValue}
                      tone={retained < 0.5 ? 'critical' : 'brand'}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="The deals that make up the forecast"
            subtitle="Ranked by expected value. The discount column shows how much each deal has been marked down for sitting too long."
          />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Stage</Th>
              <Th align="right">Face value</Th>
              <Th align="right">Stage odds</Th>
              <Th align="right">Ageing discount</Th>
              <Th align="right">Expected</Th>
            </tr>
          </thead>
          <tbody>
            {forecast.leads.slice(0, 20).map((entry) => {
              const discounted = entry.stalenessFactor < 0.95;
              return (
                <tr key={entry.lead.id} className="hover:bg-surface-sunken">
                  <Td>
                    <span className="font-medium text-ink">
                      {entry.lead.customer_name}
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      {entry.lead.branchName} · {entry.lead.repName}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={discounted ? 'critical' : 'neutral'}>
                      {STAGE_LABELS[entry.lead.status]}
                    </Badge>
                  </Td>
                  <Td align="right" numeric>{formatINR(entry.lead.deal_value)}</Td>
                  <Td align="right" numeric className="text-ink-3">
                    {formatPct(entry.stageWinRate)}
                  </Td>
                  <Td align="right" numeric>
                    {discounted ? (
                      <span className="text-critical">
                        −{formatPct(1 - entry.stalenessFactor)}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td align="right" numeric className="font-semibold text-ink">
                    {formatINR(entry.expectedValue)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {forecast.leads.length > 20 && (
          <p className="px-5 py-3 text-[12px] text-ink-3 sm:px-6">
            Showing the top 20 of {formatNumber(forecast.leads.length)} open leads.
          </p>
        )}
      </Card>
    </div>
  );
}
