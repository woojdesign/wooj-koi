/**
 * Boid — a single koi.
 *
 * Bend-to-turn motion: the fish keeps its own `heading` and turns it toward the
 * direction the flocking forces want, at a rate capped by its speed. Because the
 * turn rate is limited, the heading physically cannot oscillate — which removes the
 * wobble the old velocity-vector model had, and with it the damping / oscillation-
 * detection / escape hacks that were bolted on to fight that wobble. The angular
 * velocity produced each frame also drives the body's bend in the renderer.
 */

import { selectVariety, generatePattern } from './koi-varieties.js';
import { PHYSICS_CONFIG } from './physics-config.js';

export class Boid {
    constructor(width, height, randomFunc, createVectorFunc, floorFunc, p5Instance) {
        // Physics
        this.position = createVectorFunc(randomFunc(width), randomFunc(height));
        this.velocity = p5Instance.Vector.random2D();
        this.velocity.setMag(randomFunc(0.5, 1.5));
        this.acceleration = createVectorFunc();
        this.perceptionRadius = PHYSICS_CONFIG.PERCEPTION_RADIUS;

        // Bend-to-turn: heading + speed tracked apart from the velocity vector.
        this.heading = this.velocity.heading();
        this.speed = this.velocity.mag();
        this.angularVelocity = 0;
        this.wanderHeading = this.heading; // where it steers while broken off
        this.wavePhase = 0; // swimming-wiggle phase — advances with speed, so a slow fish wiggles slowly

        // Force smoothing — steadies the *desired* direction frame to frame.
        this.previousSeparation = createVectorFunc();
        this.previousAlignment = createVectorFunc();
        this.previousCohesion = createVectorFunc();

        // Independence — occasional solo drifting, for natural variation.
        this.isIndependent = false;
        this.independenceEndTime = 0;
        this.nextIndependenceCheckTime = Date.now() + randomFunc(
            PHYSICS_CONFIG.INDEPENDENCE_CHECK_MIN,
            PHYSICS_CONFIG.INDEPENDENCE_CHECK_MAX
        );
        this.independenceChance = randomFunc(
            PHYSICS_CONFIG.INDEPENDENCE_CHANCE_MIN,
            PHYSICS_CONFIG.INDEPENDENCE_CHANCE_MAX
        );

        // Koi appearance
        const variety = selectVariety(randomFunc);
        this.variety = variety;
        this.pattern = generatePattern(variety, randomFunc, floorFunc);
        this.color = variety.base;

        // Size variations
        this.sizeMultiplier = randomFunc(0.6, 1.4);
        this.lengthMultiplier = randomFunc(0.85, 1.25);
        this.tailLength = randomFunc(0.9, 1.8);
        this.speedMultiplier = randomFunc(0.6, 1.3);

        // Animation offset — each koi undulates at a different phase.
        this.animationOffset = randomFunc(0, Math.PI * 2);
    }

    /**
     * Blend flocking forces into acceleration (the desired direction). Smoothing and
     * separation priority keep the *target* steady; the rate-limited turn in update()
     * turns the body toward it gracefully.
     */
    applyForces(forces, neighborCount = 0) {
        const { separation, alignment, cohesion, attraction } = forces;

        const smoothing = PHYSICS_CONFIG.FORCE_SMOOTHING;
        const smoothedSeparation = this.lerpVector(this.previousSeparation, separation, smoothing);
        const smoothedAlignment = this.lerpVector(this.previousAlignment, alignment, smoothing);
        const smoothedCohesion = this.lerpVector(this.previousCohesion, cohesion, smoothing);

        // Dead zone: ignore very small forces to prevent micro-steering.
        const dz = PHYSICS_CONFIG.DEAD_ZONE_THRESHOLD;
        if (smoothedAlignment.mag() < dz) smoothedAlignment.set(0, 0);
        if (smoothedCohesion.mag() < dz) smoothedCohesion.set(0, 0);
        if (smoothedSeparation.mag() < dz) smoothedSeparation.set(0, 0);

        // When crowded, let separation dominate so fish don't fight themselves.
        const sepMag = smoothedSeparation.mag();
        let aW = 1.0, cW = 1.0, sW = 1.0;
        if (sepMag > PHYSICS_CONFIG.SEPARATION_HIGH_THRESHOLD) {
            sW = PHYSICS_CONFIG.PRIORITIZE_HIGH.separation;
            aW = PHYSICS_CONFIG.PRIORITIZE_HIGH.alignment;
            cW = PHYSICS_CONFIG.PRIORITIZE_HIGH.cohesion;
        } else if (sepMag > PHYSICS_CONFIG.SEPARATION_MED_THRESHOLD) {
            sW = PHYSICS_CONFIG.PRIORITIZE_MEDIUM.separation;
            aW = PHYSICS_CONFIG.PRIORITIZE_MEDIUM.alignment;
            cW = PHYSICS_CONFIG.PRIORITIZE_MEDIUM.cohesion;
        }
        smoothedAlignment.mult(aW);
        smoothedCohesion.mult(cW);
        smoothedSeparation.mult(sW);

        // Store RAW forces for next frame's smoothing.
        if (separation && separation.copy) this.previousSeparation = separation.copy();
        if (alignment && alignment.copy) this.previousAlignment = alignment.copy();
        if (cohesion && cohesion.copy) this.previousCohesion = cohesion.copy();

        this.acceleration.add(smoothedSeparation);
        this.acceleration.add(smoothedAlignment);
        this.acceleration.add(smoothedCohesion);
        if (attraction && attraction.mag && attraction.mag() > 0) {
            this.acceleration.add(attraction);
        }
    }

