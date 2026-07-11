/**
 * Koi Varieties and Pattern Generation
 * Defines all 28 koi varieties with weighted distribution
 * and generates unique spot patterns for each variety
 */

// Traditional koi varieties with weighted distribution
// Each variety has a weight representing its percentage in the population
export const VARIETIES = [
    // Gosanke (35% total) - The "Big Three"
    { name: 'kohaku', base: { h: 0, s: 0, b: 90 }, weight: 15 },
    { name: 'sanke', base: { h: 0, s: 0, b: 90 }, weight: 10 },
    { name: 'showa', base: { h: 0, s: 0, b: 30 }, weight: 10 },

    // Utsurimono & Bekko (15% total)
    { name: 'shiro-utsuri', base: { h: 0, s: 0, b: 25 }, weight: 5 },
    { name: 'hi-utsuri', base: { h: 0, s: 0, b: 25 }, weight: 4 },
    { name: 'ki-utsuri', base: { h: 0, s: 0, b: 25 }, weight: 2 },
    { name: 'shiro-bekko', base: { h: 0, s: 0, b: 88 }, weight: 2 },
    { name: 'aka-bekko', base: { h: 5, s: 75, b: 75 }, weight: 1 },
    { name: 'ki-bekko', base: { h: 50, s: 60, b: 80 }, weight: 1 },

    // Hikarimono (15% total) - Metallic varieties
    { name: 'yamabuki-ogon', base: { h: 45, s: 50, b: 85 }, weight: 5 },
    { name: 'platinum-ogon', base: { h: 200, s: 8, b: 88 }, weight: 3 },
    { name: 'hariwake', base: { h: 0, s: 0, b: 88 }, weight: 4 },
    { name: 'kujaku', base: { h: 0, s: 0, b: 88 }, weight: 3 },

    // Asagi / Shusui (8% total) - Blue-scaled varieties
    { name: 'asagi', base: { h: 200, s: 35, b: 65 }, weight: 5 },
    { name: 'shusui', base: { h: 200, s: 40, b: 68 }, weight: 3 },

    // Koromo / Goshiki (7% total)
    { name: 'ai-goromo', base: { h: 0, s: 0, b: 90 }, weight: 3 },
    { name: 'budo-goromo', base: { h: 0, s: 0, b: 90 }, weight: 2 },
    { name: 'goshiki', base: { h: 210, s: 25, b: 60 }, weight: 2 },

    // Specialty (10% total)
    { name: 'tancho', base: { h: 0, s: 0, b: 90 }, weight: 3 },
    { name: 'gin-rin-kohaku', base: { h: 0, s: 0, b: 90 }, weight: 2 },
    { name: 'doitsu-kohaku', base: { h: 0, s: 0, b: 90 }, weight: 3 },
    { name: 'butterfly-kohaku', base: { h: 0, s: 0, b: 90 }, weight: 2 },

    // Solid-color / Naturalistic (10% total)
    { name: 'chagoi', base: { h: 30, s: 35, b: 50 }, weight: 3 },
    { name: 'soragoi', base: { h: 0, s: 0, b: 60 }, weight: 3 },
    { name: 'benigoi', base: { h: 5, s: 80, b: 70 }, weight: 2 },
    { name: 'ochiba', base: { h: 40, s: 30, b: 70 }, weight: 2 }
];

/**
 * Select a random koi variety using weighted distribution
 * @param {Function} randomFunc - Random function (e.g., p5.js random)
 * @returns {Object} - Selected variety object
 */
export function selectVariety(randomFunc = Math.random) {
    const totalWeight = VARIETIES.reduce((sum, v) => sum + v.weight, 0);
    let randomValue = randomFunc() * totalWeight;
    let cumulativeWeight = 0;

    for (let variety of VARIETIES) {
        cumulativeWeight += variety.weight;
        if (randomValue < cumulativeWeight) {
            return variety;
        }
    }

    // Fallback (should never reach here)
    return VARIETIES[0];
}

/**
 * Generate unique spot pattern for a koi based on its variety
 * @param {Object} variety - Koi variety object
 * @param {Function} randomFunc - Random function (e.g., p5.js random)
 * @param {Function} floorFunc - Floor function (e.g., p5.js floor or Math.floor)
 * @returns {Object} - Pattern object with spots array
 */
