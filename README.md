# wooj-koi

Ambient sumi-e koi flocking, as a drop-in background for any web app. Framework-agnostic:
it's a single `createKoiBackground()` call that mounts a full-window p5 canvas of koi that
school, break off, bend to turn, and wrap seamlessly across the viewport.

## Install

From the public GitHub repo, pinned to a tag (resolves on any host — Vercel, etc. — with
no auth):

```jsonc
// package.json
"dependencies": { "wooj-koi": "github:woojdesign/wooj-koi#v0.1.5" }
```

then `npm install`. p5.js is fetched from a CDN on demand — no build-time dependency. For
local iteration on the package itself, swap in `"file:../wooj-koi"` and `npm install`.

## Assets

The koi need a handful of images + SVGs served somewhere. Copy them into your public dir
once:

```sh
npx wooj-koi-assets public/koi
```

(or point `assetBase` at wherever you serve them.)

## Use

```js
import { createKoiBackground } from 'wooj-koi';

const koi = await createKoiBackground({
  container: '#koi',      // selector or element; a full-window canvas is parented to it
  assetBase: '/koi',      // where the assets are served (default '/koi')
  // count: 3,            // fish (default 3, or 2 on narrow screens)
  // followPointer: true, // fish drift toward the cursor
  // physics: { maxSpeed: 0.6 },
});

// later: koi.destroy();
```

Position the container yourself (usually fixed, behind everything):

```css
#koi { position: fixed; inset: 0; z-index: -1; opacity: .4; }
```

The app owns framing (blur, opacity, e-ink handling, view-transition persistence). The
package just draws the fish.

## Tester

A browser playground for tuning, in `tester/` (dev-only, not shipped in the package):

```sh
npm run tester          # serves the repo on :8123
# open http://localhost:8123/tester/
```

- **Flock tester** (`tester/index.html`) — the live flock with every dial as a slider
  (turning, speed, flocking, bend, wiggle), condition controls (fish count, crowd/scatter,
  follow-pointer, motion trails, pause), and a debug overlay (turn-radius circle, heading,
  perception). Hit **export settings** to copy the current dials as JSON.
- **Koi viewer** (`tester/koi.html`) — a gallery of all 26 varieties, and an inspector for a
  single koi (pick a variety, reroll its pattern, randomize a fish, and scrub size / length /
  tail / bend / wave). `?mode=inspect` opens straight to the inspector.
- **Rail tuner** (`tester/turn.html`) — one koi glued to a path (circle / weave / straight) at
  a known curvature, so you can tune the body bend + wiggle directly against the geometry
  (no flocking, no chase). Bend + wiggle dials, a rail/heading overlay, and a HUD reading the
  radius in body-lengths and the drawn bend.

## Tuning

The feel lives in the source: `src/physics-config.js` (turn rate, speeds, break-off),
`src/koi-renderer.js` (`KOI_BEND` body flex, the tail fan in `extendBodyWithTail`),
`src/animation-config.js` (wiggle). See the code comments.
