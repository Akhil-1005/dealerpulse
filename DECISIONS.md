# DECISIONS

DealerPulse — what I built, what I traded away, and what the data turned out to
be hiding.

---

## 1. What I built, and why

The brief has two readers with different jobs. A CEO wants to know, in about ten
seconds, whether the group is fine and where the fire is. A branch manager wants
their own numbers and a list of things to do this morning. Everything below
follows from serving both without building two products.

**Five screens, one filter.**

| Screen | The question it answers |
|---|---|
| **Overview** | Are we healthy, and what is the single biggest problem? |
| **Branches** | How do the five compare, on the same period, side by side? |
| **Branch detail** | Where exactly is this branch leaking, and who works here? |
| **Rep detail** | How is this individual doing against their branch? |
| **Action queue** | What do I chase today, in what order? |
| **Pipeline** | What is the open book actually worth? |

Company → branch → rep is navigation, not a dropdown. Every drill-through
carries the active time range in the URL, so any view can be pasted into
WhatsApp and lands the recipient on exactly what you were looking at.

**The overview opens with sentences, not tiles.** The top of the page is a
generated plain-English read of the period — volume, the spread between
branches, the biggest actionable item, what the pipeline implies, and the target
caveat. It is computed from the same metrics as everything below it
(`src/lib/narrative.ts`), so it cannot drift out of sync and it stays true when
the filters change. The 20% "can a non-technical CEO understand this" criterion
is not really a charting problem; it is a writing problem.

**Alerts are the product, not a widget.** Rules live in `src/lib/alerts.ts` and
every one must answer three questions: what is wrong, what is it worth in
rupees, and what do I do about it. A rule that cannot name a number and a next
action does not ship. There are deliberately only five, and each branch
contributes at most one health alert — whichever leak is genuinely its primary
problem — because an alert list nobody trusts is worse than no alert list.

### Beyond the minimum

I picked three, and finished them, rather than half-building six.

1. **Stalled-order and lead-ageing alerts** — the action queue, ranked by rupees
   at risk weighted by how overdue each lead is.
2. **Branch funnel comparison** — each branch's funnel with the company average
   marked on every bar, and a leak diagnosis that names the specific step.
3. **Pipeline forecasting** — open leads weighted by observed stage close rates,
   discounted for time overrun.

Rep drill-down ships too, but as part of the required company → branch → rep
chain rather than as a fourth feature.

---

## 2. Key decisions and tradeoffs

### The targets are unusable, and I said so rather than hiding it

The 35 target rows total **1,426 units against 510 leads ever received**. No
branch can reach them; attainment lands between 2% and 17% everywhere, every
month. Three options:

- Rescale them so the gauges look sensible — quietly editing a client's data to
  flatter my own chart. No.
- Drop them — throws away a dataset the brief deliberately supplied.
- **Show them honestly, and lead with something that actually discriminates.**

I took the third. Attainment is stated in words on the overview with the caveat
attached, the raw target figures sit in every trend table, and the *headline*
metrics are pipeline health and branch-versus-branch comparison — which do
discriminate. Five red dials that are all red tell a CEO nothing.

The one place this bit was the trend chart. Plotting the target series on the
same axis as actuals squashes every real bar to a sliver, because the target
line runs about 4× actual delivery. **A chart nobody can read is not a more
honest chart**, so the plot shows actuals and the targets live one toggle away
in the table view, with the reason stated in the card subtitle.

### Two time lenses, on purpose

A time filter is ambiguous for a lead created in June that delivered in August.
So there are two, and each metric uses the honest one:

- **Cohort lens** (`leadCohort`) — filters by *creation* month. Conversion,
  funnel and source metrics use it, so a branch is never flattered by old leads
  closing late, and leads at different maturities are never mixed.
- **Bookings lens** (`deliveredIn`) — filters by *delivery* month. Revenue,
  units and target attainment use it, because a sale belongs to the month it
  landed.

