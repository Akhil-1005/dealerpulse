# DealerPulse

A performance dashboard for a five-branch dealership group — built for a CEO who
wants to know what is wrong in ten seconds, and for branch managers who want a
list of what to chase this morning.

Seven months of data (June–December 2025): 510 leads with full status histories,
30 reps, monthly targets and 160 delivery records.

**The reasoning behind every product and technical choice — including three real
defects found in the dataset — is in [`DECISIONS.md`](./DECISIONS.md).**

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build; all 43 routes prerender
npm run start
npm run verify       # 60 assertions against the raw JSON
npm run lint
```

Node 20+.

---

## What is where

```
src/
  data/dealership_data.json   the supplied dataset, untouched
  lib/
    types.ts        domain types; Raw* mirror the JSON exactly
    data.ts         replays every status_history once, at module load
    metrics.ts      filtering, KPIs, funnel, scorecards, ageing
    forecast.ts     stage win rates + the ageing haircut
    alerts.ts       the rules that turn metrics into "do this"
    narrative.ts    the plain-English read of the period
    format.ts       lakh/crore money, dates, deltas
  components/
    FilterProvider.tsx   time range + branch scope, synced to the URL
    AppShell.tsx         chrome and the single filter row
    charts.tsx           Recharts wrappers, each with a table-view twin
    ui.tsx               cards, stats, tables, badges, empty states
    views/               one file per screen
scripts/
  verify.ts        the data verification harness
  shots.mjs        screenshots every route at desktop and tablet
```

The important idea: `data.ts` replays each lead's `status_history` exactly once
into stage-entry timestamps, transition durations and staleness. Everything
downstream reads those derived fields, so no metric re-walks the histories.

---

## How it works

**One filter row scopes every card on the page.** Time range and branch live in
the URL, so any view can be shared as a link and lands the recipient on exactly
what you were looking at.

**Two time lenses.** Conversion and funnel metrics filter by lead *creation*
month, so branches are compared on equal-maturity cohorts. Revenue and units
filter by *delivery* month, because a sale belongs to the month it landed.
Ageing ignores the time filter entirely — a lead going cold is a fact about now.

**"Now" comes from the data.** `AS_OF` is the latest event in the export
(31 Dec 2025), not the wall clock, so ageing stays correct.

**Staleness thresholds vary by stage** — 2 days for a new enquiry, 21 for an
order awaiting delivery — which keeps the action queue short enough to work
through.

---

## Screens

| Route | |
|---|---|
| `/` | Narrative summary, vital signs, ranked alerts, branch comparison, trend, funnel, sources |
| `/branches` | All five side by side; toggles to all 30 reps |
| `/branches/[id]` | Funnel against the company average, leak diagnosis, reps, loss reasons |
| `/reps/[id]` | An individual against their branch, plus their live book |
| `/actions` | Every overdue lead, ranked by rupees at risk, expandable to its full journey, exportable as CSV |
| `/pipeline` | Risk-adjusted forecast and the deals behind it |

---

## Notes

- No authentication, per the brief — the viewer is assumed to be the CEO.
- Data is processed in the browser; at 510 leads this makes filtering instant.
  The tradeoff is discussed in `DECISIONS.md`.
- Light and dark themes, with a System option that follows the OS. Dark is a
  selected set of steps validated against the dark surface, not an inverted
  light palette; the choice persists and is applied before first paint, so
  there is no white flash.
- Charts follow a validated palette, avoid dual axes entirely, and each has a
  table view so no value is reachable only by hovering.
