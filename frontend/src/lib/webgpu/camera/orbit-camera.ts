/**
 * Orbit camera using spherical coordinates.
 * Supports rotation around a target point, zoom, and panning.
 */

import { mat4, vec3 } from "gl-matrix";

export class OrbitCamera {
  /** Camera target (look-at point) */
  private target: vec3 = vec3.fromValues(0, 0, 0);

  /** Distance from target */
  private distance = 5;

  /** Horizontal angle (azimuth) in radians - start at π to face front of scene */
  private azimuth = Math.PI;

  /** Vertical angle (elevation) in radians */
  private elevation = 0;

  /** Field of view in degrees */
  private fov = 60;

  /** Near clipping plane */
  private near = 0.1;

  /** Far clipping plane */
  private far = 1000;

  /** Aspect ratio (width / height) */
  private aspect = 1;

  /** Cached view matrix */
  private viewMatrix = mat4.create();

  /** Cached projection matrix */
  private projectionMatrix = mat4.create();

  /** Whether matrices need recalculation */
  private dirty = true;

  /** Minimum distance from target */
  private minDistance = 0.1;

  /** Maximum distance from target */
  private maxDistance = 100;

  /** Minimum elevation angle (radians) */
  private minElevation = -Math.PI / 2 + 0.01;

  /** Maximum elevation angle (radians) */
  private maxElevation = Math.PI / 2 - 0.01;

  constructor() {
    this.updateMatrices();
  }

  /**
   * Get camera position in world space.
   */
  getPosition(): vec3 {
    const y = this.distance * Math.sin(this.elevation);
    const xzDist = this.distance * Math.cos(this.elevation);
    const x = xzDist * Math.sin(this.azimuth);
    const z = xzDist * Math.cos(this.azimuth);

    return vec3.fromValues(
      this.target[0] + x,
      this.target[1] + y,
      this.target[2] + z
    );
  }

  /**
   * Get the camera's right vector.
   */
  getRightVector(): vec3 {
    // Right = cross(forward, up)
    const forward = this.getForwardVector();
    const up = vec3.fromValues(0, 1, 0);
    const right = vec3.create();
    vec3.cross(right, forward, up);
    vec3.normalize(right, right);
    return right;
  }

  /**
   * Get the camera's up vector in world space.
   */
  getUpVector(): vec3 {
    const forward = this.getForwardVector();
    const right = this.getRightVector();
    const up = vec3.create();
    vec3.cross(up, right, forward);
    vec3.normalize(up, up);
    return up;
  }

  /**
   * Get the camera's forward vector (pointing toward target).
   */
  getForwardVector(): vec3 {
    const pos = this.getPosition();
    const forward = vec3.create();
    vec3.subtract(forward, this.target, pos);
    vec3.normalize(forward, forward);
    return forward;
  }

  /**
   * Rotate camera around target.
   */
  orbit(deltaAzimuth: number, deltaElevation: number): void {
    this.azimuth += deltaAzimuth;
    this.elevation = clamp(
      this.elevation + deltaElevation,
      this.minElevation,
      this.maxElevation
    );
    this.dirty = true;
  }

  /**
   * Zoom in/out (adjust distance).
   * @param delta Positive = zoom in, negative = zoom out
   */
  zoom(delta: number): void {
    this.distance = clamp(
      this.distance * (1 - delta),
      this.minDistance,
      this.maxDistance
    );
    this.dirty = true;
  }

  /**
   * Pan camera (move target perpendicular to view direction).
   */
  pan(deltaX: number, deltaY: number): void {
    const right = this.getRightVector();
    const up = this.getUpVector();

    // Scale pan speed by distance
    const panScale = this.distance * 0.5;

    vec3.scaleAndAdd(this.target, this.target, right, -deltaX * panScale);
    vec3.scaleAndAdd(this.target, this.target, up, deltaY * panScale);
    this.dirty = true;
  }

  /**
   * Set viewport aspect ratio.
   */
  setAspect(aspect: number): void {
    if (this.aspect !== aspect) {
      this.aspect = aspect;
      this.dirty = true;
    }
  }

  /**
   * Set camera target.
   */
  setTarget(x: number, y: number, z: number): void {
    vec3.set(this.target, x, y, z);
    this.dirty = true;
  }

  /**
   * Set camera distance from target.
   */
  setDistance(distance: number): void {
    this.distance = clamp(distance, this.minDistance, this.maxDistance);
    this.dirty = true;
  }

  /**
   * Get view matrix (world -> camera space).
   */
  getViewMatrix(): Float32Array {
    if (this.dirty) this.updateMatrices();
    return this.viewMatrix as Float32Array;
  }

  /**
   * Get projection matrix (camera -> clip space).
   */
  getProjectionMatrix(): Float32Array {
    if (this.dirty) this.updateMatrices();
    return this.projectionMatrix as Float32Array;
  }

  /**
   * Get camera distance from target.
   */
  getDistance(): number {
    return this.distance;
  }

  /**
   * Get field of view in degrees.
   */
  getFov(): number {
    return this.fov;
  }

  /**
   * Check if camera has moved since last query.
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Mark camera as clean after processing movement.
   */
  clearDirty(): void {
    this.dirty = false;
  }

  /**
   * Reset camera to default position.
   */
  reset(): void {
    vec3.set(this.target, 0, 0, 0);
    this.distance = 5;
    this.azimuth = Math.PI;
    this.elevation = 0;
    this.dirty = true;
  }

  /**
   * Fit camera to view a bounding sphere.
   */
  fitToBounds(center: vec3, radius: number): void {
    vec3.copy(this.target, center);

    // Calculate distance to fit sphere in view
    const fovRad = (this.fov * Math.PI) / 180;
    this.distance = radius / Math.sin(fovRad / 2);
    this.distance = clamp(this.distance, this.minDistance, this.maxDistance);

    this.dirty = true;
  }

  /**
   * Recalculate view and projection matrices.
   */
  private updateMatrices(): void {
    const pos = this.getPosition();

    mat4.lookAt(
      this.viewMatrix,
      pos,
      this.target,
      [0, 1, 0] // Up vector
    );

    mat4.perspective(
      this.projectionMatrix,
      (this.fov * Math.PI) / 180,
      this.aspect,
      this.near,
      this.far
    );

    this.dirty = false;
  }
}

/**
 * Clamp value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
