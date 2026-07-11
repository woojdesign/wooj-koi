/**
 * Brush Textures
 * Simplified version for portfolio - loads sumi-e brush texture images for koi rendering
 */

export class BrushTextures {
    constructor() {
        this.textures = {
            body: null,
            fin: null,
            tail: null,
            spots: [],
            paper: null
        };
        this.isReady = false;
        this.p5Instance = null;

        // Simple cache to prevent memory leaks
        this.tintCache = new Map();
        this.maxCacheSize = 50;  // Limit cache size for 5 koi
    }

    /**
     * Load brush texture images (called after p5.loadImage)
     * @param {Object} loadedImages - Object containing preloaded p5.Image objects
     */
    loadImages(loadedImages) {
        console.log('Loading sumi-e brush textures...');

        this.textures.body = loadedImages.body;
        this.textures.fin = loadedImages.fin;
        this.textures.tail = loadedImages.tail;
        this.textures.spots = loadedImages.spots || [];
        this.textures.paper = loadedImages.paper;

        this.isReady = true;
        console.log(`Brush textures loaded (${this.textures.spots.length} spot variations)`);
    }

    /**
     * Set p5 instance reference
     * @param {Object} p5 - p5.js instance
     */
    setP5Instance(p5) {
        this.p5Instance = p5;
    }

    /**
     * Get a texture by name
     * @param {string} name - Texture name (body, fin, tail, spots, paper)
     * @returns {Object} - p5 graphics object (or array for 'spots')
     */
    get(name) {
        return this.textures[name];
    }

    /**
     * Get a random spot texture
     * @param {number} seed - Optional seed for consistent random selection
     * @returns {Object} - p5 Image object
     */
    getRandomSpot(seed) {
        if (!this.textures.spots || this.textures.spots.length === 0) {
            return null;
        }

        if (seed !== undefined) {
            const index = Math.floor(seed) % this.textures.spots.length;
            return this.textures.spots[index];
        } else {
            const index = Math.floor(Math.random() * this.textures.spots.length);
            return this.textures.spots[index];
        }
    }

    /**
     * Get the number of available spot textures
     * @returns {number}
     */
    getSpotCount() {
        return this.textures.spots ? this.textures.spots.length : 0;
    }

    /**
     * Get a tinted spot texture (with simple caching)
     * @param {number} spotIndex - Which spot texture (0-4)
     * @param {Object} color - {h, s, b} HSB color to tint to
     * @param {number} alpha - Alpha value (0-255)
     * @param {string} blendMode - Blend mode ('BLEND' or 'MULTIPLY')
     * @returns {p5.Image|p5.Graphics} - Tinted texture
     */
    getTintedSpot(spotIndex, color, alpha, blendMode = 'MULTIPLY') {
        if (!this.p5Instance || !this.textures.spots[spotIndex]) {
            return this.textures.spots[spotIndex];
        }

        // Create cache key (round values to reduce unique keys)
        const h = Math.round(color.h / 10) * 10;
        const s = Math.round(color.s / 10) * 10;
        const b = Math.round(color.b / 10) * 10;
        const a = Math.round(alpha / 20) * 20;
        const cacheKey = `spot_${spotIndex}_${h}_${s}_${b}_${a}_${blendMode}`;

        // Check cache
        if (this.tintCache.has(cacheKey)) {
            return this.tintCache.get(cacheKey);
        }

        // Create tinted texture
        const sourceTexture = this.textures.spots[spotIndex];
        const tinted = this.p5Instance.createGraphics(sourceTexture.width, sourceTexture.height);

        tinted.push();
        tinted.colorMode(tinted.HSB);
        tinted.tint(color.h, color.s, color.b, alpha);
        tinted.blendMode(tinted[blendMode]);
        tinted.image(sourceTexture, 0, 0);
        tinted.noTint();
        tinted.pop();

        // Evict oldest if cache full (simple FIFO)
        if (this.tintCache.size >= this.maxCacheSize) {
            const firstKey = this.tintCache.keys().next().value;
            const removed = this.tintCache.get(firstKey);
            if (removed && removed.remove) {
                removed.remove();
            }
            this.tintCache.delete(firstKey);
        }

        this.tintCache.set(cacheKey, tinted);
        return tinted;
    }

    /**
     * Get a tinted body texture (with simple caching)
     * @param {Object} color - {h, s, b} HSB color to tint to
     * @param {number} alpha - Alpha value (0-255)
     * @returns {p5.Image|p5.Graphics} - Tinted texture
     */
    getTintedBody(color, alpha) {
        if (!this.p5Instance || !this.textures.body) {
            return this.textures.body;
        }

        // Create cache key
        const h = Math.round(color.h / 10) * 10;
        const s = Math.round(color.s / 10) * 10;
        const b = Math.round(color.b / 10) * 10;
        const a = Math.round(alpha / 20) * 20;
        const cacheKey = `body_${h}_${s}_${b}_${a}`;

        // Check cache
        if (this.tintCache.has(cacheKey)) {
            return this.tintCache.get(cacheKey);
        }

        // Create tinted texture
        const tinted = this.p5Instance.createGraphics(
            this.textures.body.width,
            this.textures.body.height
        );

        tinted.push();
        tinted.colorMode(tinted.HSB);
        tinted.tint(color.h, color.s, color.b, alpha);
        tinted.blendMode(tinted.BLEND);
        tinted.image(this.textures.body, 0, 0);
        tinted.noTint();
        tinted.pop();

        // Evict oldest if cache full
        if (this.tintCache.size >= this.maxCacheSize) {
            const firstKey = this.tintCache.keys().next().value;
            const removed = this.tintCache.get(firstKey);
            if (removed && removed.remove) {
                removed.remove();
            }
            this.tintCache.delete(firstKey);
        }

        this.tintCache.set(cacheKey, tinted);
        return tinted;
    }
}
