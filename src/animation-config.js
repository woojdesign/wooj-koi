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
        headAmp: 0.18,           // AMPLITUDE ENVELOPE: body-wave amplitude at the head (fraction)...
        tailPower: 1.7,          // ...growing toward the tail as headAmp→1 over t^tailPower (the "whip")
        glideAmp: 0.28,          // GAIT: undulation amplitude while gliding (flick=0), fraction of full
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