**Ageing and alerts ignore the time filter entirely.** A lead going cold is a
fact about right now, not about the reporting window. Branch scope still
applies, so a manager sees only their own queue.

### A cohort that has not aged cannot be judged, so the dashboard says so

The two-lens split above has a consequence that took a live read of the
"Last month" view to see properly. Conversion is a cohort metric: it asks what
share of the leads *created* in a window went on to deliver. On a window ending
at the edge of the export, those leads have had days rather than months to get
there — the December cohort has had a median of **13 days** against a **38-day**
company median from enquiry to delivery.

So December converts at 1.3%, and the first build reported that as a business
collapse. Three branches drew a red *converting far below the group* critical;
two of them — Central and Eastside — run above 41% over any longer window and
are entirely healthy. The one branch genuinely in trouble was sitting in that
list indistinguishable from two false alarms, which is the exact failure the
alert rules were written to avoid.

The fix is a single gate, `cohortMaturity()` in `src/lib/metrics.ts`. A window
is mature when the median lead in it has had at least the company median cycle
to close. Everything that rests on conversion is gated on it: the branch-health
alert, the overview's struggling-branch callout, the lagging badges, the
comparison chart's subtitle, the source-mix recommendation, and the narrative.
Where the gate is closed the dashboard states the reason in the CEO's own terms
rather than going quiet, because an unexplained gap invites the reader to assume
the worse of the two possible stories.

Two details matter more than the rule itself:

**Only the immature metrics are held back.** Deliveries, revenue, the pipeline
forecast and the entire action queue are unaffected and stay on screen — they
are bookings-lens or point-in-time facts and are complete for any window. The
funnel's early steps are not gated either: first contact happens in a median of
under two days, so contact rate is fully mature even in a one-month window, and
the leak diagnosis built on it stays trustworthy. Gating the whole page would
have been easier and would have thrown away most of what was still true.

**Maturity is a property of the window, never of the branch.** Measuring it
per branch would let a branch with slow leads declare itself unmeasurable, which
is precisely the excuse a dashboard should not offer. Org filters are dropped
before the maturity check runs.

The gate had to reach one place I missed on the first pass: the **period-on-period
chip** beside the conversion tile. Neutralising the tile's colour was not enough,
because the chip compares December's 13-day-old cohort against November's
46-day-old one and prints **−96%** in red — an elapsed-time artefact sitting
directly beside a notice explaining why not to read it that way. A conversion
delta needs *both* windows aged, not just the current one, so it is withheld
unless both qualify. Every other chip on the page is safe: lead counts are mature
the moment a lead is created, and revenue and units are bookings-lens facts.

**And the caveat is stated once.** An earlier version said it twice — a narrative
bullet and the notice card, forty pixels apart, in two wordings with the same two
numbers. The notice keeps it: it is visually distinct, it carries the "widen the
range" instruction, and the narrative list should stay the CEO's read of the
*business* rather than a note about method. On an immature window the narrative
simply makes no claim about conversion at all, which is the honest thing for it
to do.

The same lens confusion had produced a second bug on the Branches page, where
the group benchmark divided bookings-lens deliveries by a cohort-lens
denominator. That is not a rate at all — it printed **69.3%** for a month whose
real cohort conversion was 1.3%, and it can exceed 100% whenever a month banks
an older cohort. Both the gate and the single-lens benchmark are now pinned by
assertions in the harness, including one that the stuck-order critical still
fires on an immature window and one that Lakeside is the *only* branch flagged
across every mature range.

### Per-stage staleness thresholds, not one flat number

The brief's example ("not contacted in 7+ days") is right in spirit but wrong as
a single rule. A brand-new enquiry going quiet for two days is a problem; an
order awaiting delivery is not, until it passes the observed p90 of 28 days. So
each stage carries its own patience: new 2d, contacted 5d, test drive 7d,
negotiation 10d, order placed 21d. A flat threshold would bury four genuine
emergencies under thirty false positives. This keeps the queue at 31 leads —
short enough to actually work through.