    /**
     * Bend-to-turn update: steer the heading toward the desired direction at a
     * capped, speed-scaled rate; ease speed; rebuild velocity from heading + speed.
     */
    update(maxSpeed, randomFunc = Math.random) {
        this.updateIndependence(randomFunc);

        const V = this.velocity.constructor; // p5.Vector
        const topSpeed = maxSpeed * this.speedMultiplier;

        // Where does it want to go? Normally the flocking forces decide. But when it
        // has broken off (independent), it steers to its own wander heading and
        // meanders solo — so the school sheds a fish now and then instead of locking
        // into a single-file line forever.
        let desiredHeading, desiredSpeed;
        if (this.isIndependent) {
            this.wanderHeading += (randomFunc() - 0.5) * 0.03; // gentle solo meander
            desiredHeading = this.wanderHeading;
            desiredSpeed = topSpeed * 0.7;
        } else {
            const target = this.velocity.copy().add(this.acceleration);
            desiredHeading = target.heading();
            desiredSpeed = Math.min(target.mag(), topSpeed);
            desiredSpeed = Math.max(desiredSpeed, topSpeed * PHYSICS_CONFIG.MIN_SPEED_FRACTION);
        }

        // Shortest signed angle to the desired heading.
        let diff = desiredHeading - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Cap the turn rate, scaled by speed (faster => wider arcs). This is the whole
        // trick: the heading cannot jump, so it cannot wobble.
        const speedFactor = 0.35 + 0.65 * Math.min(1, this.speed / topSpeed);
        const maxTurn = PHYSICS_CONFIG.MAX_TURN_RATE * speedFactor;
        let requested = diff * PHYSICS_CONFIG.TURN_RESPONSIVENESS;
        // Turn dead-zone: within a few degrees of the desired heading, don't steer at
        // all — this kills the sub-degree back-and-forth chatter near equilibrium.
        if (Math.abs(diff) < PHYSICS_CONFIG.TURN_DEADZONE) requested = 0;
        let clamped = Math.max(-maxTurn, Math.min(maxTurn, requested));
        // Low-pass the turn rate so it can't flip sign frame to frame (steadies the wobble).
        clamped = this.angularVelocity + (clamped - this.angularVelocity) * PHYSICS_CONFIG.ANGVEL_SMOOTHING;
        this.angularVelocity = clamped;
        this.heading += this.angularVelocity;

        // Ease speed toward its target.
        this.speed += (desiredSpeed - this.speed) * PHYSICS_CONFIG.SPEED_SMOOTHING;

        // Advance the swimming wiggle by how fast the fish is actually moving, so the
        // tail-beat matches the pace (slow fish wiggle slowly, not frantically).
        this.wavePhase += this.speed * PHYSICS_CONFIG.WAVE_RATE;

        // Velocity follows heading + speed; advance; clear forces.
        this.velocity = V.fromAngle(this.heading, this.speed);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
    }

    /**
     * Occasionally break off to drift solo (natural variation).
     */
    updateIndependence(randomFunc) {
        const now = Date.now();
        if (this.isIndependent) {
            if (now >= this.independenceEndTime) {
                this.isIndependent = false;
                this.nextIndependenceCheckTime = now + randomFunc(
                    PHYSICS_CONFIG.INDEPENDENCE_CHECK_MIN, PHYSICS_CONFIG.INDEPENDENCE_CHECK_MAX);
            }
        } else if (now >= this.nextIndependenceCheckTime) {
            if (randomFunc() < this.independenceChance) {
                this.isIndependent = true;
                this.independenceEndTime = now + randomFunc(
                    PHYSICS_CONFIG.INDEPENDENCE_DURATION_MIN, PHYSICS_CONFIG.INDEPENDENCE_DURATION_MAX);
                // Peel off to one side to break the line.
                this.wanderHeading = this.heading + (randomFunc() > 0.5 ? 1 : -1) * randomFunc(0.6, 1.5);
            } else {
                this.nextIndependenceCheckTime = now + randomFunc(
                    PHYSICS_CONFIG.INDEPENDENCE_CHECK_MIN, PHYSICS_CONFIG.INDEPENDENCE_CHECK_MAX);
            }
        }
    }

    getIsIndependent() { return this.isIndependent; }

    // Kept for FlockManager compatibility; the bend-to-turn model never escapes.
    getIsEscaping() { return false; }
    getEscapeDirection() { return null; }

    /**
     * Wrap edges — koi reappear on the opposite side.
     */
    edges(width, height) {
        if (this.position.x > width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = width;
        if (this.position.y > height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = height;
    }

    lerpVector(a, b, amt) {
        const result = a.copy();
        result.lerp(b, amt);
        return result;
    }
}
