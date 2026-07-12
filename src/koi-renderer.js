/**
 * Koi Renderer
 * Pure koi rendering logic with no dependencies on flocking or audio
 * Consolidates all duplicated rendering code from sketch.js and koi-editor.js
 */

import { DEFAULT_SHAPE_PARAMS } from './koi-params.js';
import { ANIMATION_CONFIG } from './animation-config.js';
import { RENDERING_CONFIG } from './rendering-config.js';

// Body bend when turning — the centerline is a true CIRCULAR ARC of the turn's curvature,
// not a parabola. The old `bend·t²` was measured from the HEAD (t=0), so the head stayed put
// and deflection piled up quadratically toward the tail — flinging the tail out and stretching
// the wrist while the front stayed rigid. Instead: each spine point at body-axis offset u (px
// from the anchor) sits on a circle of curvature κ, so its perpendicular offset is
//   y(u) = (1 − cos(κ·u)) / κ.
// That's EVEN in u (head and tail curve the same way toward the turn centre → the curvature is
// distributed along the whole body, "beginning" at the middle), and it's BOUNDED (the tail
// follows the arc instead of a runaway t²). Offset is 0 at the anchor (u=0), so the fish stays
// on its path. Drawn deflection = y·sizeScale (the deform scales the spine), so we return units.
// `match` = the fraction of the path curvature the body takes (1 = lies exactly on the rail);
// `maxCurve` caps how tight the body itself will bend (px⁻¹).
export const KOI_BEND = { match: 1.0, maxCurve: 0.02 };
function koiCurvature(turnRate) {
    return Math.max(-KOI_BEND.maxCurve, Math.min(KOI_BEND.maxCurve, KOI_BEND.match * turnRate));
}
// Perpendicular spine offset (in vertex units) at body-axis position xPx, for a given curvature.
function arcOffset(curvature, xPx, sizeScale) {
    if (Math.abs(curvature) < 1e-6) return 0;
    return (1 - Math.cos(curvature * xPx)) / curvature / sizeScale;
}

/**
 * Brush Texture Rendering Constants
 */
const BRUSH_TEXTURE_CONFIG = {
    // Spot rendering
    SPOT_SIZE_MULTIPLIER: 1.5,          // Scale up spots now that clipping works
    SPOT_SIZE_VARIATION_MIN: 0.8,       // Minimum random size variation
    SPOT_SIZE_VARIATION_MAX: 1.2,       // Maximum random size variation
    SPOT_ROTATION_VARIATION: 30,        // Degrees of random rotation (±)
    SPOT_HEIGHT_RATIO: 0.8,             // Height-to-width ratio for spots (oval shape)

    // Adaptive opacity based on body brightness
    DARK_FISH_THRESHOLD: 50,            // Brightness threshold for dark fish
    DARK_FISH_SPOT_ALPHA: 140,          // Alpha for spots on dark fish (0-255)
    LIGHT_FISH_SPOT_ALPHA: 180,         // Alpha for spots on light fish (0-255)

    // Body texture
    BODY_TEXTURE_ALPHA: 8,              // Opacity for body brush texture
    BODY_TEXTURE_SCALE: 1.5,            // Scale multiplier for body texture
};

/**
 * Procedural Rendering Constants (when SVG not available)
 * These values define the appearance of procedurally-drawn body parts
 */
const PROCEDURAL_RENDERING = {
    // Body shape
    body: {
        WIDTH_MULTIPLIER: 0.48,          // Half-width multiplier for body segments (0.48 = ~96% of segment width)
        ASYMMETRY_FACTOR: 0.15,          // Asymmetry influence on top/bottom width
        SEGMENT_LINE_WEIGHT: 0.3,        // Stroke weight for body segment lines
        SEGMENT_LINE_ALPHA: 0.4,         // Opacity for body segment lines
        BRIGHTNESS_OFFSET: -2,           // Brightness offset from base color
        SATURATION_BOOST: 10,            // Saturation boost for segment lines
        BRIGHTNESS_BOOST: -25,           // Brightness adjustment for segment lines
    },

    // Fin shape and animation
    fins: {
        ROTATION_FREQUENCY: 1.2,         // Frequency multiplier for fin rotation animation
        SWAY_PHASE_OFFSET: -0.5,         // Phase offset for fin sway animation
        SWAY_AMPLITUDE: 0.8,             // Amplitude for pectoral fin sway
        OPACITY_NORMAL: 0.7,             // Opacity for normal (non-sumi-e) fins
        OPACITY_SUMIE: 0.6,              // Base opacity for sumi-e style fins
        SATURATION_BOOST: 8,             // Saturation boost for fins
        BRIGHTNESS_OFFSET: -15,          // Brightness offset for fins

        // Pectoral fin
        pectoral: {
            ROTATION_AMPLITUDE: 0.15,    // Rotation amplitude in radians
            CENTER_OFFSET: 2.25,         // X offset from segment center
            WIDTH: 4.5,                  // Fin width
            HEIGHT: 2,                   // Fin height
        },

        // Dorsal fin
        dorsal: {
            ROTATION_ANGLE: -0.2,        // Static rotation angle in radians
            LAYER_OFFSET: 0.15,          // Offset between sumi-e layers
            OPACITY_PRIMARY: 0.6,        // Primary layer opacity (sumi-e)
            OPACITY_SECONDARY: 0.3,      // Secondary layer opacity (sumi-e)
            OPACITY_NORMAL: 0.75,        // Normal rendering opacity
            // Procedural fin vertex coordinates (when SVG not available)
            VERTEX_Y_BASE: 0,            // Y coordinate at base
            VERTEX_Y_TIP_1: -2,          // Y coordinate of first tip vertex
            VERTEX_Y_TIP_2: -2.5,        // Y coordinate of highest tip vertex
            VERTEX_Y_TIP_3: -1.5,        // Y coordinate of third tip vertex
            VERTEX_X_LEFT: -1,           // X coordinate of left vertex
            VERTEX_X_MID: 1,             // X coordinate of middle vertex
            VERTEX_X_RIGHT: 2,           // X coordinate of right vertices
        },

        // Ventral fin
        ventral: {
            ROTATION_AMPLITUDE: 0.1,     // Rotation amplitude in radians
            CENTER_OFFSET: 1.5,          // X offset from segment center
            WIDTH: 3,                    // Fin width
            HEIGHT: 1.5,                 // Fin height
        }
    },

    // Tail shape and animation
    tail: {
        LENGTH_MULTIPLIER: 6,            // Base tail length multiplier (tailLength parameter scales this)
        SWAY_PHASE_OFFSET: -2.5,         // Phase offset for tail flutter wave
        SWAY_PHASE_GRADIENT: -2,         // Phase change per unit distance (creates traveling wave)
        SWAY_AMPLITUDE: 3,               // Flutter amplitude multiplier
        SWAY_AMPLITUDE_START: 0.5,       // Flutter amplitude at base
        SWAY_AMPLITUDE_END: 1.0,         // Flutter amplitude at tip
        WAVE_CONTINUATION: 0.5,          // How much to continue body wave into tail (t factor)
        SATURATION_BOOST: 5,             // Saturation boost for tail
        BRIGHTNESS_OFFSET: -12,          // Brightness offset for tail
        OPACITY_PRIMARY: 0.7,            // Primary layer opacity (sumi-e)
        OPACITY_SECONDARY: 0.25,         // Secondary layer opacity (sumi-e)
        LAYER_OFFSET: 0.4,               // Offset between sumi-e layers
    },

    // Head shape
    head: {
        BRIGHTNESS_OFFSET: 2,            // Brightness offset from body (slightly brighter)
        OPACITY_PRIMARY: 0.8,            // Primary layer opacity (sumi-e)
        OPACITY_SECONDARY: 0.3,          // Secondary layer opacity (sumi-e)
        LAYER_OFFSET: 0.25,              // Position offset between layers
        SIZE_VARIATION: 0.08,            // Size variation per layer
    },

    // Sumi-e layering
    sumie: {
        LAYER_OFFSET_BODY: 0.3,          // Position offset for body layers
        LAYER_OFFSET_FIN: 0.2,           // Position offset for fin layers
        OPACITY_PRIMARY: 0.7,            // Primary layer opacity for body
        OPACITY_SECONDARY: 0.3,          // Secondary layer opacity for body
        OPACITY_FIN_PRIMARY: 0.5,        // Primary layer opacity for fins
        OPACITY_FIN_SECONDARY: 0.25,     // Secondary layer opacity for fins
        LAYER_OFFSET_SVG: 0.3,           // Position offset for SVG shape layers
        OPACITY_SVG_SECONDARY: 0.4,      // Secondary layer opacity for SVG shapes
    }
};

export class KoiRenderer {
    /**
     * Create a new koi renderer
     * @param {BrushTextures} brushTextures - Brush textures for sumi-e rendering (optional)
     */
    constructor(brushTextures = null) {
        this.brushTextures = brushTextures;
        this.useSumieStyle = brushTextures !== null && brushTextures.isReady;

        // Debug: toggle individual layers on/off (set by the tester to isolate parts).
        this.parts = { fins: true, body: true, tail: true, head: true, texture: true, spots: true, skeleton: false };

        // Wave value cache for performance (eliminates ~800 Math.sin() calls per frame)
        this.waveCache = null;
        this.lastWaveTime = -1;
        this.lastNumSegments = -1;
    }

    /**
     * Apply brush texture overlay to enhance sumi-e aesthetic
     * @param {Object} context - p5 graphics context
     * @param {string} textureName - Name of texture to use (body, fin, tail, spot)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width to scale texture
     * @param {number} height - Height to scale texture
     * @param {number} rotation - Rotation angle in radians (default: 0)
     * @param {number} opacity - Opacity of texture overlay 0-1 (default: 0.3)
     */
    applyBrushTexture(context, textureName, x, y, width, height, rotation = 0, opacity = 0.3) {
        if (!this.useSumieStyle) return;

        const texture = this.brushTextures.get(textureName);
        if (!texture) return;

        context.push();
        context.translate(x, y);
        if (rotation !== 0) context.rotate(rotation);

        // Use MULTIPLY blend mode for ink effect
        // Dark values in texture darken the underlying color, white stays transparent
        context.blendMode(context.MULTIPLY);
        context.tint(255, opacity * 255); // Apply opacity to texture
        context.image(texture, -width/2, -height/2, width, height);
        context.noTint(); // Reset tint
        context.blendMode(context.BLEND); // Reset to normal blending

        context.pop();
    }