### The forecast has an ageing haircut, and it matters

Every settled lead that ever reached `order_placed` in this dataset went on to
deliver, so the raw stage win rate is **100%**. An unadjusted model would
cheerfully book an order that has sat untouched for 195 days — and would
contradict the alert sitting right next to it. So a lead that overruns its
stage's median close time decays with a 30-day half-life.

That discount removes **₹3.95 Cr — a third of the raw estimate**. The gap
between the two numbers is, quite literally, the cost of the stalled deliveries
in the action queue, and the pipeline page says so in those words.

The tradeoff: the half-life is a judgement call, not a fitted parameter. I chose
30 days because the observed p90 for order-to-delivery is **28 days**, so a month
past median is roughly where a deal has left normal range. It cannot be fitted —
the dataset records no cancellations and all 38 stalled orders are still open, so
there are no outcomes to fit a curve against.

### How much does that guess actually matter?

Since the half-life is the one number in the model I invented rather than
measured, it is worth knowing how much of the answer rests on it. Holding the
data fixed and varying only that parameter:

| Half-life | Expected pipeline | vs shipped | Top-10 deal order |
|---|---|---|---|
| 10 days | ₹6.66 Cr | −18% | changes |
| 15 days | ₹7.11 Cr | −12% | changes |
| **30 days** | **₹8.10 Cr** | — | — |
| 45 days | ₹8.76 Cr | +8% | changes |
| 60 days | ₹9.23 Cr | +14% | changes |
| 90 days | ₹9.86 Cr | +22% | changes |

So the forecast total is genuinely soft: a ±20% band across any defensible choice
of parameter. It also reshuffles the deal ranking, because the decay scales with
each lead's own overdue days and a shorter half-life punishes the worst offenders
hardest. I had assumed the ordering would be invariant; testing it showed
otherwise, which is exactly why the test is worth running.

The table is reproducible, not asserted: `npm run verify` recomputes it and
fails if the model ever stops behaving monotonically.

**What does not move is the action queue.** Which leads are flagged as stalled,
and the order they are ranked in for chasing, comes entirely from the per-stage
staleness thresholds — the decay curve is not involved. So this parameter affects
a number the dashboard *reports*, not any decision it *asks you to make*.

That distinction is the reason the forecast is presented as "about ₹8 Cr, and
here is the assumption driving it" rather than as a precise figure. A model with
one invented parameter that nobody has stress-tested looks precise and invites
decisions it cannot support. With outcome data — a quarter of cancellations, or
stalled leads that later recovered — this becomes a fitted curve per stage, and
that is the first thing I would do with more history.

### "Now" is derived from the data, not the clock

The export ends 31 Dec 2025. Anchoring to `new Date()` would report every lead
as nine months stale. `AS_OF` is computed as the latest event in the dataset, so
the ageing maths stays correct if the export is refreshed — and the header says
which date it is using.

### Client-side, with the tradeoff acknowledged

510 leads is small. Everything is computed in the browser from a bundled JSON,
which makes filtering instant with no round trip, and all 43 routes prerender as
static HTML. The honest cost: because the filter reads from the URL via
`useSearchParams`, the initial HTML is a skeleton and the real content paints
after hydration (~600–900ms locally). I mirrored the real layout in the loading
state so nothing shifts when content lands.

At roughly ten times this data volume I would move the aggregation server-side
and ship computed slices instead of the raw dataset. At this size that would be
architecture for its own sake.

### Charts: the boring choices are the right ones

Following the visualization discipline I applied: **no dual-axis chart anywhere**
(units and revenue are small multiples on their own scales); one hue per series
with a reserved status colour only where a branch is genuinely in trouble; the
funnel is a single blue because bar length already encodes magnitude and ramping
the colour would spend the only free channel restating it; solid hairline
gridlines; every chart has a table-view twin so no value is reachable only by
hovering. The categorical pair was checked with a contrast/CVD validator rather
than eyeballed.

