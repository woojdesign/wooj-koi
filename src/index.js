/**
 * wooj-koi — ambient sumi-e koi flocking, framework-agnostic.
 *
 *   import { createKoiBackground } from 'wooj-koi';
 *   const koi = await createKoiBackground({ container: '#koi', assetBase: '/koi' });
 *   // koi.destroy() to tear down
 *
 * Needs the koi image/SVG assets served (default at /koi). Copy them once:
 *   npx wooj-koi-assets public/koi
 *
 * p5.js is loaded from a CDN on demand, so there's no build-time dependency.
 */

import { FlockManager } from './flock-manager.js';
import { KoiRenderer } from './koi-renderer.js';
import { BrushTextures } from './brush-textures.js';
import { SVGParser } from './svg-parser.js';
import { DEFAULT_SHAPE_PARAMS } from './koi-params.js';

// Low-level building blocks, re-exported so apps that drive their own p5 loop (the koi
// simulator / editor) can consume the same renderer, flock, varieties, and configs instead
// of forking a copy. `createKoiBackground` (below) remains the high-level one-call entry.
export { KoiRenderer, KOI_BEND } from './koi-renderer.js';
export { FlockManager } from './flock-manager.js';
export { Boid } from './boid.js';
export { BrushTextures } from './brush-textures.js';
export { SVGParser } from './svg-parser.js';
export { DEFAULT_SHAPE_PARAMS, copyParams } from './koi-params.js';
export { VARIETIES, selectVariety, generatePattern } from './koi-varieties.js';
export { ANIMATION_CONFIG } from './animation-config.js';
export { RENDERING_CONFIG } from './rendering-config.js';
export { PHYSICS_CONFIG } from './physics-config.js';

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js';

function loadP5() {
  if (typeof window === 'undefined') return Promise.reject(new Error('wooj-koi requires a browser'));
  if (window.p5) return Promise.resolve(window.p5);
  if (window.__woojKoiP5) return window.__woojKoiP5;
  window.__woojKoiP5 = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = P5_CDN;
    s.onload = () => resolve(window.p5);
    s.onerror = () => reject(new Error('wooj-koi: failed to load p5 from CDN'));
    document.head.appendChild(s);
  });
  return window.__woojKoiP5;
}

// Motion defaults (calm ambient flock). Override via options.physics.
const DEFAULT_PHYSICS = {
  maxSpeed: 0.6,
  maxForce: 0.05,
  separationWeight: 1.8,
  alignmentWeight: 0.6,
  cohesionWeight: 0.8,
  attractionWeight: 1.2,
};

/**
 * Mount an ambient koi flock into a container element (a full-window canvas is
 * created and parented to it; position the container with CSS).
 *
 * @param {Object} options
 * @param {string|HTMLElement} options.container  selector or element to render into
 * @param {number}  [options.count]               number of fish (default 3, or 2 on narrow screens)
 * @param {string}  [options.assetBase='/koi']    base URL where the koi assets are served
 * @param {boolean} [options.followPointer=true]  fish gently drift toward the cursor
 * @param {Object}  [options.physics]             overrides for DEFAULT_PHYSICS (maxSpeed, weights…)
 * @returns {Promise<{ destroy: () => void, flock: any }>}
 */