    /**
     * Render a koi fish to the given graphics context
     * @param {Object} context - p5 graphics context (can be main canvas or graphics buffer)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} angle - Rotation angle in radians
     * @param {Object} params - Rendering parameters
     * @param {Object} params.shapeParams - Shape parameters (defaults to DEFAULT_SHAPE_PARAMS)
     * @param {Object} params.colorParams - Color parameters {h, s, b} in HSB
     * @param {Array} params.pattern - Spot pattern array
     * @param {Object} params.animationParams - Animation parameters
     * @param {number} params.animationParams.waveTime - Time value for swimming wave animation
     * @param {number} params.animationParams.sizeScale - Size multiplier
     * @param {number} params.animationParams.lengthMultiplier - Length multiplier (default: 1)
     * @param {number} params.animationParams.tailLength - Tail length multiplier (default: 1)
     * @param {Object} params.modifiers - Optional visual modifiers
     * @param {number} params.modifiers.brightnessBoost - Brightness boost amount (default: 0)
     * @param {number} params.modifiers.saturationBoost - Saturation boost amount (default: 0)
     * @param {number} params.modifiers.sizeScale - Additional size scaling (default: 1)
     * @param {Object} params.svgVertices - Optional SVG vertices for body parts
     * @param {Array<{x,y}>} params.svgVertices.body - Body vertices
     * @param {Array<{x,y}>} params.svgVertices.tail - Tail vertices
     * @param {Array<{x,y}>} params.svgVertices.head - Head vertices
     * @param {Array<{x,y}>} params.svgVertices.pectoralFin - Pectoral fin vertices
     * @param {Array<{x,y}>} params.svgVertices.dorsalFin - Dorsal fin vertices
     * @param {Array<{x,y}>} params.svgVertices.ventralFin - Ventral fin vertices
     */
    render(context, x, y, angle, params) {
        const {
            shapeParams = DEFAULT_SHAPE_PARAMS,
            colorParams = { h: 0, s: 0, b: 90 },
            pattern = { spots: [] },
            animationParams = { waveTime: 0, sizeScale: 1, lengthMultiplier: 1, tailLength: 1, waveAmplitudeScale: 1 },
            modifiers = { brightnessBoost: 0, saturationBoost: 0, sizeScale: 1 },
            boidSeed = 0,
            svgVertices = {
                body: null,
                tail: null,
                head: null,
                pectoralFin: null,
                dorsalFin: null,
                ventralFin: null
            }
        } = params;

        // Don't draw until the body SVG has loaded. p5's async preload blocks setup on the
        // tracked loadImage calls but NOT on the awaited SVG fetches, so for the first frames
        // after a load svgVertices.body is still null — rendering then would flash the old
        // un-textured procedural koi (the "bad vectors") before the sumi-e outline arrives.
        if (!(svgVertices.body && svgVertices.body.length > 0)) return;

        const { waveTime, sizeScale, lengthMultiplier = 1, tailLength = 1, waveAmplitudeScale = 1, turnRate = 0 } = animationParams;
        const { brightnessBoost = 0, saturationBoost = 0, sizeScale: modifierSizeScale = 1 } = modifiers;

        // Apply modifier size scaling
        const finalSizeScale = sizeScale * modifierSizeScale;
        const curvature = koiCurvature(turnRate); // circular-arc body bend (see koiCurvature)

        // Calculate body segment positions
        const segmentPositions = this.calculateSegments(
            shapeParams.numSegments,
            waveTime,
            finalSizeScale,
            lengthMultiplier,
            shapeParams,
            waveAmplitudeScale,  // Separate wave amplitude scaling from size scaling
            curvature            // Body arc curvature when turning
        );

        // Save graphics state
        context.push();
        context.translate(x, y);
        context.rotate(angle);

        // Set color mode and prepare colors
        context.colorMode(context.HSB || 'HSB', 360, 100, 100);
        const hue = colorParams.h;
        const saturation = Math.min(100, colorParams.s + saturationBoost);
        const brightness = Math.min(100, colorParams.b + brightnessBoost);

        // RENDERING ORDER (for proper z-layering):
        // 1. Pectoral and Ventral fins (drawn first, appear behind body)
        // 2. Tail (drawn second, behind body)
        // 3. Body outline (drawn on top of fins and tail)
        // 4. Head (drawn before spots so spots appear on head)
        // 5. Spots (on top of head)
        // 6. Dorsal fin (drawn last, appears on top of body)

        const show = this.parts;

        if (show.fins) this.drawFins(context, segmentPositions, shapeParams, waveTime, finalSizeScale, hue, saturation, brightness, {
            pectoralFin: svgVertices.pectoralFin,
            dorsalFin: null, // Don't draw dorsal fin yet
            ventralFin: svgVertices.ventralFin
        });
        // The caudal fin is a SEPARATE shape, pinned + rotated at the body-end tangent (drawn
        // BEHIND the body so the wrist tucks under it), so it's a distinct trailing fin rather
        // than a continuation of the body outline. It stays attached because it's placed at the
        // body's actual arc-end point with the body's exit tangent.
        const hasBodySvg = svgVertices.body && Array.isArray(svgVertices.body) && svgVertices.body.length > 0;
        if (show.tail && hasBodySvg) {
            this.drawPinnedTail(context, segmentPositions, finalSizeScale, tailLength, waveTime, waveAmplitudeScale, hue, saturation, brightness);
        }
        if (show.body) {
            if (hasBodySvg) {
                this.drawBodyFromSVG(context, segmentPositions, svgVertices.body, shapeParams, finalSizeScale, hue, saturation, brightness);
            } else {
                this.drawTail(context, segmentPositions, shapeParams, waveTime, finalSizeScale, tailLength, hue, saturation, brightness, svgVertices.tail, waveAmplitudeScale, curvature);
                this.drawBody(context, segmentPositions, shapeParams, finalSizeScale, hue, saturation, brightness);
            }
        }

        if (show.head) {
            // Head angle: the local arc tangent at the head, so the head follows the curve
            // (pinned to the body front) instead of pointing along the base heading.
            const s0 = segmentPositions[0], s1 = segmentPositions[1] || s0;
            const headAngle = Math.atan2((s0.y - s1.y) * finalSizeScale, s0.x - s1.x);
            this.drawHead(context, s0, shapeParams, finalSizeScale, hue, saturation, brightness, svgVertices.head, headAngle);
        }

        // Clip body texture and spots to body+head outline for cleaner appearance
        // Single clipping region shared by both operations (performance optimization)
        if (show.body && (show.texture || show.spots)) {
            this.clipToBodyAndHead(context, segmentPositions, svgVertices, shapeParams, finalSizeScale);
            if (show.texture) this.applyBodyTexture(context, segmentPositions, shapeParams, finalSizeScale, hue, saturation, brightness, svgVertices);
            if (show.spots) this.drawSpots(context, segmentPositions, pattern.spots || [], finalSizeScale, boidSeed, angle, brightness);
            context.drawingContext.restore(); // Remove clip
        }

        // Draw dorsal fin last so it appears on top of the body
        if (show.fins) this.drawFins(context, segmentPositions, shapeParams, waveTime, finalSizeScale, hue, saturation, brightness, {
            pectoralFin: null, // Don't draw pectoral fins again
            dorsalFin: svgVertices.dorsalFin, // Only draw dorsal fin
            ventralFin: null // Don't draw ventral fins again
        });

        // Debug: the deformer skeleton (spine centerline + rib normals) over the fish.
        if (show.skeleton) this.drawSkeleton(context, segmentPositions, finalSizeScale);

        // Restore graphics state
        context.pop();
    }

    /**
     * Draw the caudal fin as a SEPARATE shape, pinned at the body's arc-end point and rotated
     * to the body's exit tangent (with a gentle flap). Because it's placed at the real end
     * point + tangent, it stays attached without being part of the body's deforming outline.
     */
    drawPinnedTail(context, bodySegments, sizeScale, tailLength, waveTime, waveAmplitudeScale, hue, saturation, brightness) {
        const n = bodySegments.length;
        if (n < 2) return;
        const end = bodySegments[n - 1], prev = bodySegments[n - 2];
        const ax = end.x, ay = end.y * sizeScale;                                    // body-end point (drawn px)
        const tangent = Math.atan2((end.y - prev.y) * sizeScale, end.x - prev.x);     // toward the tail (backward)
        const flap = Math.sin(waveTime - ANIMATION_CONFIG.wave.phaseGradient) *
                     ANIMATION_CONFIG.wave.amplitude * waveAmplitudeScale * 0.03;     // gentle stiff-fin flap
        // Forked caudal fan (SVG units), wrist at local origin, lobes extending -x.
        const tailScale = Math.min(1, 0.55 + 0.45 * (tailLength - 0.9) / 0.9);
        const r = 7.5 * tailScale, f = 3.6 * tailScale;
        // Narrow wrist near the body (fine attachment), widening to the forked lobes.
        const fan = [
            { x: r * 0.1,    y: +f * 0.06 },  // wrist — fine point tucked into the body
            { x: -r * 0.5,   y: +f * 0.55 },  // upper, widening
            { x: -r * 0.9,   y: +f },         // upper lobe tip
            { x: -r * 0.7,   y: +f * 0.25 },  // upper inner
            { x: -r * 0.5,   y: 0 },          // center notch (fork)
            { x: -r * 0.7,   y: -f * 0.25 },  // lower inner
            { x: -r * 0.9,   y: -f },         // lower lobe tip
            { x: -r * 0.5,   y: -f * 0.55 },  // lower, widening
            { x: r * 0.1,    y: -f * 0.06 },  // wrist — fine point
        ];
        context.push();
        context.translate(ax, ay);
        context.rotate(tangent - Math.PI + flap); // fan's local -x aligns with the body's exit tangent
        this.drawSVGShape(context, fan, {
            deformationType: 'static', deformationParams: {},
            positionX: 0, positionY: 0, rotation: 0, scale: sizeScale,
            hue, saturation, brightness, opacity: RENDERING_CONFIG.opacity.tail, mirror: 'none'
        });
        context.pop();
    }

    /**
     * Debug overlay: draw the deformer skeleton — the spine centerline that drives the body
     * deformation, plus a rib normal at each joint (so you can see the rib rotation and where
     * the tail's spine diverges). Drawn in the fish's local (translated + rotated) frame; the
     * spine point is (segment.x [px], segment.y·sizeScale [units→px]).
     */
    drawSkeleton(context, segments, sizeScale) {
        if (!segments || segments.length < 2) return;
        context.push();
        context.noFill();
        // spine centerline
        context.stroke(205, 85, 60); context.strokeWeight(2);
        context.beginShape();
        for (const s of segments) context.vertex(s.x, s.y * sizeScale);
        context.endShape();
        // rib normal + joint at each segment
        const n = segments.length;
        for (let i = 0; i < n; i++) {
            const s = segments[i];
            const px = s.x, py = s.y * sizeScale;
            const a = segments[Math.max(0, i - 1)], b = segments[Math.min(n - 1, i + 1)];
            const th = Math.atan2((b.y - a.y) * sizeScale, b.x - a.x);
            const nx = -Math.sin(th), ny = Math.cos(th), L = 12;
            context.stroke(48, 90, 90); context.strokeWeight(1.5);
            context.line(px - nx * L, py - ny * L, px + nx * L, py + ny * L);
            context.stroke(340, 80, 95); context.strokeWeight(5);
            context.point(px, py);
        }
        context.pop();
    }

