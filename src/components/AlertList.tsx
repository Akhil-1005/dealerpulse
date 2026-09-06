'use client';

import Link from 'next/link';
import clsx from 'clsx';
import type { Alert, Severity } from '@/lib/alerts';
import { Badge, EmptyState, StatusDot } from './ui';

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

export function AlertCard({ alert, href }: { alert: Alert; href?: string }) {
  const tone = SEVERITY_TONE[alert.severity];

  return (
    <article
      className={clsx(
        'rounded-card border bg-surface p-5',
        alert.severity === 'critical' ? 'border-critical/25' : 'border-line',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {tone !== 'neutral' && <StatusDot tone={tone} />}
        <span
          className={clsx(
            'text-[11px] font-semibold tracking-wide uppercase',
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
            'text-[28px] leading-none font-semibold tracking-tight',
            alert.severity === 'critical' ? 'text-critical' : 'text-ink',
          )}
        >
          {alert.headline}
        </span>
        <h3 className="text-[15px] font-semibold text-ink">{alert.title}</h3>
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{alert.body}</p>

      <div className="mt-4 rounded-lg bg-surface-sunken px-3.5 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          What to do
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink">{alert.action}</p>
      </div>

      {href && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {alert.leadIds.length > 0
            ? `See the ${alert.leadIds.length} leads`
            : 'Investigate'}
          <span aria-hidden>→</span>
        </Link>
      )}
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
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5"
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
