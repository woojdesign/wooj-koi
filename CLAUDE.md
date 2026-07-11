# wooj-koi — operational guide

Auto-loaded each session. Keep terse; update in the same commit as any change it describes.

## What it is

A reusable **ambient koi flocking background** for web apps. Extracted from `wooj-site`
(the sumi-e koi behind every page). Framework-agnostic: one `createKoiBackground()` call
mounts a full-window p5 canvas. p5 is loaded from a CDN on demand (no build dep).

Distributed as a **public GitHub repo**, consumed as a git dependency pinned to a tag
(`"wooj-koi": "github:woojdesign/wooj-koi#v0.1.0"`). Public so Vercel (and any host)
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