    /**
     * Calculate body segment positions with swimming wave motion
     */
    calculateSegments(numSegments, waveTime, sizeScale, lengthMultiplier, shapeParams = DEFAULT_SHAPE_PARAMS, waveAmplitudeScale = 1.0, curvature = 0) {
        // Pre-compute wave values once per frame (performance optimization)
        // Eliminates ~800 Math.sin() calls per frame by caching when time changes
        if (waveTime !== this.lastWaveTime || numSegments !== this.lastNumSegments) {
            this.waveCache = [];
            for (let i = 0; i < numSegments; i++) {
                const t = i / numSegments;
                this.waveCache[i] = Math.sin(waveTime - t * ANIMATION_CONFIG.wave.phaseGradient);
            }
            this.lastWaveTime = waveTime;
            this.lastNumSegments = numSegments;
        }

        // The spine curve when turning is a circular arc of `curvature` about the anchor,
        // continued into the tail, so body and tail stay one connected arc.
        const segments = [];

        for (let i = 0; i < numSegments; i++) {
            const t = i / numSegments;
            const x = this.lerp(7, -9, t) * sizeScale * lengthMultiplier;
            // Wave amplitude uses separate scaling to avoid exaggerated motion when rendering at larger sizes
            // Use cached wave value instead of calling Math.sin() (performance optimization)
            const wave = this.waveCache[i] *
                      ANIMATION_CONFIG.wave.amplitude * waveAmplitudeScale *
                      (1 - t * ANIMATION_CONFIG.wave.dampening);
            const y = wave + arcOffset(curvature, x, sizeScale); // swimming wave + circular-arc bend

            // Calculate width based on position using new parameters
            // Create a smooth curve from front to peak to tail
            let baseWidth;

            if (t < shapeParams.bodyPeakPosition) {
                // Front to peak: lerp from front width to peak width
                const frontT = t / shapeParams.bodyPeakPosition;
                baseWidth = this.lerp(shapeParams.bodyFrontWidth, shapeParams.bodyPeakWidth, Math.sin(frontT * Math.PI * 0.5));
            } else {
                // Peak to tail: lerp from peak width back down
                const backT = (t - shapeParams.bodyPeakPosition) / (1 - shapeParams.bodyPeakPosition);
                baseWidth = this.lerp(shapeParams.bodyPeakWidth, shapeParams.bodyFrontWidth, Math.sin(backT * Math.PI * 0.5));
            }

            // Add taper for tail section
            if (t > shapeParams.bodyTaperStart) {
                const tailT = (t - shapeParams.bodyTaperStart) / (1 - shapeParams.bodyTaperStart);
                baseWidth = baseWidth * (1 - tailT * shapeParams.bodyTaperStrength);
            }

            const segmentWidth = baseWidth * sizeScale;
            segments.push({ x, y, w: segmentWidth });
        }

        return segments;
    }

    /**
     * Draw single fin from SVG vertices with rotation/sway animation
     * Helper method for rendering individual fins with 'rotate' deformation
     * @param {Object} context - p5 graphics context
     * @param {Object} segmentPos - Segment position {x, y, w}
     * @param {Array<{x, y}>} svgVertices - Fin SVG vertices
     * @param {number} yOffset - Y offset from segment center
     * @param {number} baseAngle - Base rotation angle in radians
     * @param {number} waveTime - Animation time
     * @param {number} rotationAmplitude - Rotation animation amplitude in radians
     * @param {number} sway - Y sway offset (additional vertical motion)
     * @param {number} sizeScale - Size multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     * @param {string} [mirror='none'] - Mirror type ('none', 'horizontal', 'vertical')
     */
    drawFinFromSVG(context, segmentPos, svgVertices, yOffset, baseAngle, waveTime, rotationAmplitude, sway, sizeScale, hue, saturation, brightness, mirror = 'none') {
        // Guard: Validate SVG vertices
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return; // Cannot draw fin without vertices
        }

        // Calculate pivot at attachment edge (left edge center)
        // This ensures fins rotate naturally from their body connection point
        const xs = svgVertices.map(v => v.x);
        const attachmentPivot = {
            x: Math.min(...xs),  // Left edge X coordinate (closest to body)
            y: 0                 // Center line
        };