export function generatePattern(variety, randomFunc = Math.random, floorFunc = Math.floor) {
    const spots = [];
    const numSpots = floorFunc(randomFunc() * 4 + 2); // 2-6 spots

    // Helper to create random value in range
    const rand = (min, max) => randomFunc() * (max - min) + min;

    switch(variety.name) {
        // GOSANKE (Big Three)
        case 'kohaku':
            // Red spots on white - pattern should start at head, end before tail
            for (let i = 0; i < numSpots; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(2, 4.5),
                    color: { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }
                });
            }
            break;

        case 'sanke':
            // Red and black spots on white - black never on head
            for (let i = 0; i < numSpots; i++) {
                let isBlack = randomFunc() < 0.3;
                spots.push({
                    segment: isBlack ? floorFunc(rand(2, 7)) : floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: isBlack ? rand(0.8, 2) : rand(2, 4),
                    color: isBlack ?
                        { h: 0, s: 0, b: 20 } :
                        { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }
                });
            }
            break;

        case 'showa':
            // Red and white spots on black - black appears on head
            for (let i = 0; i < numSpots + 2; i++) {
                let isWhite = randomFunc() < 0.5;
                spots.push({
                    segment: floorFunc(rand(0, 7)),
                    offsetY: rand(-1.8, 1.8),
                    size: rand(1.8, 4.5),
                    color: isWhite ?
                        { h: 0, s: 0, b: 90 } :
                        { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }
                });
            }
            break;

        // UTSURIMONO (Reflection Varieties)
        case 'shiro-utsuri':
            // White islands on black - marble effect
            for (let i = 0; i < numSpots + 1; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 7)),
                    offsetY: rand(-2, 2),
                    size: rand(2, 5),
                    color: { h: 0, s: 0, b: 90 }
                });
            }
            break;

        case 'hi-utsuri':
            // Red on black - fiery and bold
            for (let i = 0; i < numSpots + 1; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 7)),
                    offsetY: rand(-2, 2),
                    size: rand(2.5, 5),
                    color: { h: rand(0, 12), s: rand(75, 90), b: rand(70, 85) }
                });
            }
            break;

        case 'ki-utsuri':
            // Yellow on black - vibrant lemon-yellow
            for (let i = 0; i < numSpots; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 7)),
                    offsetY: rand(-1.8, 1.8),
                    size: rand(2, 4.5),
                    color: { h: rand(55, 65), s: rand(70, 85), b: rand(80, 90) }
                });
            }
            break;

        // HIKARIMONO (Metallic Varieties)
        case 'yamabuki-ogon':
        case 'platinum-ogon':
            // Solid metallic - no pattern spots
            break;

        case 'kujaku':
            // Red/orange/gold scales over black reticulation
            for (let i = 0; i < numSpots + 1; i++) {
                spots.push({
                    segment: floorFunc(rand(1, 7)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(1.5, 3.5),
                    color: { h: rand(15, 40), s: rand(50, 70), b: rand(70, 85) }
                });
            }
            break;

        case 'hariwake':
            // Orange or yellow patches on metallic white
            for (let i = 0; i < numSpots; i++) {
                let isOrange = randomFunc() < 0.6;
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(2, 4),
                    color: isOrange ?
                        { h: rand(20, 35), s: rand(60, 75), b: rand(75, 85) } :
                        { h: rand(50, 60), s: rand(50, 65), b: rand(80, 90) }
                });
            }
            break;

        // BEKKO
        case 'shiro-bekko':
            // Small black spots on white along back
            for (let i = 0; i < floorFunc(rand(2, 5)); i++) {
                spots.push({
                    segment: floorFunc(rand(1, 7)),
                    offsetY: rand(-0.8, 0.8),  // Along back mostly
                    size: rand(1, 2.5),
                    color: { h: 0, s: 0, b: 20 }
                });
            }
            break;

        case 'aka-bekko':
            // Black spots on red base
            for (let i = 0; i < floorFunc(rand(2, 4)); i++) {
                spots.push({
                    segment: floorFunc(rand(1, 7)),
                    offsetY: rand(-0.8, 0.8),
                    size: rand(1, 2.5),
                    color: { h: 0, s: 0, b: 20 }
                });
            }
            break;

        case 'ki-bekko':
            // Black spots on yellow - rarest
            for (let i = 0; i < floorFunc(rand(1, 3)); i++) {
                spots.push({
                    segment: floorFunc(rand(1, 7)),
                    offsetY: rand(-0.8, 0.8),
                    size: rand(1, 2),
                    color: { h: 0, s: 0, b: 20 }
                });
            }
            break;

        // BLUE-SCALED TYPES
        case 'asagi':
        case 'shusui':
            // Red/orange on belly, cheeks, and fins
            for (let i = 0; i < floorFunc(rand(2, 4)); i++) {
                spots.push({
                    segment: floorFunc(rand(2, 6)),
                    offsetY: rand(0.5, 2.2),  // Bottom/belly area
                    size: rand(1.5, 3.5),
                    color: { h: rand(10, 25), s: rand(65, 80), b: rand(70, 80) }
                });
            }
            break;

        // KOROMO & GOSHIKI
        case 'ai-goromo':
            // Kohaku with blue edging on red scales
            for (let i = 0; i < numSpots; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(2, 4),
                    color: { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }
                });
            }
            // Add blue edge spots
            for (let i = 0; i < floorFunc(numSpots * 0.7); i++) {
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.2, 1.2),
                    size: rand(0.8, 1.5),
                    color: { h: rand(210, 230), s: rand(40, 60), b: rand(50, 65) }
                });
            }
            break;

        case 'budo-goromo':
            // Kohaku with grape-maroon edging
            for (let i = 0; i < numSpots; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(2, 4),
                    color: { h: rand(330, 350), s: rand(60, 75), b: rand(50, 65) }
                });
            }
            break;

        case 'goshiki':
            // Five colors - complex intermingled pattern
            for (let i = 0; i < numSpots + 2; i++) {
                let colorChoice = floorFunc(rand(0, 4));
                let spotColor;
                if (colorChoice === 0) {
                    spotColor = { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }; // Red
                } else if (colorChoice === 1) {
                    spotColor = { h: 0, s: 0, b: 20 }; // Black
                } else if (colorChoice === 2) {
                    spotColor = { h: rand(210, 230), s: rand(30, 50), b: rand(50, 70) }; // Blue-gray
                } else {
                    spotColor = { h: 0, s: 0, b: 90 }; // White
                }
                spots.push({
                    segment: floorFunc(rand(0, 7)),
                    offsetY: rand(-1.8, 1.8),
                    size: rand(1.5, 3.5),
                    color: spotColor
                });
            }
            break;

        // SPECIAL & MODERN
        case 'tancho':
            // Single red circle on head only
            spots.push({
                segment: 0,
                offsetY: rand(-0.3, 0.3),
                size: rand(2.5, 3.5),
                color: { h: 0, s: 80, b: 75 }
            });
            break;

        case 'ochiba':
            // Subtle darker spots on gray-brown autumn leaf
            for (let i = 0; i < floorFunc(rand(2, 4)); i++) {
                spots.push({
                    segment: floorFunc(rand(1, 6)),
                    offsetY: rand(-1, 1),
                    size: rand(1.5, 3),
                    color: { h: rand(30, 40), s: rand(35, 45), b: rand(45, 55) }
                });
            }
            break;

        case 'doitsu-kohaku':
        case 'gin-rin-kohaku':
        case 'butterfly-kohaku':
            // Same pattern as regular Kohaku
            for (let i = 0; i < numSpots; i++) {
                spots.push({
                    segment: floorFunc(rand(0, 6)),
                    offsetY: rand(-1.5, 1.5),
                    size: rand(2, 4.5),
                    color: { h: rand(0, 15), s: rand(70, 85), b: rand(70, 80) }
                });
            }
            break;

        // SOLID-COLOR / NATURALISTIC
        case 'chagoi':
            // Solid brown/tea color - minimal or no pattern
            // Very subtle darker patches if any
            if (randomFunc() < 0.3) {
                for (let i = 0; i < floorFunc(rand(1, 2)); i++) {
                    spots.push({
                        segment: floorFunc(rand(1, 6)),
                        offsetY: rand(-1, 1),
                        size: rand(2, 4),
                        color: { h: rand(25, 35), s: rand(40, 50), b: rand(40, 48) }
                    });
                }
            }
            break;

        case 'soragoi':
            // Solid gray - clean, no pattern
            break;

        case 'benigoi':
            // Solid red - no pattern
            break;
    }

    return {
        variety: variety.name,
        baseColor: variety.base,
        spots
    };
}
