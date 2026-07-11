/**
 * SVG Parser
 * Parses SVG files to extract vertex arrays for koi body parts
 * Supports both <path> and <polygon> elements
 */

export class SVGParser {
    /**
     * Parse SVG file text to vertex array
     * @param {string} svgText - Raw SVG file content
     * @param {number} numPoints - Number of vertices to extract (default: 20 for paths, ignored for polygons)
     * @param {Object} targetDimensions - Target {width, height} for normalization (optional)
     * @returns {Array<{x, y}>|null} - Array of vertex coordinates, or null on error
     */
    static parseSVGFile(svgText, numPoints = 20, targetDimensions = null) {
        try {
            // Parse XML to DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');

            // Check for parsing errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                console.error('SVG parsing error:', parserError.textContent);
                return null;
            }

            // Try to find <polygon> element first (user's body.svg uses polygon)
            let element = doc.querySelector('polygon');
            let vertices = null;

            if (element) {
                // Extract vertices from polygon 'points' attribute
                const points = element.getAttribute('points');
                if (!points) {
                    console.error('SVG polygon missing "points" attribute');
                    return null;
                }
                vertices = this.parsePolygonPoints(points);
            } else {
                // Fall back to <path> element
                element = doc.querySelector('path');
                if (!element) {
                    console.error('SVG contains no <path> or <polygon> element');
                    return null;
                }

                const d = element.getAttribute('d');
                if (!d) {
                    console.error('SVG path missing "d" attribute');
                    return null;
                }

                vertices = this.parsePathData(d, numPoints);
            }

            if (!vertices || vertices.length === 0) {
                console.error('Failed to extract vertices from SVG');
                return null;
            }

            // Normalize coordinates if target dimensions provided
            if (targetDimensions) {
                vertices = this.normalizeVertices(
                    vertices,
                    targetDimensions.width,
                    targetDimensions.height
                );
            }

            return vertices;

        } catch (error) {
            console.error('SVG parsing error:', error);
            return null;
        }
    }

    /**
     * Parse polygon 'points' attribute to vertices
     * Format: "x1,y1 x2,y2 x3,y3..." or "x1 y1 x2 y2 x3 y3..."
     * @param {string} pointsString - Polygon points attribute value
     * @returns {Array<{x, y}>} - Array of vertices
     */
    static parsePolygonPoints(pointsString) {
        const vertices = [];

        // Clean up whitespace and split into individual coordinates
        // Handle both comma-separated and space-separated formats
        const cleaned = pointsString.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
        const coords = cleaned.split(' ').map(n => parseFloat(n));

        // Group into x,y pairs
        for (let i = 0; i < coords.length - 1; i += 2) {
            vertices.push({
                x: coords[i],
                y: coords[i + 1]
            });
        }

        return vertices;
    }

    /**
     * Parse SVG path 'd' attribute to vertices using browser's SVG APIs
     * @param {string} pathData - SVG path 'd' attribute (e.g., "M 10,20 L 30,40 C ...")
     * @param {number} numPoints - Number of vertices to sample along path
     * @returns {Array<{x, y}>} - Sampled vertices
     */
    static parsePathData(pathData, numPoints = 20) {
        try {
            // Create temporary SVG element in DOM
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            svg.appendChild(path);
            svg.style.visibility = 'hidden';
            svg.style.position = 'absolute';
            document.body.appendChild(svg);

            // Sample path at even intervals using browser API
            const length = path.getTotalLength();
            const vertices = [];

            for (let i = 0; i <= numPoints; i++) {
                const point = path.getPointAtLength((i / numPoints) * length);
                vertices.push({ x: point.x, y: point.y });
            }

            // Cleanup
            document.body.removeChild(svg);

            return vertices;

        } catch (error) {
            console.error('Path parsing error:', error);
            return [];
        }
    }

    /**
     * Normalize vertices to target dimensions
     * Centers the shape at origin (0,0) and scales to target width/height
     * @param {Array<{x, y}>} vertices - Raw vertices
     * @param {number} targetWidth - Target width in koi units
     * @param {number} targetHeight - Target height in koi units
     * @returns {Array<{x, y}>} - Normalized vertices centered at origin
     */
    static normalizeVertices(vertices, targetWidth, targetHeight) {
        if (!vertices || vertices.length === 0) {
            return [];
        }

        // Find bounding box
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const currentWidth = maxX - minX;
        const currentHeight = maxY - minY;

        // Calculate scale factors (use uniform scale to preserve aspect ratio)
        const scaleX = targetWidth / currentWidth;
        const scaleY = targetHeight / currentHeight;
        const scale = Math.min(scaleX, scaleY); // Preserve aspect ratio

        // Transform vertices: center at origin and scale
        const centerX = minX + currentWidth / 2;
        const centerY = minY + currentHeight / 2;

        return vertices.map(v => ({
            x: (v.x - centerX) * scale,
            y: (v.y - centerY) * scale
        }));
    }

    /**
     * Load and parse SVG file from URL
     * @param {string} url - URL to SVG file
     * @param {number} numPoints - Number of vertices to extract
     * @param {Object} targetDimensions - Optional {width, height} for normalization
     * @returns {Promise<Array<{x, y}>>} - Resolves to vertex array
     */
    static async loadSVGFromURL(url, numPoints = 20, targetDimensions = null) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load SVG: ${response.statusText}`);
            }
            const svgText = await response.text();
            return this.parseSVGFile(svgText, numPoints, targetDimensions);
        } catch (error) {
            console.error(`Error loading SVG from ${url}:`, error);
            return null;
        }
    }

    /**
     * Get debug info about parsed SVG
     * @param {Array<{x, y}>} vertices - Parsed vertices
     * @returns {Object} - Debug info {vertexCount, bounds, center}
     */
    static getDebugInfo(vertices) {
        if (!vertices || vertices.length === 0) {
            return null;
        }

        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);

        return {
            vertexCount: vertices.length,
            bounds: {
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            },
            center: {
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2
            }
        };
    }
}