        this.drawSVGShape(context, svgVertices, {
            deformationType: 'rotate',
            deformationParams: {
                waveTime,
                rotationAmplitude,
                rotationFrequency: 1.2, // Matches procedural: waveTime * 1.2
                pivot: attachmentPivot, // Rotate around attachment edge
                ySwayAmplitude: 0, // Y sway applied via positionY instead
                ySwayPhase: 0
            },
            positionX: segmentPos.x,
            positionY: segmentPos.y * sizeScale + yOffset * sizeScale + sway, // segment.y is SVG units → ×sizeScale so the fin follows the arc
            rotation: baseAngle, // Base angle applied to entire shape
            scale: sizeScale,
            hue,
            saturation: saturation + 8,
            brightness: brightness - 15,
            opacity: RENDERING_CONFIG.opacity.fins,
            mirror
        });
    }

    /**
     * Draw all fins (dorsal, pectoral, ventral)
     * Rendered FIRST so they appear behind the body
     * Uses SVG if vertices provided, otherwise uses procedural rendering
     * @param {Object} context - p5 graphics context
     * @param {Array<{x, y, w}>} segmentPositions - Body segment positions
     * @param {Object} shapeParams - Shape parameters
     * @param {number} waveTime - Animation time
     * @param {number} sizeScale - Size multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     * @param {Object} [svgVertices={}] - SVG vertices for fins
     * @param {Array<{x,y}>} [svgVertices.pectoralFin] - Pectoral fin vertices
     * @param {Array<{x,y}>} [svgVertices.dorsalFin] - Dorsal fin vertices
     * @param {Array<{x,y}>} [svgVertices.ventralFin] - Ventral fin vertices
     */
    drawFins(context, segmentPositions, shapeParams, waveTime, sizeScale, hue, saturation, brightness, svgVertices = {}) {
        // Guard: Validate segment positions
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot draw fins without segments
        }

        // Check if we should use SVG rendering for any fins
        const useSVG = svgVertices.pectoralFin || svgVertices.dorsalFin || svgVertices.ventralFin;

        if (useSVG) {
            // SVG-based fin rendering
            const finSway = Math.sin(waveTime - 0.5) * ANIMATION_CONFIG.fins.pectoral.swayAmplitude;

            // Pectoral fins (left and right)
            const finPos = segmentPositions[shapeParams.pectoralPos];
            if (!finPos) return; // Guard: ensure pectoral position segment exists

            if (svgVertices.pectoralFin) {
                // Top pectoral fin (left)
                this.drawFinFromSVG(
                    context, finPos, svgVertices.pectoralFin,
                    shapeParams.pectoralYTop,
                    shapeParams.pectoralAngleTop,
                    waveTime,
                    ANIMATION_CONFIG.fins.pectoral.rotationAmplitude,
                    finSway,
                    sizeScale,
                    hue, saturation, brightness,
                    'none'
                );

                // Bottom pectoral fin (right) - mirrored vertically
                this.drawFinFromSVG(
                    context, finPos, svgVertices.pectoralFin,
                    shapeParams.pectoralYBottom,
                    shapeParams.pectoralAngleBottom,
                    waveTime,
                    -ANIMATION_CONFIG.fins.pectoral.rotationAmplitude, // Negative for opposite rotation
                    -finSway, // Opposite sway
                    sizeScale,
                    hue, saturation, brightness,
                    'vertical' // Mirror vertically for bottom fin
                );
            }

            // Dorsal fin - uses wave deformation to follow body undulation
            if (svgVertices.dorsalFin) {
                // Create mini body segments for dorsal fin to follow body wave
                // Apply dampening to make the wave more subtle on the fin
                const dorsalSegments = [];
                const dorsalStartIdx = Math.max(0, shapeParams.dorsalPos - 1);
                const dorsalEndIdx = Math.min(segmentPositions.length - 1, shapeParams.dorsalPos + 2);

                for (let i = dorsalStartIdx; i <= dorsalEndIdx; i++) {
                    // Dampen the Y offset for a more subtle wave
                    dorsalSegments.push({
                        x: segmentPositions[i].x,
                        y: segmentPositions[i].y * ANIMATION_CONFIG.wave.dorsalDampening,
                        w: segmentPositions[i].w
                    });
                }

                this.drawSVGShape(context, svgVertices.dorsalFin, {
                    deformationType: 'wave',
                    deformationParams: {
                        segmentPositions: dorsalSegments,
                        numSegments: dorsalSegments.length
                    },
                    positionX: segmentPositions[shapeParams.dorsalPos].x,
                    positionY: segmentPositions[shapeParams.dorsalPos].y * sizeScale + shapeParams.dorsalY * sizeScale, // ×sizeScale: segment.y is SVG units
                    rotation: 0,
                    scale: sizeScale,
                    hue,
                    saturation: saturation + 8,
                    brightness: brightness - 15,
                    opacity: RENDERING_CONFIG.opacity.fins,
                    mirror: 'none'
                });
            }

            // Ventral fins (top and bottom)
            const ventralPos = segmentPositions[shapeParams.ventralPos];
            if (!ventralPos) return; // Guard: ensure ventral position segment exists

            if (svgVertices.ventralFin) {
                // Top ventral fin
                this.drawFinFromSVG(
                    context, ventralPos, svgVertices.ventralFin,
                    shapeParams.ventralYTop,
                    shapeParams.ventralAngleTop,
                    waveTime,
                    ANIMATION_CONFIG.fins.ventral.rotationAmplitude,
                    0, // No sway
                    sizeScale,
                    hue, saturation, brightness,
                    'none'
                );

                // Bottom ventral fin - mirrored vertically
                this.drawFinFromSVG(
                    context, ventralPos, svgVertices.ventralFin,
                    shapeParams.ventralYBottom,
                    shapeParams.ventralAngleBottom,
                    waveTime,
                    -ANIMATION_CONFIG.fins.ventral.rotationAmplitude, // Opposite rotation
                    0,
                    sizeScale,
                    hue, saturation, brightness,
                    'vertical' // Mirror vertically for bottom fin
                );
            }

            return; // Exit early - SVG rendering complete
        }

        // PROCEDURAL FIN RENDERING (fallback)
        const finSway = Math.sin(waveTime + PROCEDURAL_RENDERING.fins.SWAY_PHASE_OFFSET) * PROCEDURAL_RENDERING.fins.SWAY_AMPLITUDE;
        const finOpacity = this.useSumieStyle ? PROCEDURAL_RENDERING.fins.OPACITY_SUMIE : PROCEDURAL_RENDERING.fins.OPACITY_NORMAL;
        const layers = this.useSumieStyle ? 2 : 1; // Lighter layering for fins

        // Pectoral fins (left and right)
        const finPos = segmentPositions[shapeParams.pectoralPos];
        if (!finPos) return; // Guard: ensure pectoral position segment exists

        // Top pectoral fin (left)
        for (let layer = 0; layer < layers; layer++) {
            const offset = this.useSumieStyle ? (layer - 0.5) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_FIN : 0;
            const opacity = this.useSumieStyle ? (layer === 0 ? PROCEDURAL_RENDERING.sumie.OPACITY_FIN_PRIMARY : PROCEDURAL_RENDERING.sumie.OPACITY_FIN_SECONDARY) : finOpacity;

            context.fill(hue, saturation + PROCEDURAL_RENDERING.fins.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.fins.BRIGHTNESS_OFFSET, opacity);
            context.push();
            context.translate(finPos.x, finPos.y + shapeParams.pectoralYTop * sizeScale + finSway);
            context.rotate(shapeParams.pectoralAngleTop + Math.sin(waveTime * PROCEDURAL_RENDERING.fins.ROTATION_FREQUENCY) * PROCEDURAL_RENDERING.fins.pectoral.ROTATION_AMPLITUDE);
            context.ellipse(PROCEDURAL_RENDERING.fins.pectoral.CENTER_OFFSET * sizeScale + offset, 0, PROCEDURAL_RENDERING.fins.pectoral.WIDTH * sizeScale, PROCEDURAL_RENDERING.fins.pectoral.HEIGHT * sizeScale);
            context.pop();
        }

        // Bottom pectoral fin (right)
        for (let layer = 0; layer < layers; layer++) {
            const offset = this.useSumieStyle ? (layer - 0.5) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_FIN : 0;
            const opacity = this.useSumieStyle ? (layer === 0 ? PROCEDURAL_RENDERING.sumie.OPACITY_FIN_PRIMARY : PROCEDURAL_RENDERING.sumie.OPACITY_FIN_SECONDARY) : finOpacity;

            context.fill(hue, saturation + PROCEDURAL_RENDERING.fins.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.fins.BRIGHTNESS_OFFSET, opacity);
            context.push();
            context.translate(finPos.x, finPos.y + shapeParams.pectoralYBottom * sizeScale - finSway);
            context.rotate(shapeParams.pectoralAngleBottom - Math.sin(waveTime * PROCEDURAL_RENDERING.fins.ROTATION_FREQUENCY) * PROCEDURAL_RENDERING.fins.pectoral.ROTATION_AMPLITUDE);
            context.ellipse(PROCEDURAL_RENDERING.fins.pectoral.CENTER_OFFSET * sizeScale + offset, 0, PROCEDURAL_RENDERING.fins.pectoral.WIDTH * sizeScale, PROCEDURAL_RENDERING.fins.pectoral.HEIGHT * sizeScale);
            context.pop();
        }

        // Dorsal fin
        const dorsalPos = segmentPositions[shapeParams.dorsalPos];
        if (!dorsalPos) return; // Guard: ensure dorsal position segment exists

        for (let layer = 0; layer < layers; layer++) {
            const offset = this.useSumieStyle ? (layer - 0.5) * PROCEDURAL_RENDERING.fins.dorsal.LAYER_OFFSET : 0;
            const opacity = this.useSumieStyle ? (layer === 0 ? PROCEDURAL_RENDERING.fins.dorsal.OPACITY_PRIMARY : PROCEDURAL_RENDERING.fins.dorsal.OPACITY_SECONDARY) : PROCEDURAL_RENDERING.fins.dorsal.OPACITY_NORMAL;

            context.fill(hue, saturation + PROCEDURAL_RENDERING.fins.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.fins.BRIGHTNESS_OFFSET, opacity);
            context.push();
            context.translate(dorsalPos.x, dorsalPos.y + shapeParams.dorsalY * sizeScale);
            context.rotate(PROCEDURAL_RENDERING.fins.dorsal.ROTATION_ANGLE);
            context.beginShape();
            context.vertex(PROCEDURAL_RENDERING.fins.dorsal.VERTEX_Y_BASE, offset);
            context.vertex(PROCEDURAL_RENDERING.fins.dorsal.VERTEX_X_LEFT * sizeScale, PROCEDURAL_RENDERING.fins.dorsal.VERTEX_Y_TIP_1 * sizeScale + offset);
            context.vertex(PROCEDURAL_RENDERING.fins.dorsal.VERTEX_X_MID * sizeScale, PROCEDURAL_RENDERING.fins.dorsal.VERTEX_Y_TIP_2 * sizeScale + offset);
            context.vertex(PROCEDURAL_RENDERING.fins.dorsal.VERTEX_X_RIGHT * sizeScale, PROCEDURAL_RENDERING.fins.dorsal.VERTEX_Y_TIP_3 * sizeScale + offset);
            context.vertex(PROCEDURAL_RENDERING.fins.dorsal.VERTEX_X_RIGHT * sizeScale, offset);
            context.endShape(context.CLOSE);
            context.pop();
        }

        // Ventral fins (top and bottom)
        const ventralPos = segmentPositions[shapeParams.ventralPos];
        if (!ventralPos) return; // Guard: ensure ventral position segment exists

        // Top ventral fin
        for (let layer = 0; layer < layers; layer++) {
            const offset = this.useSumieStyle ? (layer - 0.5) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_FIN : 0;
            const opacity = this.useSumieStyle ? (layer === 0 ? PROCEDURAL_RENDERING.sumie.OPACITY_FIN_PRIMARY : PROCEDURAL_RENDERING.sumie.OPACITY_FIN_SECONDARY) : finOpacity;

            context.fill(hue, saturation + PROCEDURAL_RENDERING.fins.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.fins.BRIGHTNESS_OFFSET, opacity);
            context.push();
            context.translate(ventralPos.x, ventralPos.y + shapeParams.ventralYTop * sizeScale);
            context.rotate(shapeParams.ventralAngleTop + Math.sin(waveTime * PROCEDURAL_RENDERING.fins.ROTATION_FREQUENCY) * PROCEDURAL_RENDERING.fins.ventral.ROTATION_AMPLITUDE);
            context.ellipse(PROCEDURAL_RENDERING.fins.ventral.CENTER_OFFSET * sizeScale + offset, 0, PROCEDURAL_RENDERING.fins.ventral.WIDTH * sizeScale, PROCEDURAL_RENDERING.fins.ventral.HEIGHT * sizeScale);
            context.pop();
        }

        // Bottom ventral fin
        for (let layer = 0; layer < layers; layer++) {
            const offset = this.useSumieStyle ? (layer - 0.5) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_FIN : 0;
            const opacity = this.useSumieStyle ? (layer === 0 ? PROCEDURAL_RENDERING.sumie.OPACITY_FIN_PRIMARY : PROCEDURAL_RENDERING.sumie.OPACITY_FIN_SECONDARY) : finOpacity;

            context.fill(hue, saturation + PROCEDURAL_RENDERING.fins.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.fins.BRIGHTNESS_OFFSET, opacity);
            context.push();
            context.translate(ventralPos.x, ventralPos.y + shapeParams.ventralYBottom * sizeScale);
            context.rotate(shapeParams.ventralAngleBottom - Math.sin(waveTime * PROCEDURAL_RENDERING.fins.ROTATION_FREQUENCY) * PROCEDURAL_RENDERING.fins.ventral.ROTATION_AMPLITUDE);
            context.ellipse(PROCEDURAL_RENDERING.fins.ventral.CENTER_OFFSET * sizeScale + offset, 0, PROCEDURAL_RENDERING.fins.ventral.WIDTH * sizeScale, PROCEDURAL_RENDERING.fins.ventral.HEIGHT * sizeScale);
            context.pop();
        }
    }

    /**
     * Draw tail from SVG vertices with flutter animation
     * Uses generalized drawSVGShape with flutter deformation matching procedural tail
     * @param {Object} context - p5 graphics context
     * @param {Array<{x, y, w}>} segmentPositions - Body segment positions
     * @param {Array<{x, y}>} svgVertices - Tail SVG vertices
     * @param {Object} shapeParams - Shape parameters
     * @param {number} waveTime - Animation time
     * @param {number} sizeScale - Size multiplier
     * @param {number} tailLength - Tail length multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     */
    drawTailFromSVG(context, segmentPositions, svgVertices, shapeParams, waveTime, sizeScale, tailLength, hue, saturation, brightness, waveAmplitudeScale = 1.0, bend = 0) {
        // Guard: Validate inputs
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return; // Cannot draw tail without vertices
        }
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot position tail without segments
        }

        const tailBase = segmentPositions[segmentPositions.length - 1];
        if (!tailBase) return; // Guard: ensure tail base segment exists
        const tailStartX = tailBase.x + shapeParams.tailStartX * sizeScale;

        const tailXCoords = svgVertices.map(v => v.x);
        const tailRightEdge = Math.max(...tailXCoords);
        const tailConnectionX = tailStartX - (tailRightEdge * sizeScale * tailLength);

        // Create extended segments for tail (continues body wave motion)
        // Tail extends beyond body segments, continuing the wave pattern
        const numTailSegments = ANIMATION_CONFIG.tail.segments;
        const tailSegments = [];
        const bodySegmentCount = segmentPositions.length;

        for (let i = 0; i < numTailSegments; i++) {
            const t = i / numTailSegments;
            const x = tailStartX - (t * tailLength * PROCEDURAL_RENDERING.tail.LENGTH_MULTIPLIER * sizeScale);
            // Continue the wave formula from body
            // But adjust t to continue from where body left off
            const waveT = 1 + (t * PROCEDURAL_RENDERING.tail.WAVE_CONTINUATION); // Continue wave beyond body end (t=1)
            const wave = Math.sin(waveTime - waveT * ANIMATION_CONFIG.wave.phaseGradient) *
                      ANIMATION_CONFIG.wave.amplitude * waveAmplitudeScale *
                      (1 - waveT * ANIMATION_CONFIG.wave.dampening);
            // The body's bend at the join is `bend` (t=1). The tail runs past t=1 (waveT up
            // to ~2), so continuing the parabola would fling the tail tip out ~4×. Instead
            // hold near the join value with a gentle continuation, /tailLength for the scale.
            const tailBend = bend * (1 + 0.3 * (waveT - 1));
            const y = (wave + tailBend) / tailLength;
            tailSegments.push({ x, y, w: 0 });
        }

        this.drawSVGShape(context, svgVertices, {
            deformationType: 'wave',
            deformationParams: {
                segmentPositions: tailSegments,
                numSegments: numTailSegments
            },
            positionX: tailConnectionX,  // Position tail by its connection edge
            positionY: 0,  // Wave already applied via deformation, don't double-apply
            rotation: 0,
            scale: sizeScale * tailLength,
            hue,
            saturation: saturation + PROCEDURAL_RENDERING.tail.SATURATION_BOOST,
            brightness: brightness + PROCEDURAL_RENDERING.tail.BRIGHTNESS_OFFSET,
            opacity: RENDERING_CONFIG.opacity.tail,
            mirror: 'none'
        });
    }

    /**
     * Draw tail with flowing motion
     * Uses SVG if vertices provided, otherwise uses procedural rendering
     */
    drawTail(context, segmentPositions, shapeParams, waveTime, sizeScale, tailLength, hue, saturation, brightness, svgVertices = null, waveAmplitudeScale = 1.0, bend = 0) {
        // Guard: Validate segment positions
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot draw tail without segments
        }

        // Use SVG if provided, otherwise procedural
        if (svgVertices && Array.isArray(svgVertices) && svgVertices.length > 0) {
            this.drawTailFromSVG(context, segmentPositions, svgVertices, shapeParams, waveTime, sizeScale, tailLength, hue, saturation, brightness, waveAmplitudeScale, bend);
            return;
        }

        // Original procedural tail rendering code
        const tailBase = segmentPositions[segmentPositions.length - 1];
        const tailStartX = tailBase.x + shapeParams.tailStartX * sizeScale;
        const tailSegments = PROCEDURAL_RENDERING.tail.LENGTH_MULTIPLIER;
        const tailLengthScaled = tailLength * PROCEDURAL_RENDERING.tail.LENGTH_MULTIPLIER * sizeScale;

        // Calculate tail points
        const topPoints = [];
        const bottomPoints = [];

        for (let i = 0; i <= tailSegments; i++) {
            const t = i / tailSegments;
            const x = tailStartX - (t * tailLengthScaled);
            const tailSway = Math.sin(waveTime + PROCEDURAL_RENDERING.tail.SWAY_PHASE_OFFSET + t * PROCEDURAL_RENDERING.tail.SWAY_PHASE_GRADIENT) *
                           PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE * sizeScale *
                           (PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE_START + t * PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE_END);
            const width = this.lerp(shapeParams.tailWidthStart, shapeParams.tailWidthEnd, t) * sizeScale;

            topPoints.push({ x, y: tailBase.y - width + tailSway });
            bottomPoints.push({ x, y: tailBase.y + width + tailSway });
        }

        // For sumi-e style, draw multiple layers for soft edges
        if (this.useSumieStyle) {
            for (let layer = 0; layer < 3; layer++) {
                const offset = (layer - 1) * PROCEDURAL_RENDERING.tail.LAYER_OFFSET;
                const opacity = layer === 1 ? PROCEDURAL_RENDERING.tail.OPACITY_PRIMARY : PROCEDURAL_RENDERING.tail.OPACITY_SECONDARY;

                context.fill(hue, saturation + PROCEDURAL_RENDERING.tail.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.tail.BRIGHTNESS_OFFSET, opacity);
                context.beginShape();

                // Draw tail shape with curve vertices and offset
                context.curveVertex(topPoints[0].x, topPoints[0].y + offset);
                for (let pt of topPoints) {
                    context.curveVertex(pt.x, pt.y + offset);
                }
                for (let i = bottomPoints.length - 1; i >= 0; i--) {
                    context.curveVertex(bottomPoints[i].x, bottomPoints[i].y + offset);
                }
                context.curveVertex(bottomPoints[0].x, bottomPoints[0].y + offset);

                context.endShape(context.CLOSE);
            }
            return;
        }

        // Normal rendering (non-sumi-e)
        context.fill(hue, saturation + PROCEDURAL_RENDERING.tail.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.tail.BRIGHTNESS_OFFSET, 1.0);
        context.beginShape();

        context.curveVertex(topPoints[0].x, topPoints[0].y);
        for (let pt of topPoints) {
            context.curveVertex(pt.x, pt.y);
        }
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
            context.curveVertex(bottomPoints[i].x, bottomPoints[i].y);
        }
        context.curveVertex(bottomPoints[0].x, bottomPoints[0].y);

        context.endShape(context.CLOSE);
    }

    /**
     * Apply wave deformation to SVG vertices (body wave)
     * Maps each vertex to a body segment and applies the segment's wave offset
     * Uses linear interpolation between segments for smooth deformation
     * @param {Array<{x, y}>} vertices - Original SVG vertices
     * @param {Object} params - Deformation parameters
     * @param {Array<{x, y, w}>} params.segmentPositions - Body segments with wave offsets
     * @param {number} params.numSegments - Number of body segments
     * @returns {Array<{x, y}>} - Deformed vertices
     */
    applyWaveDeformation(vertices, params) {
        // Guard: Validate inputs
        if (!vertices || !Array.isArray(vertices) || vertices.length === 0) {
            return vertices || []; // Return empty array if null/undefined
        }
        if (!params || !params.segmentPositions || !Array.isArray(params.segmentPositions) || params.segmentPositions.length === 0) {
            return vertices; // No deformation possible, return original
        }

        const { segmentPositions, numSegments, sizeScale } = params;

        // Calculate X bounds once for all vertices (optimized - no intermediate array)
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < vertices.length; i++) {
            if (!vertices[i]) continue; // Skip null vertices
            if (vertices[i].x < minX) minX = vertices[i].x;
            if (vertices[i].x > maxX) maxX = vertices[i].x;
        }
        const range = maxX - minX;

        // PERFORMANCE OPTIMIZATION: Pre-allocate output array, loop-based vertex creation
        // Avoids Array.map() overhead while creating new vertex objects
        // ~50% faster than map() due to avoiding function call overhead per vertex
        const result = new Array(vertices.length);

        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];

            // Guard: Skip null vertices
            if (!v || v.x === undefined || v.y === undefined) {
                result[i] = v || { x: 0, y: 0 };
                continue;
            }

            // Normalize vertex X to 0-1 range, flipped so rightmost = 0, leftmost = 1
            const flippedT = range === 0 ? 0 : (maxX - v.x) / range;

            // Map to segment range with interpolation
            const segmentFloat = flippedT * (numSegments - 1);
            const segIdx = Math.floor(segmentFloat);
            const blend = segmentFloat - segIdx; // Fractional part for interpolation

            // Clamp indices to valid range
            const currentIdx = Math.max(0, Math.min(segIdx, numSegments - 1));
            const nextIdx = Math.min(currentIdx + 1, numSegments - 1);

            // Get Y offsets from current and next segment
            const currentY = segmentPositions[currentIdx].y;
            const nextY = segmentPositions[nextIdx].y;

            // Linear interpolation between segments
            const interpolatedY = currentY + (nextY - currentY) * blend;

            if (sizeScale) {
                // Rib rotation (normal-ribbon bend): rotate the vertex's perpendicular offset
                // (v.y) to follow the spine's tangent instead of only shifting it up. Otherwise
                // the outline SHEARS where the spine is steep — which is exactly the tail, so
                // the tail looked disproportionately distorted vs the barely-sloped body. The
                // spine point stays at (v.x, interpolatedY); the rib is placed along its normal.
                const iA = Math.max(0, currentIdx - 1);
                const iB = Math.min(numSegments - 1, currentIdx + 1);
                const dX = segmentPositions[iB].x - segmentPositions[iA].x;            // px
                const dY = (segmentPositions[iB].y - segmentPositions[iA].y) * sizeScale; // units→px
                const theta = Math.atan2(dY, dX);                                     // spine tangent
                result[i] = { x: v.x - v.y * Math.sin(theta), y: interpolatedY + v.y * Math.cos(theta) };
            } else {
                result[i] = { x: v.x, y: v.y + interpolatedY };
            }
        }

        return result;
    }

    /**
     * Apply flutter deformation to SVG vertices (tail flutter)
     * Creates a traveling wave effect from base to tip with increasing amplitude
     * Matches procedural tail flutter: Math.sin(waveTime - 2.5 - t * 2) * 3 * sizeScale * (0.5 + t * 0.5)
     * @param {Array<{x, y}>} vertices - Original SVG vertices
     * @param {Object} params - Flutter parameters
     * @param {number} params.waveTime - Animation time
     * @param {number} params.sizeScale - Size multiplier
     * @param {number} [params.phaseOffset] - Phase offset for wave (default from PROCEDURAL_RENDERING.tail)
     * @param {number} [params.phaseGradient] - Phase change per unit distance (default from PROCEDURAL_RENDERING.tail)
     * @param {number} [params.amplitudeStart] - Flutter amplitude at base (default from PROCEDURAL_RENDERING.tail)
     * @param {number} [params.amplitudeEnd] - Flutter amplitude at tip (default from PROCEDURAL_RENDERING.tail)
     * @param {number} [params.amplitudeScale] - Overall amplitude scaling (default from PROCEDURAL_RENDERING.tail)
     * @returns {Array<{x, y}>} - Deformed vertices
     */
    applyFlutterDeformation(vertices, params) {
        // Guard: Validate inputs
        if (!vertices || !Array.isArray(vertices) || vertices.length === 0) {
            return vertices || [];
        }
        if (!params) {
            return vertices;
        }

        const {
            waveTime,
            sizeScale,
            phaseOffset = PROCEDURAL_RENDERING.tail.SWAY_PHASE_OFFSET,
            phaseGradient = PROCEDURAL_RENDERING.tail.SWAY_PHASE_GRADIENT,
            amplitudeStart = PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE_START,
            amplitudeEnd = PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE_END,
            amplitudeScale = PROCEDURAL_RENDERING.tail.SWAY_AMPLITUDE
        } = params;

        // Find X bounds for normalization (0 to 1 from base to tip) - optimized
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < vertices.length; i++) {
            if (!vertices[i]) continue; // Skip null vertices
            if (vertices[i].x < minX) minX = vertices[i].x;
            if (vertices[i].x > maxX) maxX = vertices[i].x;
        }
        const rangeX = maxX - minX;

        if (rangeX === 0) return vertices; // Prevent division by zero

        // PERFORMANCE OPTIMIZATION: Pre-allocate output array, loop-based vertex creation
        // Avoids Array.map() overhead while creating new vertex objects
        // ~50% faster than map() due to avoiding function call overhead per vertex
        const result = new Array(vertices.length);

        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];

            // Guard: Skip null vertices
            if (!v || v.x === undefined || v.y === undefined) {
                result[i] = v || { x: 0, y: 0 };
                continue;
            }

            const t = (v.x - minX) / rangeX; // 0 at base, 1 at tip

            // Phase increases toward tip (creates traveling wave)
            const phase = waveTime + phaseOffset + (t * phaseGradient);

            // Amplitude increases toward tip
            const amplitude = amplitudeStart + (t * (amplitudeEnd - amplitudeStart));

            // Flutter offset
            const flutter = Math.sin(phase) * amplitudeScale * sizeScale * amplitude;

            // Create new vertex object with deformed Y coordinate
            result[i] = {
                x: v.x,
                y: v.y + flutter
            };
        }

        return result;
    }

    /**
     * Apply rotation deformation to SVG vertices (fin rotation/sway)
     * Rotates vertices around a pivot point with optional Y sway
     * Matches procedural fin animation formulas
     * @param {Array<{x, y}>} vertices - Original SVG vertices
     * @param {Object} params - Rotation parameters
     * @param {number} params.waveTime - Animation time
     * @param {number} [params.rotationAmplitude=0] - Rotation amplitude in radians
     * @param {number} [params.rotationFrequency] - Rotation frequency multiplier (default from PROCEDURAL_RENDERING.fins)
     * @param {Object} [params.pivot={x:0,y:0}] - Rotation pivot point
     * @param {number} [params.ySwayAmplitude=0] - Y sway amplitude (optional)
     * @param {number} [params.ySwayPhase] - Y sway phase offset (default from PROCEDURAL_RENDERING.fins)
     * @returns {Array<{x, y}>} - Deformed vertices
     */
    applyRotationDeformation(vertices, params) {
        // Guard: Validate inputs
        if (!vertices || !Array.isArray(vertices) || vertices.length === 0) {
            return vertices || [];
        }
        if (!params) {
            return vertices;
        }

        const {
            waveTime,
            rotationAmplitude = 0,
            rotationFrequency = PROCEDURAL_RENDERING.fins.ROTATION_FREQUENCY,
            pivot = { x: 0, y: 0 },
            ySwayAmplitude = 0,
            ySwayPhase = PROCEDURAL_RENDERING.fins.SWAY_PHASE_OFFSET
        } = params;

        const rotationAngle = Math.sin(waveTime * rotationFrequency) * rotationAmplitude;
        const ySway = ySwayAmplitude ? Math.sin(waveTime + ySwayPhase) * ySwayAmplitude : 0;

        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);

        // PERFORMANCE OPTIMIZATION: Pre-allocate output array, loop-based vertex creation
        // Avoids Array.map() overhead while creating new vertex objects
        // ~50% faster than map() due to avoiding function call overhead per vertex
        const result = new Array(vertices.length);

        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];

            // Guard: Skip null vertices
            if (!v || v.x === undefined || v.y === undefined) {
                result[i] = v || { x: 0, y: 0 };
                continue;
            }

            const dx = v.x - pivot.x;
            const dy = v.y - pivot.y;

            const rotatedX = dx * cos - dy * sin;
            const rotatedY = dx * sin + dy * cos;

            // Create new vertex object with rotated coordinates
            result[i] = {
                x: rotatedX + pivot.x,
                y: rotatedY + pivot.y + ySway
            };
        }

        return result;
    }

    /**
     * Apply general deformation to vertices based on type
     * Dispatcher method that routes to specific deformation implementations
     * @param {Array<{x, y}>} vertices - Original vertices
     * @param {string} type - Deformation type ('wave', 'flutter', 'rotate', 'static')
     * @param {Object} params - Type-specific parameters
     * @returns {Array<{x, y}>} - Deformed vertices
     */
    applyDeformation(vertices, type, params) {
        switch (type) {
            case 'wave':
                return this.applyWaveDeformation(vertices, params);
            case 'flutter':
                return this.applyFlutterDeformation(vertices, params);
            case 'rotate':
                return this.applyRotationDeformation(vertices, params);
            case 'static':
                return vertices; // No deformation
            default:
                console.warn(`Unknown deformation type: ${type}`);
                return vertices;
        }
    }

    /**
     * Apply mirror transformation to vertices
     * Used for flipping fins and other symmetric body parts
     * @param {Array<{x, y}>} vertices - Original vertices
     * @param {string} mirror - Mirror type ('none', 'horizontal', 'vertical')
     * @returns {Array<{x, y}>} - Mirrored vertices
     */
    applyMirror(vertices, mirror) {
        if (mirror === 'none') return vertices;

        return vertices.map(v => ({
            x: mirror === 'horizontal' ? -v.x : v.x,
            y: mirror === 'vertical' ? -v.y : v.y
        }));
    }

    /**
     * Map vertex X coordinate to body segment index
     * SVG vertices span from negative X (tail) to positive X (head)
     * Body segments span from 0 (head/front) to numSegments-1 (tail/back)
     * @param {number} vertexX - X coordinate of SVG vertex
     * @param {Array<{x, y}>} svgVertices - All SVG vertices for bounds calculation
     * @param {number} numSegments - Number of body segments
     * @returns {number} - Segment index (0 to numSegments-1)
     */
    mapVertexToSegment(vertexX, svgVertices, numSegments) {
        // Guard: Validate inputs
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return 0;
        }

        // Find X bounds of SVG vertices (optimized - no intermediate array)
        let minX = Infinity;
        let maxX = -Infinity;
        for (let i = 0; i < svgVertices.length; i++) {
            if (!svgVertices[i]) continue; // Skip null vertices
            if (svgVertices[i].x < minX) minX = svgVertices[i].x;
            if (svgVertices[i].x > maxX) maxX = svgVertices[i].x;
        }

        // Normalize vertex X to 0-1 range
        // For koi body: positive X = head/front, negative X = tail/back
        const t = (vertexX - minX) / (maxX - minX);

        // IMPORTANT: Flip t because SVG has head at positive X, but segments[0] is head
        // Segment 0 should be at maxX (head), segment numSegments-1 at minX (tail)
        const flippedT = 1 - t;

        // Map to segment index
        const segmentIndex = Math.floor(flippedT * numSegments);

        // Clamp to valid range
        return Math.min(Math.max(0, segmentIndex), numSegments - 1);
    }

    /**
     * Draw SVG shape with deformation, transform, and sumi-e layering
     * Generalized method for rendering any SVG body part with animation
     * @param {Object} context - p5 graphics context
     * @param {Array<{x, y}>} svgVertices - Original SVG vertices
     * @param {Object} config - Rendering configuration
     * @param {string} [config.deformationType='static'] - Type of deformation ('wave', 'flutter', 'rotate', 'static')
     * @param {Object} [config.deformationParams={}] - Parameters for deformation
     * @param {number} [config.positionX=0] - X position in canvas space
     * @param {number} [config.positionY=0] - Y position in canvas space
     * @param {number} [config.rotation=0] - Rotation angle in radians
     * @param {number} [config.scale=1] - Scale multiplier
     * @param {number} config.hue - HSB hue
     * @param {number} config.saturation - HSB saturation
     * @param {number} config.brightness - HSB brightness
     * @param {number} [config.opacity=0.8] - Base opacity (0-1)
     * @param {string} [config.mirror='none'] - Mirror type ('none', 'horizontal', 'vertical')
     */
    drawSVGShape(context, svgVertices, config) {
        if (!svgVertices || svgVertices.length === 0) {
            console.warn('drawSVGShape: No vertices provided');
            return;
        }

        const {
            deformationType = 'static',
            deformationParams = {},
            positionX = 0,
            positionY = 0,
            rotation = 0,
            scale = 1,
            hue,
            saturation,
            brightness,
            opacity = 1.0,
            mirror = 'none'
        } = config;

        // 1. Apply deformation
        let vertices = this.applyDeformation(svgVertices, deformationType, deformationParams);

        // 2. Apply mirror
        vertices = this.applyMirror(vertices, mirror);

        // 3. Render with transform and sumi-e layers
        context.push();
        context.translate(positionX, positionY);
        context.rotate(rotation);
        context.noStroke(); // Remove stroke for clean SVG rendering

        if (this.useSumieStyle) {
            // 3-layer rendering for soft edges
            for (let layer = 0; layer < 3; layer++) {
                const offset = (layer - 1) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_SVG;
                const layerOpacity = layer === 1 ? opacity : opacity * PROCEDURAL_RENDERING.sumie.OPACITY_SVG_SECONDARY;

                context.fill(hue, saturation, brightness, layerOpacity);
                context.beginShape();

                for (let v of vertices) {
                    context.curveVertex(v.x * scale + offset, v.y * scale + offset);
                }

                context.endShape(context.CLOSE);
            }
        } else {
            // Normal rendering
            context.fill(hue, saturation, brightness, opacity);
            context.beginShape();

            for (let v of vertices) {
                context.curveVertex(v.x * scale, v.y * scale);
            }

            context.endShape(context.CLOSE);
        }

        context.pop();
    }

    /**
     * Draw body from SVG vertices with wave deformation
     * Refactored to use generalized drawSVGShape method
     * @param {Object} context - p5 graphics context
     * @param {Array<{x, y, w}>} segmentPositions - Body segment positions with wave offsets
     * @param {Array<{x, y}>} svgVertices - SVG vertices normalized to koi coordinate space
     * @param {Object} shapeParams - Shape parameters
     * @param {number} sizeScale - Size multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     */
    /**
     * Extend the body into a tail so it's ONE shape over ONE bent centerline (can't
     * detach). Continues the body's segments (same wave + circular-arc bend, t running past 1)
     * and splices a tail fan into the body's vertex loop at its tail-end (leftmost) edge.
     * @returns {{ verts: Array<{x,y}>, segments: Array<{x,y,w}> }}
     */
    extendBodyWithTail(bodyVerts, bodySegments, sizeScale, lengthMultiplier, waveTime, waveAmplitudeScale, curvature, tailLength = 1.2) {
        const numSeg = bodySegments.length;
        const numTail = 7;
        const segments = bodySegments.slice();
        // The caudal fin is STIFF: rather than continuing the body's arc (which over-curls and
        // flings the tail), it trails STRAIGHT along the body-end tangent. Junction point + the
        // arc's slope there (units per px = sin(κx)/sizeScale); the tail is that tangent line.
        const xJ = bodySegments[numSeg - 1].x;
        const yJ = arcOffset(curvature, xJ, sizeScale);
        const slopeJ = Math.abs(curvature) < 1e-6 ? 0 : Math.sin(curvature * xJ) / sizeScale;
        for (let j = 1; j <= numTail; j++) {
            const t = (numSeg - 1 + j) / numSeg; // continue past t = 1 into the tail
            const x = this.lerp(7, -9, t) * sizeScale * lengthMultiplier;
            const wave = Math.sin(waveTime - t * ANIMATION_CONFIG.wave.phaseGradient) *
                         ANIMATION_CONFIG.wave.amplitude * waveAmplitudeScale *
                         (1 - t * ANIMATION_CONFIG.wave.dampening);
            segments.push({ x, y: wave + yJ + (x - xJ) * slopeJ, w: 0 }); // straight tangent tail
        }

        // Splice a tail fan into the body's vertex loop at its leftmost (tail-end) edge.
        let minX = Infinity;
        for (const v of bodyVerts) if (v.x < minX) minX = v.x;
        let leftIdx = 0;
        for (let k = 0; k < bodyVerts.length; k++) {
            if (bodyVerts[k].x <= minX + 0.01) { leftIdx = k; break; }
        }
        const a = bodyVerts[leftIdx];
        const b = bodyVerts[(leftIdx + 1) % bodyVerts.length];
        const midY = (a.y + b.y) / 2;
        // Per-fish size variation: the boid's tailLength (0.9–1.8) scales the fan, with
        // the top of the range = the current (largest) size and smaller fish below it.
        const tailScale = Math.min(1, 0.55 + 0.45 * (tailLength - 0.9) / 0.9);
        const reach = 7.5 * tailScale, flare = 3.6 * tailScale;
        // A forked koi caudal fin: narrow wrist, flared lobes, a soft center notch.
        const fan = [
            { x: minX - reach * 0.25, y: midY + flare * 0.35 }, // wrist (bottom)
            { x: minX - reach * 0.9,  y: midY + flare },         // lower lobe flare
            { x: minX - reach,        y: midY + flare * 0.4 },   // lower tip
            { x: minX - reach * 0.8,  y: midY },                 // center notch (fork)
            { x: minX - reach,        y: midY - flare * 0.4 },   // upper tip
            { x: minX - reach * 0.9,  y: midY - flare },         // upper lobe flare
            { x: minX - reach * 0.25, y: midY - flare * 0.35 },  // wrist (top)
        ];
        const verts = [...bodyVerts.slice(0, leftIdx + 1), ...fan, ...bodyVerts.slice(leftIdx + 1)];
        return { verts, segments };
    }

    drawBodyFromSVG(context, segmentPositions, svgVertices, shapeParams, sizeScale, hue, saturation, brightness) {
        // Guard: Validate inputs
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return; // Cannot draw body without vertices
        }
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot deform body without segments
        }

        this.drawSVGShape(context, svgVertices, {
            deformationType: 'wave',
            deformationParams: {
                segmentPositions,
                sizeScale, // enables rib rotation (normal-ribbon bend) for the body outline
                numSegments: segmentPositions.length
            },
            positionX: 0,
            positionY: 0,
            rotation: 0,
            scale: sizeScale,
            hue,
            saturation,
            brightness: brightness - 2,
            opacity: RENDERING_CONFIG.opacity.body,
            mirror: 'none'
        });

        context.noStroke(); // Match original behavior
    }

    /**
     * Draw main body outline
     */
    drawBody(context, segmentPositions, shapeParams, sizeScale, hue, saturation, brightness) {
        // Guard: Validate segment positions
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot draw body without segments
        }

        // For sumi-e style, draw multiple semi-transparent layers with slight variations
        // This creates soft, organic brush-like edges
        if (this.useSumieStyle) {
            // Draw 3 layers with slight variations for soft edges
            for (let layer = 0; layer < 3; layer++) {
                const offset = (layer - 1) * PROCEDURAL_RENDERING.sumie.LAYER_OFFSET_BODY; // Slight positional variation
                const opacity = layer === 1 ? PROCEDURAL_RENDERING.sumie.OPACITY_PRIMARY : PROCEDURAL_RENDERING.sumie.OPACITY_SECONDARY; // Middle layer darker

                context.fill(hue, saturation, brightness + PROCEDURAL_RENDERING.body.BRIGHTNESS_OFFSET, opacity);
                context.beginShape();

                const headSeg = segmentPositions[0];
                const headPt = { x: headSeg.x + shapeParams.headX * sizeScale, y: headSeg.y };

                context.curveVertex(headPt.x, headPt.y + offset);
                context.curveVertex(headPt.x, headPt.y + offset);

                const asymmetry = shapeParams.bodyAsymmetry || 0;

                for (let i = 0; i < segmentPositions.length; i++) {
                    const seg = segmentPositions[i];
                    const topMultiplier = PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER * (1 - asymmetry * PROCEDURAL_RENDERING.body.ASYMMETRY_FACTOR);
                    context.curveVertex(seg.x, seg.y - seg.w * topMultiplier + offset);
                }

                for (let i = segmentPositions.length - 1; i >= 0; i--) {
                    const seg = segmentPositions[i];
                    const bottomMultiplier = PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER * (1 + asymmetry * PROCEDURAL_RENDERING.body.ASYMMETRY_FACTOR);
                    context.curveVertex(seg.x, seg.y + seg.w * bottomMultiplier + offset);
                }

                context.curveVertex(headPt.x, headPt.y + offset);
                context.curveVertex(headPt.x, headPt.y + offset);

                context.endShape(context.CLOSE);
            }

            // Skip segment lines for sumi-e style (too precise)
            context.noStroke();
            return; // Exit early, don't draw the normal body
        }

        // Normal rendering (non-sumi-e)
        context.fill(hue, saturation, brightness + PROCEDURAL_RENDERING.body.BRIGHTNESS_OFFSET, 1.0);
        context.beginShape();

        // Head point
        const headSeg = segmentPositions[0];
        const headPt = { x: headSeg.x + shapeParams.headX * sizeScale, y: headSeg.y };

        // Curve vertices for smooth body outline
        context.curveVertex(headPt.x, headPt.y);
        context.curveVertex(headPt.x, headPt.y);

        // Asymmetry factor: positive = rounder belly, negative = rounder back
        const asymmetry = shapeParams.bodyAsymmetry || 0;

        // Top edge from front to back (back side)
        for (let i = 0; i < segmentPositions.length; i++) {
            const seg = segmentPositions[i];
            // If asymmetry is positive, make back less wide
            const topMultiplier = PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER * (1 - asymmetry * PROCEDURAL_RENDERING.body.ASYMMETRY_FACTOR);
            context.curveVertex(seg.x, seg.y - seg.w * topMultiplier);
        }

        // Bottom edge from back to front (belly side)
        for (let i = segmentPositions.length - 1; i >= 0; i--) {
            const seg = segmentPositions[i];
            // If asymmetry is positive, make belly more wide/round
            const bottomMultiplier = PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER * (1 + asymmetry * PROCEDURAL_RENDERING.body.ASYMMETRY_FACTOR);
            context.curveVertex(seg.x, seg.y + seg.w * bottomMultiplier);
        }

        // Close back to head
        context.curveVertex(headPt.x, headPt.y);
        context.curveVertex(headPt.x, headPt.y);

        context.endShape(context.CLOSE);

        // Segment lines for definition
        context.strokeWeight(PROCEDURAL_RENDERING.body.SEGMENT_LINE_WEIGHT);
        context.stroke(hue, saturation + PROCEDURAL_RENDERING.body.SATURATION_BOOST, brightness + PROCEDURAL_RENDERING.body.BRIGHTNESS_BOOST, PROCEDURAL_RENDERING.body.SEGMENT_LINE_ALPHA);
        for (let i = 1; i < segmentPositions.length - 1; i++) {
            const seg = segmentPositions[i];
            const topY = seg.y - seg.w * PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER;
            const bottomY = seg.y + seg.w * PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER;
            context.line(seg.x, topY, seg.x, bottomY);
        }
        context.noStroke();
    }

    /**
     * Apply body brush texture as a stamp over the body
     * Approach 1: Texture as stamp scaled to body dimensions
     * Uses the same clipping as spots for consistency
     */
    applyBodyTexture(context, segmentPositions, shapeParams, sizeScale, hue, saturation, brightness, svgVertices) {
        // Guard: Check brush textures system is available
        if (!this.brushTextures || !this.brushTextures.isReady || typeof this.brushTextures.getTintedBody !== 'function') {
            return; // No textures available
        }

        // Guard: Check segment positions array is valid
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Invalid segment data
        }

        const bodyTexture = this.brushTextures.get('body');
        if (!bodyTexture || !bodyTexture.width || !bodyTexture.height) {
            return; // Invalid body texture
        }

        // Calculate body bounds
        const firstSeg = segmentPositions[0];
        const lastSeg = segmentPositions[segmentPositions.length - 1];

        // Body extends from head to tail
        const bodyWidth = Math.abs(firstSeg.x - lastSeg.x);

        // Find maximum segment width (optimized - no intermediate array)
        let bodyHeight = 0;
        for (let i = 0; i < segmentPositions.length; i++) {
            if (segmentPositions[i].w > bodyHeight) {
                bodyHeight = segmentPositions[i].w;
            }
        }

        // Center + size the texture on the DEFORMED spine so it covers the arc. segment.y is
        // in SVG units → ×sizeScale. The old code fixed centerY = 0 and a body-height rect, so
        // once the body arced the displaced parts (especially the head at the front) fell
        // outside the rect → untextured → lighter. Centre on the spine and extend the height by
        // the spine's Y range (which is ~0 when straight, so the straight look is unchanged).
        let minSY = Infinity, maxSY = -Infinity;
        for (let i = 0; i < segmentPositions.length; i++) {
            const sy = segmentPositions[i].y * sizeScale;
            if (sy < minSY) minSY = sy;
            if (sy > maxSY) maxSY = sy;
        }
        const centerX = (firstSeg.x + lastSeg.x) / 2;
        const centerY = (minSY + maxSY) / 2;
        const arcYRange = maxSY - minSY;

        // Use original texture to preserve dark brush areas (authentic sumi-e)
        // Dark areas in the original brushstroke will appear as darker colors
        // This creates more natural brush texture variation vs alpha-only approach
        context.push();
        context.translate(centerX, centerY);

        // Apply color tint and draw with MULTIPLY to preserve luminosity
        context.tint(hue, saturation, brightness, BRUSH_TEXTURE_CONFIG.BODY_TEXTURE_ALPHA);
        context.blendMode(context.MULTIPLY);
        context.imageMode(context.CENTER);
        const textureWidth = bodyWidth * BRUSH_TEXTURE_CONFIG.BODY_TEXTURE_SCALE;
        const textureHeight = bodyHeight * BRUSH_TEXTURE_CONFIG.BODY_TEXTURE_SCALE + arcYRange;
        context.image(bodyTexture, 0, 0, textureWidth, textureHeight);
        context.noTint();

        context.pop();
    }

    /**
     * Create a clipping path for body and head to constrain spots
     */
    clipToBodyAndHead(context, segmentPositions, svgVertices, shapeParams, sizeScale) {
        // Guard: Validate segment positions
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // Cannot create clip without segments
        }

        const ctx = context.drawingContext;
        if (!ctx) return; // Guard: ensure drawing context exists

        ctx.save();
        ctx.beginPath();

        // Create body outline path
        if (svgVertices.body && Array.isArray(svgVertices.body) && svgVertices.body.length > 0) {
            // Use SVG body outline
            const bodyOutline = this.calculateSVGOutline(svgVertices.body, segmentPositions, sizeScale);
            if (bodyOutline && bodyOutline.length > 0) {
                ctx.moveTo(bodyOutline[0].x, bodyOutline[0].y);
                for (let i = 1; i < bodyOutline.length; i++) {
                    ctx.lineTo(bodyOutline[i].x, bodyOutline[i].y);
                }
                ctx.closePath();
            }
        } else {
            // Use procedural body outline
            // Top edge
            for (let i = 0; i < segmentPositions.length; i++) {
                const seg = segmentPositions[i];
                const topY = seg.y - seg.w * PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER;
                if (i === 0) {
                    ctx.moveTo(seg.x, topY);
                } else {
                    ctx.lineTo(seg.x, topY);
                }
            }
            // Bottom edge (reverse)
            for (let i = segmentPositions.length - 1; i >= 0; i--) {
                const seg = segmentPositions[i];
                const bottomY = seg.y + seg.w * PROCEDURAL_RENDERING.body.WIDTH_MULTIPLIER;
                ctx.lineTo(seg.x, bottomY);
            }
            ctx.closePath();
        }

        // Add head outline to clip path
        if (svgVertices.head && Array.isArray(svgVertices.head) && svgVertices.head.length > 0) {
            const headPos = segmentPositions[0];
            if (!headPos) return; // Guard: ensure head segment exists

            // Match drawHeadFromSVG EXACTLY: centre at (headX, headPos.y·sizeScale) and rotate
            // by the local head tangent. The old code used headPos.y unscaled + no rotation, so
            // the clip head diverged from the drawn head → the texture painted a ghost "head".
            const cx = headPos.x + shapeParams.headX * sizeScale;
            const cy = headPos.y * sizeScale;
            const h1 = segmentPositions[1] || headPos;
            const headAngle = Math.atan2((headPos.y - h1.y) * sizeScale, headPos.x - h1.x);
            const ca = Math.cos(headAngle), sa = Math.sin(headAngle);
            const hx = (v) => cx + (v.x * sizeScale) * ca - (v.y * sizeScale) * sa;
            const hy = (v) => cy + (v.x * sizeScale) * sa + (v.y * sizeScale) * ca;
            ctx.moveTo(hx(svgVertices.head[0]), hy(svgVertices.head[0]));
            for (let i = 1; i < svgVertices.head.length; i++) {
                ctx.lineTo(hx(svgVertices.head[i]), hy(svgVertices.head[i]));
            }
            ctx.closePath();
        } else {
            // Add procedural head ellipse to clip
            const headPos = segmentPositions[0];
            const headOffsetX = shapeParams.headX * sizeScale;
            const headWidth = shapeParams.headWidth * sizeScale;
            const headHeight = shapeParams.headHeight * sizeScale;

            ctx.ellipse(
                headPos.x + headOffsetX,
                headPos.y,
                headWidth / 2,
                headHeight / 2,
                0, 0, Math.PI * 2
            );
        }

        ctx.clip();
    }

    /**
     * Calculate SVG outline vertices for clipping
     */
    calculateSVGOutline(svgVertices, segmentPositions, sizeScale) {
        // Guard: Validate inputs
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return [];
        }
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return [];
        }

        // Apply the SAME wave deformation as drawBodyFromSVG (incl. rib rotation via sizeScale)
        // so the texture clip matches the drawn body exactly — otherwise the base fill shows
        // through as a lighter "ghost" where the two diverge.
        const deformedVertices = this.applyWaveDeformation(svgVertices, {
            segmentPositions,
            numSegments: segmentPositions.length,
            sizeScale
        });

        // Then scale the deformed vertices to world space
        return deformedVertices.map(vertex => ({
            x: vertex.x * sizeScale,
            y: vertex.y * sizeScale
        }));
    }

    /**
     * Draw spot pattern on body using brush texture stamps
     * @param {number} bodyBrightness - Body color brightness (0-100) for adaptive blend mode
     */
    drawSpots(context, segmentPositions, spots, sizeScale, boidSeed = 0, koiAngle = 0, bodyBrightness = 50) {
        // Guard: Validate input arrays
        if (!segmentPositions || !Array.isArray(segmentPositions) || segmentPositions.length === 0) {
            return; // No segments to draw on
        }
        if (!spots || !Array.isArray(spots)) {
            return; // No spots to draw
        }

        if (!this.brushTextures || !this.brushTextures.isReady) {
            // Fallback to simple ellipses if textures not available
            for (let spot of spots) {
                if (!spot || spot.segment >= segmentPositions.length) continue;
                const seg = segmentPositions[spot.segment];
                context.fill(spot.color.h, spot.color.s, spot.color.b, 1.0);
                const spotSize = spot.size * sizeScale * BRUSH_TEXTURE_CONFIG.SPOT_SIZE_MULTIPLIER;
                context.ellipse(
                    seg.x,
                    seg.y + spot.offsetY * sizeScale,
                    spotSize,
                    spotSize * BRUSH_TEXTURE_CONFIG.SPOT_HEIGHT_RATIO
                );
            }
            return;
        }

        // Use brush texture stamps for authentic sumi-e spots
        // Get spot count to check if textures are available
        const spotCount = this.brushTextures.getSpotCount();
        if (spotCount === 0) {
            // Fallback to ellipses if no spot textures available
            for (let spot of spots) {
                if (!spot || spot.segment >= segmentPositions.length) continue;
                const seg = segmentPositions[spot.segment];
                context.fill(spot.color.h, spot.color.s, spot.color.b, 1.0);
                const spotSize = spot.size * sizeScale * BRUSH_TEXTURE_CONFIG.SPOT_SIZE_MULTIPLIER;
                context.ellipse(
                    seg.x,
                    seg.y + spot.offsetY * sizeScale,
                    spotSize,
                    spotSize * BRUSH_TEXTURE_CONFIG.SPOT_HEIGHT_RATIO
                );
            }
            return;
        }

        for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
            const spot = spots[spotIndex];
            if (!spot || spot.segment >= segmentPositions.length) continue;

            const seg = segmentPositions[spot.segment];
            if (!seg) continue; // Guard: ensure segment exists
            // Scale up spot size now that clipping keeps them within body boundaries
            const spotSize = spot.size * sizeScale * BRUSH_TEXTURE_CONFIG.SPOT_SIZE_MULTIPLIER;
            const spotX = seg.x;
            const spotY = seg.y + spot.offsetY * sizeScale;

            // Generate deterministic random values for this specific spot
            // Using boidSeed + spotIndex for consistency across frames
            const randomSeed = (boidSeed * 1000 + spotIndex * 137) % 10000;

            // Determine which spot texture to use (deterministic per spot)
            const spotTextureIndex = Math.floor(randomSeed) % this.brushTextures.getSpotCount();

            // Mostly aligned with slight variation: ±SPOT_ROTATION_VARIATION degrees
            const rotationVariation = ((randomSeed % (BRUSH_TEXTURE_CONFIG.SPOT_ROTATION_VARIATION * 2)) - BRUSH_TEXTURE_CONFIG.SPOT_ROTATION_VARIATION) * (Math.PI / 180);
            const randomRotation = rotationVariation;
            const randomSizeVariation = BRUSH_TEXTURE_CONFIG.SPOT_SIZE_VARIATION_MIN +
                ((randomSeed % 100) / 100) * (BRUSH_TEXTURE_CONFIG.SPOT_SIZE_VARIATION_MAX - BRUSH_TEXTURE_CONFIG.SPOT_SIZE_VARIATION_MIN);

            // Adaptive alpha and blend mode based on body brightness
            // Dark fish: Lower alpha for better blending, BLEND mode for visibility
            // Light fish: Higher alpha, MULTIPLY for watercolor integration
            const spotAlpha = bodyBrightness < BRUSH_TEXTURE_CONFIG.DARK_FISH_THRESHOLD
                ? BRUSH_TEXTURE_CONFIG.DARK_FISH_SPOT_ALPHA
                : BRUSH_TEXTURE_CONFIG.LIGHT_FISH_SPOT_ALPHA;
            const blendMode = bodyBrightness < BRUSH_TEXTURE_CONFIG.DARK_FISH_THRESHOLD ? 'BLEND' : 'MULTIPLY';

            // Get pre-tinted texture from cache (performance optimization)
            // This eliminates expensive per-frame tinting operations
            const tintedSpot = this.brushTextures.getTintedSpot(spotTextureIndex, spot.color, spotAlpha, blendMode);

            context.push();
            context.translate(spotX, spotY);
            // Rotate 180° to flip brush direction (head-to-tail), plus random variation
            context.rotate(Math.PI + randomRotation);

            // Draw pre-tinted brush texture stamp with random size variation
            // No runtime tinting needed - texture is already colored and cached
            context.imageMode(context.CENTER);
            const finalSpotWidth = spotSize * randomSizeVariation;
            const finalSpotHeight = spotSize * BRUSH_TEXTURE_CONFIG.SPOT_HEIGHT_RATIO * randomSizeVariation;
            context.image(tintedSpot, 0, 0, finalSpotWidth, finalSpotHeight);

            context.pop();
        }
    }

    /**
     * Draw head from SVG vertices (static, no animation)
     * Eyes are always rendered procedurally on top of the SVG head shape
     * @param {Object} context - p5 graphics context
     * @param {Object} headSegment - Head segment position {x, y, w}
     * @param {Array<{x, y}>} svgVertices - Head SVG vertices
     * @param {Object} shapeParams - Shape parameters
     * @param {number} sizeScale - Size multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     */
    drawHeadFromSVG(context, headSegment, svgVertices, shapeParams, sizeScale, hue, saturation, brightness, headAngle = 0) {
        // Guard: Validate inputs
        if (!svgVertices || !Array.isArray(svgVertices) || svgVertices.length === 0) {
            return; // Cannot draw head without vertices
        }
        if (!headSegment) {
            return; // Cannot position head without segment
        }

        // Head anchor on the spine. NOTE: segment.y is in SVG units (the deform scales it by
        // sizeScale), so it MUST be scaled here to sit at the arc-displaced head position —
        // otherwise the head lags ~sizeScale× toward the axis. Head + eyes are drawn in one
        // translated + rotated frame so they follow the local arc tangent (headAngle).
        const cx = headSegment.x + shapeParams.headX * sizeScale;
        const cy = headSegment.y * sizeScale;
        context.push();
        context.translate(cx, cy);
        context.rotate(headAngle);

        this.drawSVGShape(context, svgVertices, {
            deformationType: 'static', // No animation for head
            deformationParams: {},
            positionX: 0,
            positionY: 0,
            rotation: 0,
            scale: sizeScale,
            hue,
            saturation,
            brightness: brightness + PROCEDURAL_RENDERING.head.BRIGHTNESS_OFFSET, // Slightly brighter than body
            opacity: RENDERING_CONFIG.opacity.head,
            mirror: 'none'
        });

        // Eyes, relative to the head centre so they rotate with the head.
        context.fill(0, 0, RENDERING_CONFIG.color.eyeBrightness, RENDERING_CONFIG.opacity.eyes);
        const eyeX = (shapeParams.eyeX - shapeParams.headX) * sizeScale;
        const eyeSize = shapeParams.eyeSize * sizeScale;
        context.ellipse(eyeX, shapeParams.eyeYTop * sizeScale, eyeSize, eyeSize);
        context.ellipse(eyeX, shapeParams.eyeYBottom * sizeScale, eyeSize, eyeSize);

        context.pop();
    }

    /**
     * Draw head and eyes
     * Uses SVG if vertices provided, otherwise uses procedural rendering
     * Eyes are ALWAYS procedural regardless of head rendering method
     * @param {Object} context - p5 graphics context
     * @param {Object} headSegment - Head segment position {x, y, w}
     * @param {Object} shapeParams - Shape parameters
     * @param {number} sizeScale - Size multiplier
     * @param {number} hue - HSB hue
     * @param {number} saturation - HSB saturation
     * @param {number} brightness - HSB brightness
     * @param {Array<{x,y}>} [svgVertices=null] - Optional SVG vertices for head
     */
    drawHead(context, headSegment, shapeParams, sizeScale, hue, saturation, brightness, svgVertices = null, headAngle = 0) {
        // Guard: Validate head segment
        if (!headSegment) {
            return; // Cannot draw head without segment
        }

        // Use SVG if provided, otherwise use procedural rendering
        if (svgVertices && Array.isArray(svgVertices) && svgVertices.length > 0) {
            this.drawHeadFromSVG(context, headSegment, svgVertices, shapeParams, sizeScale, hue, saturation, brightness, headAngle);
            return;
        }

        // PROCEDURAL HEAD RENDERING (fallback)
        const headX = headSegment.x + shapeParams.headX * sizeScale;
        const headY = headSegment.y;
        const headWidth = shapeParams.headWidth * sizeScale;
        const headHeight = shapeParams.headHeight * sizeScale;

        // For sumi-e style, draw head with multiple layers for soft edges
        if (this.useSumieStyle) {
            for (let layer = 0; layer < 3; layer++) {
                const offset = (layer - 1) * PROCEDURAL_RENDERING.head.LAYER_OFFSET;
                const sizeVariation = 1 + (layer - 1) * PROCEDURAL_RENDERING.head.SIZE_VARIATION;
                const opacity = layer === 1 ? PROCEDURAL_RENDERING.head.OPACITY_PRIMARY : PROCEDURAL_RENDERING.head.OPACITY_SECONDARY;

                context.fill(hue, saturation, brightness + PROCEDURAL_RENDERING.head.BRIGHTNESS_OFFSET, opacity);
                context.ellipse(
                    headX + offset,
                    headY + offset,
                    headWidth * sizeVariation,
                    headHeight * sizeVariation
                );
            }
        } else {
            // Normal rendering
            context.fill(hue, saturation, brightness + PROCEDURAL_RENDERING.head.BRIGHTNESS_OFFSET, 1.0);
            context.ellipse(headX, headY, headWidth, headHeight);
        }

        // Eyes (both sides for top-down view) - always solid, no layering
        context.fill(0, 0, 10, 1.0);

        // Left eye (top)
        context.ellipse(
            headSegment.x + shapeParams.eyeX * sizeScale,
            headSegment.y + shapeParams.eyeYTop * sizeScale,
            shapeParams.eyeSize * sizeScale,
            shapeParams.eyeSize * sizeScale
        );

        // Right eye (bottom)
        context.ellipse(
            headSegment.x + shapeParams.eyeX * sizeScale,
            headSegment.y + shapeParams.eyeYBottom * sizeScale,
            shapeParams.eyeSize * sizeScale,
            shapeParams.eyeSize * sizeScale
        );
    }

    /**
     * Helper: Linear interpolation
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }
}
