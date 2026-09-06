/**
 * A small hand-built icon set.
 *
 * Deliberately not a dependency: a dashboard needs about a dozen glyphs, and
 * shipping an icon package for that costs more bundle than it saves work. All
 * are drawn on a 16px grid with a 1.5 stroke so they sit evenly beside 12–13px
 * text, and all inherit `currentColor` so they theme for free.
 */
import type { SVGProps } from 'react';
import clsx from 'clsx';

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function Icon({ className, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={clsx('size-4 shrink-0', className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="2.4" width="5" height="5.6" rx="1.2" />
    <rect x="9" y="2.4" width="5" height="3.2" rx="1.2" />
    <rect x="2" y="10" width="5" height="3.6" rx="1.2" />
    <rect x="9" y="7.6" width="5" height="6" rx="1.2" />
  </Icon>
);

export const IconBranches = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.4 13.6h11.2" />
    <path d="M3.8 13.6V6.2l4.2-3 4.2 3v7.4" />
    <path d="M6.7 13.6v-3.3h2.6v3.3" />
  </Icon>
);

export const IconQueue = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.6a5.4 5.4 0 1 1 0 10.8A5.4 5.4 0 0 1 8 2.6Z" />
    <path d="M8 5.4V8l1.9 1.2" />
  </Icon>
);

export const IconPipeline = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.2 3.4h11.6" />
    <path d="M4 7.1h8" />
    <path d="M5.8 10.8h4.4" />
    <path d="M7.3 14h1.4" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.2 14.2 13H1.8L8 2.2Z" />
    <path d="M8 6.6v2.8" />
    <path d="M8 11.4h.01" strokeWidth={1.8} />
  </Icon>
);

export const IconWatch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.4" />
    <path d="M8 5.2v3.2" />
    <path d="M8 10.6h.01" strokeWidth={1.8} />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.4" />
    <path d="M8 7.4v3.4" />
    <path d="M8 5.2h.01" strokeWidth={1.8} />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.4 6.4 11.8 13 5.2" />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.2 8h9.2" />
    <path d="M9 4.6 12.4 8 9 11.4" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 3.6 10.6 8l-4.4 4.4" />
  </Icon>
);

export const IconTrendUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.4 11.2 6.2 7.4l2.6 2.6 4.8-4.8" />
    <path d="M10.2 5.2h3.4v3.4" />
  </Icon>
);

export const IconTrendDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.4 5.2 6.2 9l2.6-2.6 4.8 4.8" />
    <path d="M10.2 11.2h3.4V7.8" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.6v7" />
    <path d="M5 6.8 8 9.8l3-3" />
    <path d="M2.8 12.2v.4a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-.4" />
  </Icon>
);

export const IconFunnel = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.4 3.2h11.2L9.4 8v5L6.6 11.6V8L2.4 3.2Z" />
  </Icon>
);

export const IconSource = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.4" />
    <path d="M2.6 8h10.8" />
    <path d="M8 2.6c1.5 1.7 2.3 3.5 2.3 5.4S9.5 11.7 8 13.4C6.5 11.7 5.7 9.9 5.7 8s.8-3.7 2.3-5.4Z" />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.2" y="3.2" width="11.6" height="10.4" rx="1.6" />
    <path d="M2.2 6.4h11.6" />
    <path d="M5.4 1.9v2.4M10.6 1.9v2.4" />
  </Icon>
);

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="5.6" r="2.6" />
    <path d="M3.2 13.4a4.8 4.8 0 0 1 9.6 0" />
  </Icon>
);

export const IconTruck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1.6 4.2h7.2v6.6H1.6z" />
    <path d="M8.8 6.6h2.6l2.9 2.4v1.8H8.8z" />
    <circle cx="4.6" cy="12.2" r="1.3" />
    <circle cx="11.2" cy="12.2" r="1.3" />
  </Icon>
);
