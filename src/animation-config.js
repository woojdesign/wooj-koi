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
        // WHIP amplitude envelope (v0.1.9, restored as the shipped default): body-wave amplitude
        // grows from a quiet head to a big flowing tail as headAmp + (1-headAmp)·t^tailPower. Reads
        // "dynamic but calm" (Sean's pick). The measured 'node' quadratic below (Di Santo et al.
        // 2021, PNAS 2113206118) pins a near-still node ~0.2 BL back — biomechanically truer but
        // reads stiffer; kept selectable via envelopeMode.
        envelope: { a: 0.05, b: -0.13, c: 0.28 },   // used only when envelopeMode === 'node'
        envelopeMode: 'whip',    // 'whip' (v0.1.9 head→tail ramp) | 'node' (measured quadratic)
        headAmp: 0.18,           // WHIP: body-wave amplitude at the head (fraction of tail)…
        tailPower: 1.7,          // …growing toward the tail as headAmp→1 over t^tailPower (the "whip")
        glideAmp: 0.45,          // GAIT: BODY undulation amplitude while gliding (flick=0), fraction of
                                 // full. The body goes calmer (not straight) on the coast, then whips
                                 // up on the burst. Lower → more pronounced burst-and-coast.
        tailGlideAmp: 0.6,       // CAUDAL FIN glide floor — a touch above the body so the fin always
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
