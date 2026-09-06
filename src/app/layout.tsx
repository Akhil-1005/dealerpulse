import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { FilterProvider } from '@/components/FilterProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DealerPulse — Dealership Performance',
  description:
    'Sales performance, pipeline health and the day’s actions across five dealership branches.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

/**
 * Shown while the shell hydrates.
 *
 * The whole dashboard reads its slice from the URL, and `useSearchParams` puts
 * anything above it behind this boundary — so this is what a first-time visitor
 * genuinely sees for a beat. It mirrors the real layout (chrome, headline, stat
 * row, alert grid) rather than showing a spinner, so nothing shifts when the
 * content lands.
 */
function ShellFallback() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <span className="grid size-7 place-items-center rounded-md bg-brand text-[13px] font-bold text-white">
          D
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          DealerPulse
        </span>
      </div>

      <div className="h-[53px] border-b border-line bg-canvas px-4 py-2.5 sm:px-6">
        <div className="h-8 w-[380px] max-w-full animate-pulse rounded-lg bg-mark-muted/70" />
      </div>

      <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-3">
          <div className="h-6 w-[70%] max-w-3xl animate-pulse rounded bg-mark-muted/70" />
          <div className="h-6 w-[45%] max-w-xl animate-pulse rounded bg-mark-muted/70" />
        </div>

        <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-mark-muted/70" />
                <div className="h-6 w-20 animate-pulse rounded bg-mark-muted/70" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-card border border-line bg-surface p-5"
            >
              <div className="h-3 w-28 animate-pulse rounded bg-mark-muted/70" />
              <div className="h-7 w-40 animate-pulse rounded bg-mark-muted/70" />
              <div className="h-3 w-full animate-pulse rounded bg-mark-muted/70" />
              <div className="h-3 w-[85%] animate-pulse rounded bg-mark-muted/70" />
              <div className="h-14 w-full animate-pulse rounded-lg bg-mark-muted/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* useSearchParams needs a Suspense boundary above it in Next 15. */}
        <Suspense fallback={<ShellFallback />}>
          <FilterProvider>
            <AppShell>{children}</AppShell>
          </FilterProvider>
        </Suspense>
      </body>
    </html>
  );
}
