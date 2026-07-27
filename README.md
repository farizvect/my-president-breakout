# Presidential Speech — IHSG Simulator

> He takes the podium. The market starts sweating.

A browser-based Breakout satire built with 50 Indonesian Stock Exchange logos.
The paddle reads **Presidential Speech**; every brick hit pushes the simulated
IHSG lower.

The original game remains the main experience. Below it, a data-backed Market
Terminal adds delayed IHSG prices, a one-year chart, sourced presidential speech
markers, daily event-impact calculations, a verified speech archive, and recent
IHSG headlines. A persistent Light/Dark switch themes the page, chart, overlays,
and canvas game together while respecting the system preference on first visit.

Inspired by [Open Weights Breakout](https://huggingface.co/spaces/burtenshaw/open-weights-breakout)
by burtenshaw.

## Run

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

Controls: `←` `→` move · `Space` launch · `P` pause · mouse/touch supported.

## Physics

- Fixed 120 Hz simulation independent of display frame rate
- Circle-vs-rectangle collision detection
- Previous-position collision resolution to reduce tunneling and sticky bricks
- Paddle angle based on impact point
- Gradual speed increase with enforced minimum and maximum velocity
- Ball trail, impact particles and restrained screen shake

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

- Yahoo Finance `^JKSE` daily chart data (delayed)
- Google News RSS headlines linking to their original publishers

Speech records in `data/events.json` are curated from official Presidency and
Cabinet Secretariat pages. They currently have date-level precision, so the
site calculates previous close → event-session close → next-session close. It
does not fabricate intraday before/after figures. See `data/SOURCES.md` for the
source audit and accuracy boundary.

The included GitHub Actions workflow runs the test suite and refreshes the
snapshot once after market close on weekdays.

## Stack

Vanilla HTML, Canvas, SVG and JavaScript modules. No dependencies and no build step.

Satire, not investment advice. Correlation between speeches and index movements
is exaggerated for comedy. Logos and trademarks belong to their respective
owners; inclusion is not an endorsement or a statement about any company.
