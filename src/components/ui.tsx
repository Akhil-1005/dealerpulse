import Link from 'next/link';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { formatDelta } from '@/lib/format';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  padded = true,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Adds a lift on hover. Only for cards that are themselves a link target. */
  interactive?: boolean;
}) {
  return (
    <section
      className={clsx(
        // Depth comes from a stacked shadow, with the border reduced to a
        // near-invisible hairline that only defines the edge.
        'rounded-card border border-line bg-surface shadow-card',
        padded && 'p-5 sm:p-6',
        interactive &&
          'transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-card-hover',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        {icon && (
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-3">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] leading-tight font-semibold tracking-[-0.011em] text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

/**
 * A single vital sign.
 *
 * The optional `series` draws a sparkline behind the value — a stat tile that
 * shows only "today" hides whether today is a recovery or the start of a
 * slide, and the trend data is already computed for the charts below.
 */
export function Stat({
  label,
  value,
  delta,
  hint,
  tone = 'neutral',
  series,
  invertDelta = false,
}: {
  label: string;
  value: string;
  /** Period-over-period change, as a ratio. */
  delta?: number | null;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
  series?: number[];
  invertDelta?: boolean;
}) {
  const toneClass = {
    neutral: 'text-ink',
    good: 'text-good',
    warning: 'text-warning',
    critical: 'text-critical',
  }[tone];

  return (
    <div className="flex flex-col gap-1.5">
      {/* The sparkline rides beside the label, never beside the value — sharing
          a row with the figure squeezes it into a wrap at narrow columns. */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium tracking-[0.055em] text-ink-3 uppercase">
          {label}
        </span>
        {series && series.length > 1 && <Sparkline values={series} />}
      </div>

      {/* Proportional figures, not tabular — equal-width digits read loose at
          display sizes. Negative tracking keeps large numbers from sprawling. */}
      <span
        className={clsx(
          'text-[27px] leading-none font-semibold tracking-[-0.022em] whitespace-nowrap',
          toneClass,
        )}
      >
        {value}
      </span>

      <span className="flex min-h-[18px] items-center gap-2 text-[12px] text-ink-3">
        {delta !== undefined && delta !== null && (
          <DeltaChip value={delta} invert={invertDelta} />
        )}
        {hint && <span className="truncate">{hint}</span>}
      </span>
    </div>
  );
}

/**
 * A bare trend line — no axes, no labels, no tooltip. It answers "which way is
 * this going" and nothing else; the precise numbers live in the charts below.
 */
export function Sparkline({
  values,
  className,
  width = 46,
  height = 14,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => {
    const x = i * step;
    // Inset by 1px top and bottom so the stroke is never clipped.
    const y = height - 1 - ((v - min) / span) * (height - 2);
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden
      className={clsx('shrink-0 overflow-visible', className)}
    >
      <path
        d={d}
        stroke={rising ? 'var(--color-brand)' : 'var(--color-ink-3)'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2}
        fill={rising ? 'var(--color-brand)' : 'var(--color-ink-3)'}
        stroke="var(--color-surface)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function DeltaChip({
  value,
  invert = false,
}: {
  value: number;
  /** Set when a rise is bad (e.g. cycle time, losses). */
  invert?: boolean;
}) {
  const flat = Math.abs(value) < 0.005;
  const positive = invert ? value < 0 : value > 0;
  return (
    <span
      className={clsx(
        'nums inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium',
        flat && 'bg-surface-sunken text-ink-3',
        !flat && positive && 'bg-good-tint text-good',
        !flat && !positive && 'bg-critical-tint text-critical',
      )}
    >
      {formatDelta(value)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'brand';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-sunken text-ink-2',
        tone === 'good' && 'bg-good-tint text-good',
        tone === 'warning' && 'bg-warning-tint text-warning',
        tone === 'critical' && 'bg-critical-tint text-critical',
        tone === 'brand' && 'bg-brand-tint text-brand-strong',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status marks always ship with a label, never colour alone — three of the
 * status hues sit below 3:1 on a light surface.
 */
export function StatusDot({ tone }: { tone: 'good' | 'warning' | 'critical' }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-block size-2 shrink-0 rounded-full',
        tone === 'good' && 'bg-good',
        tone === 'warning' && 'bg-warning-mark',
        tone === 'critical' && 'bg-critical',
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  body,
  tone = 'neutral',
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'good';
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center',
        tone === 'good' ? 'border-good/30 bg-good-tint' : 'border-line bg-surface-sunken',
      )}
    >
      <p className={clsx('text-[14px] font-semibold', tone === 'good' ? 'text-good' : 'text-ink')}>
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx('animate-pulse rounded-md bg-mark-muted/70', className)}
      aria-hidden
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  // Wide tables scroll inside their own container, so the page itself never
  // scrolls horizontally on tablet. Cells carry their own edge gutter, so this
  // is always placed inside a Card with padded={false}.
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={clsx(
        'border-b border-line px-3 py-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
  numeric = false,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td
      className={clsx(
        'border-b border-line px-3 py-2.5 text-ink-2 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6',
        align === 'right' ? 'text-right' : 'text-left',
        numeric && 'nums',
        className,
      )}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function DrillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded font-medium text-ink hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

/** A thin proportion bar used inside table rows. */
export function MiniBar({
  value,
  max,
  tone = 'brand',
}: {
  value: number;
  max: number;
  tone?: 'brand' | 'critical';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-mark-muted">
      <div
        className={clsx('h-full rounded-full', tone === 'brand' ? 'bg-brand' : 'bg-critical')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  icon,
}: {
  children: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="flex shrink-0 items-center gap-2 text-[11px] font-semibold tracking-[0.075em] text-ink-3 uppercase">
        {icon}
        {children}
      </h2>
      {/* A rule filling the gap turns a floating label into a section marker. */}
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
      {hint && (
        <span className="shrink-0 text-[12px] whitespace-nowrap text-ink-3">{hint}</span>
      )}
    </div>
  );
}
