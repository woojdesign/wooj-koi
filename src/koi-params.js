/**
 * Koi Shape Parameters
 * Centralized parameter definitions, defaults, and validation
 */

export const DEFAULT_SHAPE_PARAMS = {
    // Body structure
    numSegments: 10,
    bodyWidth: 2.30,
    bodyHeight: 0.95,
    bodyTaperStart: 0.15,     // Where tapering begins (0-1, segment position)
    bodyTaperStrength: 0.90,   // How much to taper (0-1)
    bodyPeakPosition: 0.70,    // Where body is widest (0-1)
    bodyPeakWidth: 8.0,       // Maximum width multiplier
    bodyFrontWidth: 4.5,      // Front width multiplier
    bodyAsymmetry: 0.90,       // Belly rounder than back (-1 to 1)

    // Head
    headX: -0.2,
    headWidth: 7.5,
    headHeight: 5.0,

    // Eyes (added for dual-eye rendering)
    eyeX: 2.0,
    eyeYTop: -1.6,
    eyeYBottom: 1.5,
    eyeSize: 0.5,

    // Tail
    tailStartX: 2,
    tailWidthStart: 0.20,
    tailWidthEnd: 1.50,
    tailSplit: 0.5,

    // Dorsal fin
    dorsalPos: 4,
    dorsalY: -0.5,

    // Pectoral fins
    pectoralPos: 2,
    pectoralYTop: -2.5,
    pectoralAngleTop: -2.5,
    pectoralYBottom: 2.0,
    pectoralAngleBottom: 2.1,

    // Ventral fins
    ventralPos: 5,
    ventralYTop: -1.5,
    ventralAngleTop: -2.5,
    ventralYBottom: 1.5,
    ventralAngleBottom: 2.5
};
