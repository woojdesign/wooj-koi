/**
 * Rendering Configuration
 * Centralized constants for visual rendering, opacity, colors, and effects
 */

export const RENDERING_CONFIG = {
    // Opacity values (all set to 1.0 for fully opaque rendering)
    opacity: {
        body: 1.0,
        tail: 1.0,
        fins: 1.0,
        head: 1.0,
        eyes: 1.0,
        spots: 1.0
    },

    // Color adjustments
    color: {
        spotBrightness: 60,       // Base brightness for spots
        spotDarkeningFactor: 0.7, // Darkening factor for spot variation
        eyeBrightness: 10,        // Eye brightness value
        eyeSaturation: 0          // Eye saturation (grayscale)
    },

    // Brush texture toggles (simplified for portfolio)
    textures: {
        enabled: true,
        paper: false,        // Disable paper texture by default for cleaner look
        body: true,
        tail: true,
        fin: true,
        spot: false          // Disable spot textures for performance
    },

    // Default scaling and geometry
    geometry: {
        defaultSizeScale: 1,      // Default size scale for rendering
        eyeRadiusBase: 0.5,       // Base eye radius
        eyeRadiusOuter: 0.7       // Outer eye radius (white part)
    }
};
