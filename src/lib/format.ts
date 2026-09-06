/**
 * Presentation helpers. Money is formatted in the Indian lakh/crore convention
 * throughout — a Chennai dealership CEO reads "₹8.59 Cr", not "₹85,860,000".
 */

export function formatINR(value: number, opts: { compact?: boolean } = {}): string {
  const { compact = true } = opts;
  const abs = Math.abs(value);

  if (!compact) {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
  return `₹${Math.round(value)}`;
}

/** Axis-friendly variant: no decimals, no symbol clutter. */
export function formatINRAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(0)}L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return `${value}`;
}

export const formatPct = (value: number, digits = 0) =>
  `${(value * 100).toFixed(digits)}%`;

export const formatNumber = (value: number) =>
  Math.round(value).toLocaleString('en-IN');

export function formatDays(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 1) return '1 day';
  return `${rounded} days`;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2025-06" -> "Jun 2025" */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${year}`;
}

/** "2025-06" -> "Jun" — for dense chart axes. */
export function formatMonthShort(month: string): string {
  return MONTH_NAMES[Number(month.split('-')[1]) - 1];
}

export function formatDate(input: string | number): string {
  const d = new Date(input);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Signed delta for trend chips: "+12%", "−4%", "flat". */
export function formatDelta(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return 'flat';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${(Math.abs(value) * 100).toFixed(digits)}%`;
}
