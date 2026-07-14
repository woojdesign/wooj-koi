/**
 * Animation Configuration
 * Centralized constants for animation timing, wave motion, and fin dynamics
 */

export const ANIMATION_CONFIG = {
    // Body wave motion
    wave: {
        phaseGradient: 3.5,      // Controls wave propagation along body (0-1 becomes 0-3.5)
        amplitude: 0.55,         // base wiggle amplitude (per fish it also scales with speed)
        dampening: 0.2,           // (legacy) Wave dampening towards tail (1 - t * dampening)
        // AMPLITUDE ENVELOPE (Di Santo et al. 2021, PNAS 2113206118): the lateral amplitude along
        // the body converges across fishes to y = a + b·t + c·t² (in body lengths, t = nose→tail).
        // Normalized here so the tail (t=1) = 1. This places the node/pivot ~0.2 BL back from the
        // nose (dy/dt=0 at t≈0.23) and leaves the head a small yaw recoil — replacing the old
        // monotonic head→tail "whip" ramp (headAmp/tailPower) with the measured envelope.
        envelope: { a: 0.05, b: -0.13, c: 0.28 },
        glideAmp: 0.55,          // GAIT: BODY undulation amplitude while gliding (flick=0), fraction of
                                 // full. Kept HIGH so the body keeps undulating gracefully and
                                 // continuously (the v0.1.7 feel) — the gait is now just a gentle surge
                                 // (0.55 coast → 1.0 burst), not a freeze-and-dart. Lower it toward ~0.15
                                 // for a pronounced burst-and-coast (biomechanically truer but stiffer).
        tailGlideAmp: 0.65,      // CAUDAL FIN glide floor — a touch above the body so the fin always
                                 // flows through the coast; higher = more continuous tail flow.
        dorsalDampening: 0.5      // Wave dampening for dorsal fin
    },

    // Tail motion
    tail: {
        segments: 12,             // Number of segments for smooth interpolation
        flutterSpeed: 0.15,       // Flutter animation speed
        flutterAmplitude: 0.8,    // Flutter amplitude multiplier
        rotationAmplitude: 0.2    // Rotation amplitude for tail lobes
    },

    // Fin motion
    fins: {
        // Pectoral fins
        pectoral: {
            rotationAmplitude: 0.15,  // Rotation amplitude
            swayAmplitude: 1,       // Sway amplitude
            frequency: 1            // Animation frequency multiplier
        },

        // Ventral fins
        ventral: {
            rotationAmplitude: 0.1,   // Rotation amplitude
            swayAmplitude: 0.8,       // Sway amplitude
            frequency: 1.2            // Animation frequency multiplier
        },

        // Dorsal fin
        dorsal: {
            swayAmplitude: 1,       // Sway amplitude
            frequency: 1.2            // Animation frequency multiplier
        }
    },

    // Animation timing
    timing: {
        defaultFrameRate: 60      // Target frame rate for animations
    }
};
