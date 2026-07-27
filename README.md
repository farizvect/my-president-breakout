# Presidential Speech — IHSG Simulator

> He takes the podium. The market starts sweating.

A browser-based Breakout satire built with 50 Indonesian Stock Exchange logos.
The paddle reads **Presidential Speech**; every brick hit pushes the simulated
IHSG lower.

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

## Stack

Vanilla HTML, Canvas and JavaScript modules. No dependencies and no build step.

Satire, not investment advice. Correlation between speeches and index movements
is exaggerated for comedy. Logos and trademarks belong to their respective
owners; inclusion is not an endorsement or a statement about any company.