Bar mount animation is off — bars re-mount on every filter change, and replaying
a grow-in each time reads as flicker, not polish.

### Dark mode is a second validated palette, not an inversion

Every colour in the app is a semantic role (`--color-ink`, `--color-surface`,
`--color-accent`), so the two themes differ only in token values and no
component branches on the theme. Dark steps were chosen for the dark surface and
run through the same validator: blue `#3987e5` + orange `#d95926` on `#141922`
clears CVD ΔE 26.8 and normal-vision ΔE 31.8, and every text token clears 4.5:1
against its own surface.

Two details that separate a real implementation from a bolted-on one. The
toggle's **System** setting removes the `data-theme` attribute rather than
resolving it to a value, so the page keeps following the OS if the user changes
it with the tab open. And the stored choice is applied by a tiny inline script
in `<head>`, before React loads, because the bundle arrives far too late to stop
a white flash.

### Two accents, with a strict division of labour

The visual language is gold-led, which creates a real hazard: gold is also the
natural colour for a "watch this" warning. Both meanings cannot share a hue
without the alert hierarchy going soft — and the alerts are the most valuable
thing on the page.

So the roles are split and the split is enforced by naming:

| Token | Job | Never |
|---|---|---|
| `--color-accent` (gold) | Interactive fills — primary buttons, active nav, badges, the highlight banner | Text, charts, alerts |
| `--color-brand` (blue) | Charts and focus rings; validated for colour-blind separation | Buttons |
| `--color-warning` (orange) | "Watch" severity only | Anything clickable |

Gold measures **2.25:1 on white**, so it is physically incapable of setting
legible type — the primary button pairs a gold fill with near-black ink (8.05:1)
rather than the white text these palettes usually invite. Warning moved from
amber to a distinctly redder orange (`#ea6a1e`) so a severity marker can never
be mistaken for a call to action.

The pastel chips behind stat-tile icons are decorative identity, not encoding.
They make a row of six otherwise identical tiles scannable, and they stay out of
the charts, where colour has to mean something. Rep and customer avatars derive
their hue from the record id rather than the row index, so re-sorting a table
never repaints anyone.

### A verification harness instead of trusting the aggregates

`npm run verify` asserts 80 figures against values derived independently from
the raw JSON — totals, funnel counts, branch splits, the forecast bounds, alert
behaviour, and invariants like "branch numbers sum to the company total". It
caught a real bug: comparing a funnel against itself reported a leak of ~1e-14
leads because of floating-point residue. The threshold is now one whole lead,
which is both correct and better product behaviour.

---

## 3. What I noticed in the data

Four things, all of which shaped the product.

### ₹8.59 Cr of orders were signed and never delivered

38 leads sit at `order_placed` with **no delivery record at all**. Every
`delivered` lead has a matching record, so this is not a broken join — these are
genuinely stuck. 26 are past the 21-day window; the oldest has been waiting
**195 days**. This is revenue already won and not banked, and it became the
dashboard's headline alert.

That alert used to end with advice I made up — "chase allocation, RTO and
finance disbursement" — which was plausible, overlapped the truth, and was still
a guess. The dataset records the answer: **72 of 160 completed deliveries
slipped**, led by customer-requested date changes (18), logistics (11) and
factory allocation (11). It varies sharply by site — **Central slips on 26% of
its deliveries, Downtown on 55%** — so the alert now names the causes actually
observed in that branch's own history.

The care needed is in what that claim can support. Every one of the 38 stuck
orders has *no* delivery record, so not one of them contributes a
`delay_reason`; these figures are a **base rate from deliveries that completed**,
not a diagnosis of what is stuck now. The alert says so in those words, and the
branch card repeats the distinction. Two guards keep it honest: a branch needs
at least six delayed deliveries *and* a leading cause of at least four before it
is allowed to quote its own pattern — Central has eight delays but its top cause
is two of them, so it borrows the group's steadier prior rather than presenting a
coin flip as a finding. Lakeside, with three, does the same and says so on the
card.

