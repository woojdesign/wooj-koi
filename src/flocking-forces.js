/**
 * Flocking Force Calculations (Simplified for Portfolio)
 * Pure functions for calculating alignment, cohesion, and separation forces
 */

import { PHYSICS_CONFIG } from './physics-config.js';

/**
 * Helper: Calculate distance between two points
 */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find neighbors within perception radius
 */
export function findNeighbors(boid, flock, perceptionRadius) {
    const neighborsWithDistance = [];

    for (let other of flock) {
        if (other === boid) continue;

        const d = dist(
            boid.position.x, boid.position.y,
            other.position.x, other.position.y
        );

        if (d < perceptionRadius) {
            neighborsWithDistance.push({ boid: other, distance: d });
        }
    }

    // Sort by distance and limit to closest neighbors
    neighborsWithDistance.sort((a, b) => a.distance - b.distance);
    const closestNeighbors = neighborsWithDistance.slice(0, PHYSICS_CONFIG.MAX_NEIGHBORS);

    return closestNeighbors.map(n => n.boid);
}

/**
 * Calculate alignment steering force
 * Steer towards the average heading of nearby boids
 */
export function calculateAlignment(boid, neighbors, maxSpeed, maxForce, createVector) {
    let steering = createVector();

    if (neighbors.length === 0) return steering;

    for (let other of neighbors) {
        steering.add(other.velocity);
    }

    steering.div(neighbors.length);
    steering.setMag(maxSpeed);
    steering.sub(boid.velocity);
    steering.limit(maxForce);

    return steering;
}

/**
 * Calculate cohesion steering force
 * Steer towards the center of mass of nearby boids
 */
export function calculateCohesion(boid, neighbors, maxSpeed, maxForce, createVector) {
    let steering = createVector();

    if (neighbors.length === 0) return steering;

    for (let other of neighbors) {
        steering.add(other.position);
    }

    steering.div(neighbors.length);
    steering.sub(boid.position);
    steering.setMag(maxSpeed);
    steering.sub(boid.velocity);
    steering.limit(maxForce);

    return steering;
}

/**
 * Calculate separation steering force
 * Steer away from nearby boids to avoid crowding
 */
export function calculateSeparation(boid, neighbors, perceptionRadius, maxSpeed, maxForce, createVector, p5) {
    let steering = createVector();
    let total = 0;

    for (let other of neighbors) {
        let d = dist(
            boid.position.x, boid.position.y,
            other.position.x, other.position.y
        );

        if (d < perceptionRadius * 0.9) {
            let diff = p5.Vector.sub(boid.position, other.position);

            // Prevent extreme forces when very close
            const minDist = 8;
            if (d < minDist) d = minDist;

            // Linear inverse distance
            diff.normalize();
            diff.div(d);
            steering.add(diff);
            total++;
        }
    }

    if (total > 0) {
        steering.div(total);
        steering.setMag(maxSpeed);
        steering.sub(boid.velocity);
        steering.limit(maxForce);
    }

    return steering;
}

/**
 * Calculate attraction steering force towards a point
 * @param {Object} boid - The boid
 * @param {Object} target - Target position {x, y}
 * @param {number} maxSpeed - Maximum speed
 * @param {number} maxForce - Maximum steering force
 * @param {Function} createVector - createVector function
 * @param {Object} p5 - p5 instance for Vector operations
 * @returns {Object} - Steering force vector
 */
export function calculateAttraction(boid, target, maxSpeed, maxForce, createVector, p5) {
    // Calculate desired velocity towards target
    const targetVec = createVector(target.x, target.y);
    const desired = p5.Vector.sub(targetVec, boid.position);
    const distance = desired.mag();

    // No attraction if too far away (>300 pixels)
    if (distance > 300) {
        return createVector(0, 0);
    }

    // Scale force based on distance (stronger when closer)
    const strength = 1 - (distance / 300);
    desired.setMag(maxSpeed * strength);

    // Calculate steering force
    const steering = p5.Vector.sub(desired, boid.velocity);
    steering.limit(maxForce * 1.5); // Slightly stronger than normal forces

    return steering;
}

/**
 * Calculate escape steering force to break out of oscillation
 * Steer towards a direction 45-90 degrees from current heading
 * @param {Object} boid - The boid
 * @param {number} escapeDirection - Target heading in radians
 * @param {number} maxSpeed - Maximum speed
 * @param {number} maxForce - Maximum steering force
 * @param {Object} p5 - p5 instance for Vector operations
 * @returns {Object} - Steering force vector
 */
export function calculateEscapeForce(boid, escapeDirection, maxSpeed, maxForce, p5) {
    // Create a target velocity in the escape direction
    const targetVelocity = p5.Vector.fromAngle(escapeDirection, maxSpeed * 1.2);

    // Calculate steering force to reach that velocity
    const steering = p5.Vector.sub(targetVelocity, boid.velocity);
    steering.limit(maxForce * 2); // Stronger force to break out of oscillation

    return steering;
}
