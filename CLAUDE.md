# wooj-koi — operational guide

Auto-loaded each session. Keep terse; update in the same commit as any change it describes.

## What it is

A reusable **ambient koi flocking background** for web apps. Extracted from `wooj-site`
(the sumi-e koi behind every page). Framework-agnostic: one `createKoiBackground()` call
mounts a full-window p5 canvas. p5 is loaded from a CDN on demand (no build dep).

Distributed as a **public GitHub repo**, consumed as a git dependency pinned to a tag
(`"wooj-koi": "github:woojdesign/wooj-koi#v0.1.5"`). Public so Vercel (and any host)
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
`files` whitelist, and it postdates the tags consumers pin). Locally: `npm run tester`
(python http.server on :8123 — 8080 is taken by a sibling Rails app), open `/tester/`.

**Deployed at https://wooj-koi.vercel.app** (Vercel project `wooj-koi`, static: `vercel.json`
sets `outputDirectory: "."` + a `/` → `/tester/index.html` redirect). The repo is git-linked,
so pushes to `main` auto-deploy the tester to production. Vercel Authentication was disabled
on the project (API: `ssoProtection: null`) so it's public — a fresh deploy shouldn't
re-enable it, but if a URL starts 302'ing to `vercel.com/sso-api`, that's the toggle.

- `tester/index.html` — live flock; every dial (PHYSICS_CONFIG, params, KOI_BEND,
  ANIMATION_CONFIG.wave) is a slider that mutates the imported config object in place, so it's
  the REAL package behaviour. Conditions (count, crowd/scatter, pointer, trails, pause) +
  debug overlay (turn-radius circle, heading, perception). **Export settings** dumps the
  dials as JSON — that's how a tuning comes back to get baked into the source.
- `tester/koi.html` — variety gallery (all 26 from `VARIETIES`) + single-koi inspector
  (variety, reroll pattern, randomize, size/length/tail/bend/wave). `?mode=inspect`.
- `tester/turn.html` — RAIL tuner: ONE koi glued to a path (circle / weave / straight) at a
  known curvature — no flocking, no chase — driven analytically (`railStep`), so the body
  deformation + wiggle are tuned directly against the geometry. Passes the curvature to the
  renderer as `turnRate` (optionally through the same `BEND_SMOOTHING` EMA as the package;
  toggle "smooth bend" off for the instant/raw bend). Exposes only bend + wiggle dials; the
  physics turning knobs live in the flock tester. Renders at the site's 9.9 scale so the
  radius-to-body ratio matches production. (Chase-a-target was dropped — it tracked too
  loosely to tune the animation.)
- Needed `export const KOI_BEND` in `koi-renderer.js` so the tester can tune it live (was
  module-private). Harmless additive export.

## Gotchas

- **The app owns framing.** Blur, opacity, e-ink (don't init on e-ink), and view-transition
  persistence live in the consumer's wrapper, not here. See `wooj-site`'s `KoiBackground.astro`.
- **Full-window canvas.** `createCanvas(windowWidth, windowHeight)`; the container is just
  the parent, positioned with CSS. (No container-sized mode yet.)
- **p5 preload is async** and mixes tracked `loadImage` calls with awaited SVG fetches; it
  works because the image loads hold `setup` long enough. Don't "tidy" it without testing.
- **Load-flash (fixed 0.1.5):** p5 blocks `setup` on the tracked `loadImage` calls but NOT on
  the awaited SVG fetches, so for the first frames `svgVertices.body` is null and the old code
  fell through to the procedural (un-textured, stroked) koi — a visible flash of "bad vectors
  with a border" on load. `render()` now returns early until `svgVertices.body` is loaded, so
  a not-yet-ready koi draws nothing instead of the fallback.

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

**Body bend = a true circular arc (reworked from the 0.1.3 parabola):** the centerline is now
`y = wave + arcOffset(κ, u)` where `arcOffset = (1 − cos(κ·u)) / κ / sizeScale`, `u` = the
segment's body-axis offset in px, and `κ = koiCurvature(turnRate) = clamp(KOI_BEND.match ·
turnRate, ±KOI_BEND.maxCurve)`. Why it changed: the old `bend·t²` was a parabola measured from
the HEAD (t=0), so the head stayed rigid and deflection piled up quadratically toward the tail
— flinging/stretching the tail while the front didn't match the path. The arc is EVEN in u
(head and tail curve together toward the turn centre → constant curvature, "begins" at the
middle) and BOUNDED (the tail follows the arc, no runaway). `arcOffset` returns UNITS because
the deform (`applyWaveDeformation`) adds spine-y to the vertex y and THEN scales by sizeScale;
offset is 0 at the anchor (u=0) so the fish stays on its path. `match` = fraction of the path
curvature the body takes (**1 = body lies exactly on the rail**), `maxCurve` caps how tight the
body itself bends. Tune with the rail tuner (`tester/turn.html`, circle + raw bend) — the HUD
shows body-arc-radius vs rail-radius, equal at match 1.

Two refinements so the TAIL doesn't look disproportionately distorted vs the body:
- **Rib rotation** (`applyWaveDeformation`): the body deform now rotates each vertex's
  perpendicular offset to follow the spine tangent (a normal-ribbon) instead of only shifting
  y. Pure y-shift SHEARS the outline where the spine is steep (the tail), so the fan stretched;
  rotating the ribs keeps it clean. `drawBodyFromSVG` passes `sizeScale` in `deformationParams`
  to enable it (other 'wave' users — dorsal fin, clip — omit it and keep the plain shift).
- **Stiff tail** (`extendBodyWithTail`): the caudal fin trails STRAIGHT along the body-end
  tangent instead of continuing the arc, matching a real (stiff) tail and stopping the over-curl.

**Tail-flick (0.1.4):** the bend is driven by curvature (angularVelocity ÷ speed), which
snaps to zero and back whenever the fish briefly finishes a turn and a crowding nudge starts
another — so the tail flicked straight↔curved (worse when two fish are together). The bend
now reads a SEPARATELY-smoothed `boid.renderCurvature` (low-passed at `BEND_SMOOTHING` 0.045,
~0.35s), which rides through the brief turn-abort blips and eases the tail in/out instead of
snapping; sustained turns still bend. `index.js` passes `boid.renderCurvature` as the
renderer's `turnRate` (NOT the raw `angularVelocity/speed`). Traced + measured with
`koi-sim/trace.mjs` and `koi-sim/bend.mjs`. NB the smoothing lags sustained-turn bend ~20%;
if the body looks under-bent, nudge `KOI_BEND.match` up, not the smoothing down.
