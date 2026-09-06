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
export type ChipColor = 'blue' | 'violet' | 'mint' | 'gold' | 'rose';

const CHIP_CLASS: Record<ChipColor, string> = {
  blue: 'bg-chip-blue text-chip-blue-ink',
  violet: 'bg-chip-violet text-chip-violet-ink',
  mint: 'bg-chip-mint text-chip-mint-ink',
  gold: 'bg-chip-gold text-chip-gold-ink',
  rose: 'bg-chip-rose text-chip-rose-ink',
};

/**
 * A pastel glyph tile.
 *
 * Purely decorative identity — it makes a row of otherwise identical stat cards
 * scannable. Colour here carries no value, which is exactly why these hues stay
 * out of the charts, where it would have to.
 */
export function IconChip({
  icon,
  color = 'blue',
  size = 'md',
}: {
  icon: ReactNode;
  color?: ChipColor;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 place-items-center rounded-xl',
        size === 'md' ? 'size-9' : 'size-7 rounded-lg',
        CHIP_CLASS[color],
      )}
    >
      {icon}
    </span>
  );
}

export function Stat({
  label,
  value,
  delta,
  hint,
  tone = 'neutral',
  series,
  invertDelta = false,
  icon,
  chip = 'blue',
}: {
  label: string;
  value: string;
  /** Period-over-period change, as a ratio. */
  delta?: number | null;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
  series?: number[];
  invertDelta?: boolean;
  icon?: ReactNode;
  chip?: ChipColor;
}) {
  const toneClass = {
    neutral: 'text-ink',
    good: 'text-good',
    warning: 'text-warning',
    critical: 'text-critical',
  }[tone];

  return (
    <div className="flex h-full flex-col">
      {/* Glyph left, movement right — the two things you read before the
          number itself. The value then gets a full line, so a long figure like
          "₹38.88 Cr" can never wrap. */}
      <div className="mb-3.5 flex items-start justify-between gap-2">
        {icon ? <IconChip icon={icon} color={chip} /> : <span />}
        {delta !== undefined && delta !== null && (
          <DeltaChip value={delta} invert={invertDelta} />
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {/* Proportional figures, not tabular — equal-width digits read loose at
            display sizes. Tight tracking keeps large numbers from sprawling. */}
        <span
          className={clsx(
            'block text-[26px] leading-none font-bold tracking-[-0.028em] whitespace-nowrap',
            toneClass,
          )}
        >
          {value}
        </span>
        <span className="mt-2 block text-[12.5px] font-medium text-ink-2">
          {label}
        </span>
        <span className="mt-1 block min-h-[18px] truncate text-[12px] text-ink-3">
          {hint}
        </span>

        {/* The trend runs full width along the foot of the tile, so it reads as
            a base line under the figure rather than competing with it. */}
        {series && series.length > 1 && (
          <span className="mt-auto block pt-4">
            <Sparkline values={series} stretch width={120} height={22} />
          </span>
        )}
      </div>
    </div>
  );
}

/** A stat in its own card — the row shape used across the dashboard. */
export function StatCard(props: React.ComponentProps<typeof Stat>) {
  return (
    <Card className="p-4 sm:p-5">
      <Stat {...props} />
    </Card>
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
  stretch = false,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
  /**
   * Fill the available width. The viewBox is then scaled non-uniformly, so the
   * stroke is pinned with `non-scaling-stroke` and the end dot is dropped —
   * a circle under a non-uniform scale would render as an ellipse.
   */
  stretch?: boolean;
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
      width={stretch ? undefined : width}
      height={height}
      fill="none"
      aria-hidden
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
      className={clsx(stretch ? 'w-full' : 'shrink-0 overflow-visible', className)}
    >
      <path
        d={d}
        stroke={rising ? 'var(--color-brand)' : 'var(--color-ink-3)'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect={stretch ? 'non-scaling-stroke' : undefined}
      />
      {!stretch && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2}
          fill={rising ? 'var(--color-brand)' : 'var(--color-ink-3)'}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      )}
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
// Avatar
// ---------------------------------------------------------------------------

const AVATAR_CLASS = [
  'bg-chip-blue-ink',
  'bg-chip-gold-ink',
  'bg-chip-mint-ink',
  'bg-chip-violet-ink',
  'bg-chip-rose-ink',
];

/**
 * Initials on a coloured disc.
 *
 * The hue is derived from the id, not from the row position, so a rep keeps the
 * same colour wherever they appear and re-sorting a table never repaints
 * anyone. Decorative identity only — it encodes nothing about performance.
 */
export function Avatar({
  name,
  id,
  size = 'md',
}: {
  name: string;
  id: string;
  size?: 'sm' | 'md';
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;

  return (
    <span
      aria-hidden
      className={clsx(
        'grid shrink-0 place-items-center rounded-full font-semibold text-white',
        size === 'md' ? 'size-8 text-[11px]' : 'size-7 text-[10px]',
        AVATAR_CLASS[hash % AVATAR_CLASS.length],
      )}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

/**
 * The accent gold is a *fill* colour and nothing else — at 2.3:1 on white it
 * cannot legally set type, so the primary button pairs it with near-black ink
 * (8.05:1) rather than the white text these palettes usually invite.
 */
export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  icon,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary'
          ? 'bg-accent text-ink shadow-raised hover:bg-accent-hover'
          : 'border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Highlight banner
// ---------------------------------------------------------------------------

/** A single notable fact, called out on the accent tint. */
export function Banner({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-accent-line bg-accent-tint px-4 py-2.5">
      {icon && <span className="text-accent-ink">{icon}</span>}
      <p className="text-[12.5px] font-medium text-accent-ink">{children}</p>
    </div>
  );
}

/**
 * An explanatory caveat — why a number on this page should not be read the
 * usual way.
 *
 * Deliberately neither gold nor orange. Gold is reserved for interactive fills
 * and orange for "watch" severity, and this is neither: it is not something to
 * act on and not something clickable, so borrowing either hue would weaken a
 * signal that has to stay sharp elsewhere. A recessed slab with a strong left
 * rule reads as an aside at a glance.
 */
export function Notice({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line border-l-[3px] border-l-line-strong bg-surface-sunken px-4 py-3">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
        {icon && (
          <span aria-hidden className="text-ink-3">
            {icon}
          </span>
        )}
        {title}
      </p>
      <p className="mt-1 max-w-4xl text-[12.5px] leading-[1.6] text-ink-2">
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; badge?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            value === option.value
              ? 'bg-ink text-surface'
              : 'text-ink-3 hover:bg-surface-sunken hover:text-ink',
          )}
        >
          {option.label}
          {option.badge}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------


export function DrillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded font-semibold text-ink decoration-line-strong underline-offset-[3px] hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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
