# Presidential Speech — IHSG Simulator

> He takes the podium. The market starts sweating.

A browser-based Breakout satire built with 50 Indonesian Stock Exchange logos.
The paddle reads **Presidential Speech**; every brick hit pushes the simulated
IHSG lower and displays one of 16 documented Prabowo remarks. Exact quote text,
event context, and source URLs live in `speech-quotes.mjs`; fictional reassurance
copy is not used.

The original game remains the main experience. It now includes a deterministic
Jakarta-date daily challenge, an explicit mobile-only pause/resume control, reduced-motion
support, always-on mobile haptics where the vibration API is available, a result breakdown, replay, and an exportable
PNG result card. Below it, a data-backed Market Terminal adds five-minute delayed
IHSG snapshots, an interactive permalinkable 3M/6M/1Y chart with hover, tap-and-hold
price inspection, and keyboard-accessible speech-event controls. The terminal also
shows an interactive 30-session USD/IDR mini chart with press/drag price inspection,
speech-day USD/IDR impact, independent feed timestamps, sourced presidential speech
context, daily event-impact calculations,
a verified speech archive, fully dated IHSG headlines, latest stock/issuer news,
and macro-market coverage for BI rates, inflation, rupiah, commodities, and global indices.
A persistent Light/Dark switch
themes the page, chart, overlays, and canvas game together while respecting the
system preference on first visit.

Inspired by [Open Weights Breakout](https://huggingface.co/spaces/burtenshaw/open-weights-breakout)
by burtenshaw.

## Play

Live site: https://farizvect.github.io/my-president-breakout/

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

Controls: `←` `→` move · `Space` launch · mouse drag/tap supported.
On touch screens, drag to move, tap to launch, and receive haptic feedback
automatically where the vibration API is supported.

## Physics

- Fixed 120 Hz simulation independent of display frame rate
- Circle-vs-rectangle collision detection
- Previous-position collision resolution to reduce tunneling and sticky bricks
- Paddle angle based on impact point
- Gradual speed increase with enforced minimum and maximum velocity
- Ball trail, impact particles and restrained screen shake (disabled by reduced-motion preference)
- Seeded launch sequence shared by every player for the same Jakarta calendar date

## Test

```sh
node --test tests/*.test.mjs
node check.mjs
```

`game-core.mjs` is DOM-free and unit-tested. `check.mjs` verifies the 50-brick
grid, logo assets, layout bounds, quote pool, and the invariant that the
simulated IHSG never rises.

`market-core.mjs` contains independently tested market normalization, event
study, RSS parsing, latest-session and schedule-selection logic.

## Market data

```sh
node scripts/fetch-data.mjs
```

This refreshes `data/live.json` from:

- Yahoo Finance `^JKSE` one-minute quote metadata plus daily chart history (delayed)
- Yahoo Finance `IDR=X` USD/IDR quote, daily move, and one-year daily history (delayed)
- Separate Google News RSS indexes for IHSG, stock/issuer, and macro-market headlines,
  each linking to its original publisher

Speech records in `data/events.json` are curated from official Presidency and
Cabinet Secretariat pages. They currently have date-level precision, so the
site calculates previous close → event-session close → next-session close for
both IHSG and USD/IDR where surrounding sessions exist. A
separately attributed DPR event note preserves rounded reported intraday
landmarks without mixing them with Yahoo's two-decimal daily close. See
`data/SOURCES.md` for the source audit and accuracy boundary.

The included GitHub Actions workflow runs the test suite and refreshes the
snapshot once per hour during IDX market hours on weekdays. Open pages
poll the snapshot every minute (public hosts read the latest commit from
raw.githubusercontent.com) so new workflow data appears without a full site
redeploy. Each feed exposes its own quote/publication timestamp and stale
state; one successful feed cannot make another look current. This is not a licensed
exchange real-time feed.

## Stack

Vanilla HTML, Canvas, SVG and JavaScript modules. No dependencies and no build step.

Satire, not investment advice. Correlation between speeches and index movements
is exaggerated for comedy. Logos and trademarks belong to their respective
owners; inclusion is not an endorsement or a statement about any company.