export async function createKoiBackground(options = {}) {
  const {
    container,
    count,
    assetBase = '/koi',
    followPointer = true,
    physics = {},
    // Per-frame wash painted behind the koi: [r, g, b, a] (0-255). The low alpha leaves faint
    // motion trails. Default is the warm paper cream; pass a dark value for a night "pond".
    background = [244, 240, 230, 12],
  } = options;

  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) throw new Error('wooj-koi: container not found — pass a selector or element');

  const P5 = await loadP5();
  const base = String(assetBase).replace(/\/$/, '');
  const numBoids = count ?? (window.innerWidth < 640 ? 2 : 3);
  const params = { ...DEFAULT_PHYSICS, ...physics, numBoids };

  let flock, renderer, brushTextures;
  const svgVertices = { body: null, tail: null, head: null, pectoralFin: null, dorsalFin: null, ventralFin: null };
  const brushTextureImages = { body: null, fin: null, tail: null, spots: [], paper: null };
  let mouseTarget = null;

  const sketch = (p) => {
    p.preload = async function () {
      brushTextureImages.body = p.loadImage(`${base}/brushstrokes/body-processed.png`);
      brushTextureImages.fin = p.loadImage(`${base}/brushstrokes/fin.png`);
      brushTextureImages.tail = p.loadImage(`${base}/brushstrokes/tail.png`);
      brushTextureImages.spots = [1, 2, 3, 4, 5].map((n) => p.loadImage(`${base}/brushstrokes/spot-${n}-processed.png`));
      brushTextureImages.paper = p.loadImage(`${base}/brushstrokes/paper.png`);
      svgVertices.body = await SVGParser.loadSVGFromURL(`${base}/body-parts/body.svg`, 20, { width: 16, height: 5.2 });
      svgVertices.tail = await SVGParser.loadSVGFromURL(`${base}/body-parts/tail.svg`, 20, { width: 6, height: 4 });
      svgVertices.head = await SVGParser.loadSVGFromURL(`${base}/body-parts/head.svg`, 20, { width: 7.5, height: 5.0 });
      svgVertices.pectoralFin = await SVGParser.loadSVGFromURL(`${base}/body-parts/pectoral-fin.svg`, 20, { width: 4.5, height: 2 });
      svgVertices.dorsalFin = await SVGParser.loadSVGFromURL(`${base}/body-parts/dorsal-fin.svg`, 20, { width: 4, height: 5 });
      svgVertices.ventralFin = await SVGParser.loadSVGFromURL(`${base}/body-parts/ventral-fin.svg`, 20, { width: 3, height: 1.5 });
    };

    p.setup = function () {
      const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
      canvas.parent(el);
      brushTextures = new BrushTextures();
      brushTextures.loadImages(brushTextureImages);
      brushTextures.setP5Instance(p);
      renderer = new KoiRenderer(brushTextures);
      const tempVec = p.createVector(0, 0);
      const p5Instance = { Vector: tempVec.constructor };
      flock = new FlockManager(params.numBoids, p.width, p.height, {
        random: (...a) => p.random(...a),
        createVector: (...a) => p.createVector(...a),
        floor: (...a) => p.floor(...a),
        p5Instance,
      });
    };

    p.draw = function () {
      p.clear();
      p.background(...background);
      if (followPointer) {
        if (p.mouseX >= 0 && p.mouseY >= 0 && p.mouseX <= p.width && p.mouseY <= p.height &&
            (p.mouseX !== p.pmouseX || p.mouseY !== p.pmouseY)) {
          mouseTarget = { x: p.mouseX, y: p.mouseY };
        } else if (p.mouseX < 0 || p.mouseY < 0 || p.mouseX > p.width || p.mouseY > p.height) {
          mouseTarget = null;
        }
      }
      flock.update(params, mouseTarget);
      for (const boid of flock.boids) {
        const waveTime = boid.wavePhase + boid.animationOffset;
        const sizeScale = boid.sizeMultiplier * (p.width < 640 ? 5.5 : 9.9);
        // Wiggle amplitude tracks speed, so a gliding fish undulates gently.
        const speedFrac = Math.min(1, boid.speed / (params.maxSpeed * boid.speedMultiplier));
        // Fish encode speed in tail-beat FREQUENCY, not amplitude (Bainbridge 1958; Strouhal
        // number stays ~0.2-0.4). wavePhase already advances with speed, so hold the wave
        // amplitude ~constant here (small residual so a near-stopped fish reads as easing off);
        // the burst-and-coast gait supplies the real low-effort amplitude drop.
        const ampScale = boid.sizeMultiplier * (0.8 + 0.2 * speedFrac);
        const renderParams = {
          shapeParams: DEFAULT_SHAPE_PARAMS,
          colorParams: boid.color,
          pattern: boid.pattern,
          animationParams: {
            waveTime,
            sizeScale,
            waveAmplitudeScale: ampScale,
            lengthMultiplier: boid.lengthMultiplier,
            tailLength: boid.tailLength,
            speedFraction: speedFrac, // drives the tail wag + fork pinch
            flick: boid.flick,        // swim-gait burst (glide↔flick undulation)
            // curvature (1/turn-radius): the body flex tracks the arc. Smoothed on its own
            // time constant (boid.renderCurvature) so the tail eases in/out, never snaps.
            turnRate: boid.renderCurvature,
          },
          modifiers: { brightnessBoost: 0, saturationBoost: 0, sizeScale: 1 },
          boidSeed: Math.floor(boid.animationOffset * 1000),
          svgVertices,
        };
        // Toroidal wrap: near an edge, also draw the fish shifted by the canvas size,
        // so it slides onto the opposite side instead of popping in/out.
        const margin = 20 * sizeScale;
        const xs = [0];
        if (boid.position.x < margin) xs.push(p.width);
        if (boid.position.x > p.width - margin) xs.push(-p.width);
        const ys = [0];
        if (boid.position.y < margin) ys.push(p.height);
        if (boid.position.y > p.height - margin) ys.push(-p.height);
        for (const ox of xs) {
          for (const oy of ys) {
            renderer.render(p, boid.position.x + ox, boid.position.y + oy, boid.heading, renderParams);
          }
        }
      }
    };

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      if (flock) { flock.width = p.width; flock.height = p.height; }
    };
  };

  const instance = new P5(sketch);
  return {
    destroy() { try { instance.remove(); } catch (e) { /* already gone */ } },
    get flock() { return flock; },
  };
}

export default createKoiBackground;
