# wooj-koi — operational guide

Auto-loaded each session. Keep terse; update in the same commit as any change it describes.

## What it is

A reusable **ambient koi flocking background** for web apps. Extracted from `wooj-site`
(the sumi-e koi behind every page). Framework-agnostic: one `createKoiBackground()` call
mounts a full-window p5 canvas. p5 is loaded from a CDN on demand (no build dep).

Distributed as a **public GitHub repo**, consumed as a git dependency pinned to a tag
(`"wooj-koi": "github:woojdesign/wooj-koi#v0.1.4"`). Public so Vercel (and any host)
resolves it at build time with no auth — a local `file:../wooj-koi` can't deploy, since
only the consumer repo is checked out on the build server. Bump = push here, `git tag
vX.Y.Z`, then bump the ref in the consumer. For local iteration on the package, swap the
consumer to `file:../wooj-koi`. `wooj-site` is the reference consumer.

## Layout

- `src/index.js` — the public entry, `createKoiBackground({ container, assetBase, count,
  followPointer, physics })`. Loads p5, loads assets from `assetBase`, builds the flock +
  renderer, runs the draw loop (speed-linked wiggle, curvature-based body bend, toroidal
  edge wrap). Returns `{ destroy, flock }`.
- `src/*.js` — the simulation + renderer (pure, no framework):
  - `boid.js` — bend-to-turn motion: each fish keeps its own heading + speed, turns toward
    the desired direction at a capped rate (can't wobble), breaks off the school now and
    then, and advances a speed-linked wiggle phase.
  - `flock-manager.js` / `flocking-forces.js` — Reynolds boids steering.
  - `physics-config.js` — the motion dials (MAX_TURN_RATE, speeds, break-off, WAVE_RATE).
  - `koi-renderer.js` — the sumi-e fish. Body + tail are ONE outline over one bent
    centerline (`extendBodyWithTail`), so the tail can't detach; `KOI_BEND` sets the body
    flex; brush textures + spots.
  - `animation-config.js` — wiggle amplitude/phase; `koi-varieties.js` — colors/patterns;
    `svg-parser.js`, `brush-textures.js`, `koi-params.js`, `rendering-config.js`.
- `koi/` — the assets (`body-parts/*.svg`, `brushstrokes/*.png`). Shipped in the package;
  consumers copy them to their served dir via `bin/copy-assets.js` (`npx wooj-koi-assets`).

## Tester (dev tool)

`tester/` is a browser playground for tuning — served, not shipped (excluded from the npm
`files` whitelist, and it postdates the tags consumers pin). `npm run tester` (python
http.server on :8123 — 8080 is taken by a sibling Rails app), open `/tester/`.

- `tester/index.html` — live flock; every dial (PHYSICS_CONFIG, params, KOI_BEND,
  ANIMATION_CONFIG.wave) is a slider that mutates the imported config object in place, so it's
  the REAL package behaviour. Conditions (count, crowd/scatter, pointer, trails, pause) +
  debug overlay (turn-radius circle, heading, perception). **Export settings** dumps the
  dials as JSON — that's how a tuning comes back to get baked into the source.
- `tester/koi.html` — variety gallery (all 26 from `VARIETIES`) + single-koi inspector
  (variety, reroll pattern, randomize, size/length/tail/bend/wave). `?mode=inspect`.
- Needed `export const KOI_BEND` in `koi-renderer.js` so the tester can tune it live (was
  module-private). Harmless additive export.

## Gotchas

- **The app owns framing.** Blur, opacity, e-ink (don't init on e-ink), and view-transition
  persistence live in the consumer's wrapper, not here. See `wooj-site`'s `KoiBackground.astro`.
- **Full-window canvas.** `createCanvas(windowWidth, windowHeight)`; the container is just
  the parent, positioned with CSS. (No container-sized mode yet.)
- **p5 preload is async** and mixes tracked `loadImage` calls with awaited SVG fetches; it
  works because the image loads hold `setup` long enough. Don't "tidy" it without testing.

## Feel / tuning

The look-and-feel history (calm rate-limited turning, break-off, seamless wrap, bend-to-turn
with an attached tail, per-fish tail size, speed-linked wiggle) is captured in git. Dials:
`physics-config.js` (motion), `koi-renderer.js` `KOI_BEND` + `extendBodyWithTail` (bend/tail),
`animation-config.js` (wiggle).

**Anti-wobble (0.1.1):** near equilibrium the fish used to make endless sub-degree turn
corrections toward a jittering desired-heading, so the rotation micro-reversed frame to
frame (visible as jitter, worse when crowded). Fixed in `boid.js update()` with a turn
`TURN_DEADZONE` (~3°: stop steering when nearly on-heading) + `ANGVEL_SMOOTHING` (low-pass
the turn rate so it can't flip sign each frame). Measured ~70% drop in turn reversals +
turn-rate shake with arcs unchanged. Headless jitter harness lives in git history / the
session scratchpad (`koi-sim/harness.mjs`) — re-run it if you retune these.

**Turn radius (0.1.2–0.1.3):** the fish are drawn ~175px long but were turning at ~0.23 of a
body-length radius (35px) — a spin in place, not a forward arc. Now each fish's turn radius
scales with ITS OWN body length: `boid.turnRadius = TURN_RADIUS_FACTOR × sizeMultiplier ×
lengthMultiplier` (≈0.85 body-length), and `maxTurn = speed / turnRadius` (radius constant
with speed). `MIN_SPEED_FRACTION` 0.45 → 0.6 keeps them gliding forward through the turn.
Cost is lazier turns (~5s for 90°) — the intended calm feel. Measure radius in body-lengths
with `koi-sim/radius.mjs`.

**Body bend matches the arc (0.1.3):** `koiBend()` sets the centerline curve `y = wave +
bend·t²` to follow the travelled arc. The gotcha: the body deform (`applyWaveDeformation`)
adds the spine y to the SVG vertex y and THEN scales by `sizeScale`, so **bend is in SVG
units, not px** — the drawn deflection is `bend·sizeScale`. Matching an arc of radius R
gives `bend = 128 · sizeScale · turnRate` units (128 = ½·16², body is 16 units wide);
`KOI_BEND.match` (0.3) dials it down from the literal arc (a 0.85-radius arc is nearly a
hairpin and over-sweeps the tail), `maxUnits` caps it. Calibrated with a throwaway
`_bendtest.html` that renders fish at fixed hard-left/straight/hard-right turnRates — re-add
one like it (import the renderer, `noLoop`, screenshot) if you retune the bend; DON'T just
crank the number blind, the tail flings past ~5 units.

**Tail-flick (0.1.4):** the bend is driven by curvature (angularVelocity ÷ speed), which
snaps to zero and back whenever the fish briefly finishes a turn and a crowding nudge starts
another — so the tail flicked straight↔curved (worse when two fish are together). The bend
now reads a SEPARATELY-smoothed `boid.renderCurvature` (low-passed at `BEND_SMOOTHING` 0.045,
~0.35s), which rides through the brief turn-abort blips and eases the tail in/out instead of
snapping; sustained turns still bend. `index.js` passes `boid.renderCurvature` as the
renderer's `turnRate` (NOT the raw `angularVelocity/speed`). Traced + measured with
`koi-sim/trace.mjs` and `koi-sim/bend.mjs`. NB the smoothing lags sustained-turn bend ~20%;
if the body looks under-bent, nudge `KOI_BEND.match` up, not the smoothing down.
