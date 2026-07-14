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
        glideAmp: 0.12,          // GAIT: BODY undulation amplitude while gliding (flick=0), fraction of
                                 // full. Low so the coast body goes nearly STRAIGHT (burst-and-coast),
                                 // not a gentle wiggle — the burst supplies the flex, coast is passive.
        tailGlideAmp: 0.45,      // ...but the CAUDAL FIN keeps flowing during the coast (it flutters
                                 // passively in the wake), so the tail isn't stiff while the body
                                 // glides straight. Higher = more continuous tail flow (v0.1.7 feel).
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
