/**
 * Physics Configuration (Simplified for Portfolio)
 * Basic physics constants for 3-koi flocking
 */

export const PHYSICS_CONFIG = {
    // Force smoothing - reduces jitter (lower = steadier desired heading when crowded)
    FORCE_SMOOTHING: 0.18,
    VELOCITY_SMOOTHING: 0.15,

    // Swimming wiggle: tail-beat phase advances by speed × this each frame.
    WAVE_RATE: 0.13,

    // Dead-zone threshold - ignore forces below this magnitude
    DEAD_ZONE_THRESHOLD: 0.01,

    // Perception - how far koi can "see"
    PERCEPTION_RADIUS: 75,  // Optimized for smooth flocking with 5 koi (from dashboard research)

    // Damping - smooth turns (legacy; unused by the bend-to-turn model below)
    DAMPING_COEFFICIENT: 0.45,
    MIN_SPEED_FOR_DAMPING: 0.1,

    // === BEND-TO-TURN (realistic turning) ===
    // The fish keeps its own heading and turns toward the desired direction at a
    // capped, speed-scaled rate. A rate-limited turn cannot oscillate, so this
    // replaces the damping / oscillation-detection / escape hacks (which were only
    // there to fight the wobble the velocity-vector model produced).
    // Turn radius scales with EACH fish's own body length, so big and small koi trace
    // proportionate arcs (radius ≈ 0.85 body-length) instead of sharing one px radius.
    //   radius_px = TURN_RADIUS_FACTOR × sizeMultiplier × lengthMultiplier
    //   134.6 = 0.85 (body-lengths) × 16 (body units) × 9.9 (render scale).
    // maxTurn = speed / radius, so the radius stays constant with speed — a slow fish
    // traces the same arc, just slower along it. This lets the fish swim FORWARD through
    // the turn instead of pivoting in place (a fixed rate gave ~0.23 body-lengths).
    TURN_RADIUS_FACTOR: 134.6,
    MAX_TURN_RATE: 0.02,         // absolute safety ceiling on rad/frame (radius governs normally)
    TURN_RESPONSIVENESS: 0.12,   // how eagerly it steers toward the desired heading
    // Anti-wobble: near equilibrium the fish makes endless tiny corrections toward a
    // desired heading that itself jitters, so the rotation micro-reverses frame to
    // frame. The dead-zone stops steering once within a few degrees of the target;
    // the low-pass keeps the turn RATE from flipping sign every frame. Together they
    // cut turn reversals + turn-rate shake ~70% without widening the arcs (measured).
    TURN_DEADZONE: 0.052,        // radians (~3°) — below this heading error, don't steer
    ANGVEL_SMOOTHING: 0.15,      // low-pass on the turn rate (fraction eased per frame)
    SPEED_SMOOTHING: 0.08,       // how gently speed eases toward its target
    MIN_SPEED_FRACTION: 0.6,     // keep gliding forward (esp. through turns) — a higher floor
                                 // means it doesn't slow to a near-pivot mid-turn

    // Force prioritization thresholds
    SEPARATION_HIGH_THRESHOLD: 0.05,    // When separation force this strong, prioritize 90%
    SEPARATION_MED_THRESHOLD: 0.02,     // When this strong, prioritize 70%

    // Priority weights for different crowding levels
    PRIORITIZE_HIGH: {
        separation: 0.9,     // 90% separation
        alignment: 0.1,      // 10% alignment
        cohesion: 0.1        // 10% cohesion
    },

    PRIORITIZE_MEDIUM: {
        separation: 0.7,     // 70% separation
        alignment: 0.5,      // 50% alignment
        cohesion: 0.5        // 50% cohesion
    },

    // Limit neighbors for performance
    MAX_NEIGHBORS: 8,

    // === OSCILLATION DETECTION ===
    // Detect rapid back-and-forth direction changes
    OSCILLATION_HISTORY_LENGTH: 10,     // Track last N headings
    OSCILLATION_CHECK_LENGTH: 6,        // Need at least N headings to check
    OSCILLATION_REVERSAL_THRESHOLD: 3,  // N+ reversals = oscillation

    // === OVERCROWDING DETECTION ===
    // Trigger escape when too many neighbors or forces too strong
    OVERCROWDING_NEIGHBOR_LIMIT: 15,    // Max neighbors before escaping
    OVERCROWDING_FORCE_LIMIT: 0.25,     // Max total force before escaping

    // === ESCAPE MANEUVERS ===
    // Strong directional force to break out of problematic states
    ESCAPE_DURATION_MIN: 1500,          // Min escape duration (ms)
    ESCAPE_DURATION_MAX: 3000,          // Max escape duration (ms)
    ESCAPE_COOLDOWN_MIN: 3000,          // Min cooldown after escape (ms)
    ESCAPE_COOLDOWN_MAX: 5000,          // Max cooldown after escape (ms)
    ESCAPE_ANGLE_MIN: Math.PI / 4,      // Min angle offset for escape (45°)
    ESCAPE_ANGLE_MAX: Math.PI / 2,      // Max angle offset for escape (90°)

    // === INDEPENDENCE BEHAVIOR ===
    // Random solo swimming for natural variation
    INDEPENDENCE_CHECK_MIN: 3000,       // Min time between checks (ms)
    INDEPENDENCE_CHECK_MAX: 10000,      // Max time between checks (ms)
    INDEPENDENCE_CHANCE_MIN: 0.10,      // Min chance to break off the school (per check)
    INDEPENDENCE_CHANCE_MAX: 0.22,      // Max chance to break off the school (per check)
    INDEPENDENCE_DURATION_MIN: 2000,    // Min independent duration (ms)
    INDEPENDENCE_DURATION_MAX: 8000,    // Max independent duration (ms)
};