### Lakeside Toyota is broken, and it is not the reps

| | Contact rate | Delivered | Conversion |
|---|---|---|---|
| Lakeside (B3) | **58%** | 6 of 79 | **7.6%** |
| Group | 77% | — | 31.4% |

The five worst-performing reps in the entire company are *all* at Lakeside.
That is the tell: when every individual at one site underperforms, it is the
site, not the people.

And it is **not** response speed — median new→contacted is 1.9 days at every
branch including Lakeside. Lakeside simply never contacts 42% of its leads at
all. That is why the branch-health alert says to start with lead handling rather
than with the reps' closing skills, and why the alert's recommendation adapts to
*which* step is leaking.

This also drove a metric choice: ranking a leak by the lowest conversion rate
picks Test Drive → Negotiation (52%), which is real but costs 13 leads. Ranking
by *excess loss against the group benchmark* picks New → Contacted, which costs
33. The second is the one worth a manager's morning, so `worstRelativeLeak`
ranks by excess volume, not by rate.

### 14 leads were closed as "lost" with no reason and no logged transition

All 14 were created in **December**. All were still mid-funnel. None has a
`lost_reason`. None has a `lost` entry in its `status_history` — the status was
changed without the transition ever being recorded. They are worth **₹3.20 Cr**,
and **7 of the 14 are Lakeside**.

Fourteen unrelated coincidences do not cluster in one month, at one branch, with
one field blank. That is a process or CRM defect — or reps clearing their
pipeline at month-end — and either way the loss reporting is under-counting real
reasons. I surfaced it as an alert rather than silently patching it, because an
FDE who spots bad client data and says so is the entire point of the role.

### Walk-ins convert 3× better than social media

| Source | Conversion | Avg deal |
|---|---|---|
| Walk-in | **45.7%** | ₹25.0 L |
| Auto expo | 30.2% | ₹25.2 L |
| Referral | 30.1% | ₹22.4 L |
| Website | 28.0% | ₹22.1 L |
| Phone enquiry | 27.8% | ₹24.4 L |
| Social media | **13.9%** | ₹27.2 L |

Social media brings the *highest-value* leads and converts them worst — either a
qualification problem or a follow-up problem, and worth diagnosing before
spending more there.

One more, less dramatic: the aggregate funnel is remarkably flat (77% / 77% /
78% / 84% / 81% stage to stage), which makes the company-wide funnel nearly
useless on its own. The story only appears per branch. That is why the branch
funnel is plotted against the company average rather than in isolation.

---

## 4. What I would build next

In rough order of value:

1. **Write actions back.** The queue currently ends at "here is what to chase."
   The obvious next step is assigning a follow-up, snoozing a lead with a
   reason, and marking a stuck order as chased — which also generates the
   feedback data needed to tune the thresholds instead of choosing them.
2. **Tune the ageing model against outcomes.** The 30-day half-life is a
   reasoned guess. With cancellation data, or six more months of history, it
   becomes a fitted curve per stage and per branch.
3. **Renegotiate the targets.** The most valuable thing this dashboard could do
   for this business is replace an unreachable 1,426-unit target with one
   derived from lead volume and observed conversion. The forecast engine already
   computes exactly the number needed.
4. **Anomaly detection on the histories.** The undocumented-loss cluster was
   found by hand. A generic rule — flag any status change that skips a
   transition, or any month where one branch's loss pattern departs from its own
   baseline — would have caught it automatically, and would catch the next one.
5. **Cohort curves.** "Of leads created in month N, what share had delivered by
   day 30 / 60 / 90" would show whether Lakeside is getting worse or recovering,
   which a point-in-time conversion rate cannot.
6. **Scheduled digests.** A Monday email with this page's narrative section and
   the top three alerts. The narrative is already generated text, so this is
   mostly plumbing — and it is how a tool like this actually gets used.

Deliberately skipped: what-if scenario modelling. It is genuinely interesting,
but with targets this unreliable the output would look precise while resting on
a broken denominator.
