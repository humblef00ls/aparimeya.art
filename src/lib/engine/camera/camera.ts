import { Vector3 } from "$lib/engine/math/vector";

// Camera configuration interface
export interface CameraConfig {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export abstract class Camera {
  protected position: Vector3;
  protected target: Vector3;
  protected up: Vector3;
  protected fov: number;
  protected aspect: number;
  protected near: number;
  protected far: number;
  protected canvasWidth: number = 1920;
  protected canvasHeight: number = 1080;
  
  // Camera orientation in Euler angles (radians)
  protected pitch: number = 0;  // X rotation (looking up/down)
  protected yaw: number = 0;    // Y rotation (looking left/right)
  
  // Cached matrices
  protected viewMatrix: number[] = [];
  protected projectionMatrix: number[] = [];
  protected matricesDirty: boolean = true;

  constructor(config: CameraConfig) {
    this.position = config.position;
    this.target = config.target;
    this.up = config.up;
    this.fov = config.fov;
    this.aspect = config.aspect;
    this.near = config.near;
    this.far = config.far;
    
    // Calculate initial pitch and yaw from target
    this.calculateInitialAngles();
    this.updateMatrices();
  }

  private calculateInitialAngles(): void {
    const direction = this.target.sub(this.position).normalize();
    
    // Calculate yaw (horizontal rotation)
    this.yaw = Math.atan2(direction.x, direction.z);
    
    // Calculate pitch (vertical rotation)
    const horizontalDistance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    this.pitch = Math.atan2(-direction.y, horizontalDistance);
  }

  // Public getters
  getPosition(): Vector3 {
    return this.position;
  }

  getTarget(): Vector3 {
    return this.target;
  }

  getUpVector(): Vector3 {
    return this.up;
  }

  getFov(): number {
    return this.fov;
  }

  getAspect(): number {
    return this.aspect;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.matricesDirty = true;
  }

  setFOV(fov: number): void {
    this.fov = fov;
    this.matricesDirty = true;
  }

  setCanvasDimensions(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  // Get camera basis vectors from view matrix
  getForward(): Vector3 {
    // Forward is the negative Z axis in view space
    return new Vector3(-this.viewMatrix[2], -this.viewMatrix[6], -this.viewMatrix[10]);
  }

  getRight(): Vector3 {
    // Right is the X axis in view space
    return new Vector3(this.viewMatrix[0], this.viewMatrix[4], this.viewMatrix[8]);
  }

  getUpBasis(): Vector3 {
    // Up is the Y axis in view space
    return new Vector3(this.viewMatrix[1], this.viewMatrix[5], this.viewMatrix[9]);
  }
  
  getPitch(): number {
    return this.pitch;
  }
  
  getYaw(): number {
    return this.yaw;
  }

  // Camera movement in world space
  moveTo(position: Vector3): void {
    this.position = position;
    this.updateTargetFromAngles();
    this.matricesDirty = true;
  }

  // Camera rotation
  rotateX(angle: number): void {
    this.pitch += angle;
    // Clamp pitch to prevent gimbal lock
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.updateTargetFromAngles();
    this.matricesDirty = true;
  }

  rotateY(angle: number): void {
    this.yaw += angle;
    this.updateTargetFromAngles();
    this.matricesDirty = true;
  }

  private updateTargetFromAngles(): void {
    // Calculate new target based on current angles and position
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    
    const direction = new Vector3(
      sinYaw * cosPitch,
      -sinPitch,
      cosYaw * cosPitch
    );
    
    // Set target at a fixed distance from position
    const distance = 5; // Fixed look distance
    this.target = this.position.add(direction.mul(distance));
  }

  // Reset camera to initial orientation
  resetRotation(): void {
    this.pitch = 0;
    this.yaw = 0;
    this.updateTargetFromAngles();
    this.matricesDirty = true;
  }

  // Update matrices if needed
  protected updateMatrices(): void {
    if (this.matricesDirty) {
      this.viewMatrix = this.calculateViewMatrix();
      this.projectionMatrix = this.calculateProjectionMatrix();
      this.matricesDirty = false;
    }
  }

  // Calculate view matrix
  protected calculateViewMatrix(): number[] {
    const forward = this.target.sub(this.position).normalize();
    const right = forward.cross(this.up).normalize();
    const up = right.cross(forward);
    
    // View matrix is the inverse of the camera's transformation
    return [
      right.x, up.x, -forward.x, 0,
      right.y, up.y, -forward.y, 0,
      right.z, up.z, -forward.z, 0,
      -right.dot(this.position), -up.dot(this.position), forward.dot(this.position), 1
    ];
  }

  // Calculate projection matrix
  protected calculateProjectionMatrix(): number[] {
    const f = 1.0 / Math.tan(this.fov / 2);
    const rangeInv = 1 / (this.near - this.far);
    
    return [
      f / this.aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (this.near + this.far) * rangeInv, -1,
      0, 0, this.near * this.far * rangeInv * 2, 0
    ];
  }

  // Get camera data for shader uniforms
  getShaderData(): {
    position: [number, number, number];
    forward: [number, number, number];
    up: [number, number, number];
    right: [number, number, number];
    fov: number;
    aspect: number;
    canvasWidth: number;
    canvasHeight: number;
  } {
    this.updateMatrices();
    
    const forward = this.getForward();
    const right = this.getRight();
    const up = this.getUpBasis();

    return {
      position: [this.position.x, this.position.y, this.position.z],
      forward: [forward.x, forward.y, forward.z],
      up: [up.x, up.y, up.z],
      right: [right.x, right.y, right.z],
      fov: this.fov,
      aspect: this.aspect,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight
    };
  }

  // Abstract methods for different camera types
  abstract getProjectionMatrix(): number[];
  abstract getViewMatrix(): number[];
}
