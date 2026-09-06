'use client';

import Link from 'next/link';
import clsx from 'clsx';
import type { Alert, Severity } from '@/lib/alerts';
import { Badge, EmptyState, StatusDot } from './ui';
import { IconAlert, IconArrowRight, IconInfo, IconWatch } from './icons';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Needs action now',
  warning: 'Watch',
  info: 'For information',
};

const SEVERITY_TONE: Record<Severity, 'critical' | 'warning' | 'neutral'> = {
  critical: 'critical',
  warning: 'warning',
  info: 'neutral',
};

/** Icon plus label, so severity is never carried by colour alone. */
const SEVERITY_ICON: Record<Severity, typeof IconAlert> = {
  critical: IconAlert,
  warning: IconWatch,
  info: IconInfo,
};

export function AlertCard({ alert, href }: { alert: Alert; href?: string }) {
  const SeverityIcon = SEVERITY_ICON[alert.severity];

  return (
    <article
      className={clsx(
        'group relative flex flex-col overflow-hidden rounded-card border bg-surface shadow-card transition-shadow duration-200 hover:shadow-card-hover',
        alert.severity === 'critical' ? 'border-critical/20' : 'border-line',
      )}
    >
      {/* A hairline accent along the top edge reads the severity before any
          text does, without tinting the whole card. */}
      <span
        aria-hidden
        className={clsx(
          'absolute inset-x-0 top-0 h-0.5',
          alert.severity === 'critical' && 'bg-critical',
          alert.severity === 'warning' && 'bg-warning-mark',
          alert.severity === 'info' && 'bg-line-strong',
        )}
      />

      <div className="flex flex-1 flex-col p-5 pt-[22px] sm:p-6 sm:pt-[26px]">
        <div className="mb-3.5 flex items-center gap-1.5">
          <SeverityIcon
            className={clsx(
              'size-3.5',
              alert.severity === 'critical' && 'text-critical',
              alert.severity === 'warning' && 'text-warning',
              alert.severity === 'info' && 'text-ink-3',
            )}
          />
          <span
            className={clsx(
              'text-[10.5px] font-semibold tracking-[0.075em] uppercase',
              alert.severity === 'critical' && 'text-critical',
              alert.severity === 'warning' && 'text-warning',
              alert.severity === 'info' && 'text-ink-3',
            )}
          >
            {SEVERITY_LABEL[alert.severity]}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={clsx(
              'text-[30px] leading-none font-semibold tracking-[-0.025em]',
              alert.severity === 'critical' ? 'text-critical' : 'text-ink',
            )}
          >
            {alert.headline}
          </span>
          <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.011em] text-ink">
            {alert.title}
          </h3>
        </div>

        <p className="mt-3 text-[13px] leading-[1.65] text-ink-2">{alert.body}</p>

        <div className="mt-auto pt-4">
          <div className="rounded-xl bg-surface-sunken px-4 py-3.5">
            <p className="text-[10.5px] font-semibold tracking-[0.075em] text-ink-3 uppercase">
              What to do
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-ink">{alert.action}</p>
          </div>

          {href && (
            <Link
              href={href}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-strong transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {alert.leadIds.length > 0
                ? `See the ${alert.leadIds.length} leads`
                : 'Investigate'}
              <IconArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function AlertList({
  alerts,
  hrefFor,
  emptyTitle = 'Nothing needs your attention',
  emptyBody = 'No stalled orders, cold leads or branch-level problems in this period. Widen the time range to look further back.',
}: {
  alerts: Alert[];
  hrefFor?: (alert: Alert) => string | undefined;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (!alerts.length) {
    return <EmptyState tone="good" title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} href={hrefFor?.(alert)} />
      ))}
    </div>
  );
}

/** Compact one-line variant, used on branch pages where space is tighter. */
export function AlertStrip({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return (
      <EmptyState
        tone="good"
        title="No open issues at this branch"
        body="Every lead here is inside its follow-up window."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised"
        >
          <StatusDot
            tone={alert.severity === 'info' ? 'warning' : alert.severity}
          />
          <span className="text-[13px] font-medium text-ink">{alert.title}</span>
          <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.headline}</Badge>
        </li>
      ))}
    </ul>
  );
}
