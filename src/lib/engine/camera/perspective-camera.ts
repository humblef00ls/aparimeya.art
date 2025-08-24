import { Camera, type CameraConfig } from './camera';
import { Vector3 } from '$lib/engine/math/vector';

export class PerspectiveCamera extends Camera {
  constructor(config: CameraConfig) {
    super(config);
  }

  getProjectionMatrix(): number[] {
    // Force update matrices and return projection matrix
    this.updateMatrices();
    return this.projectionMatrix;
  }

  getViewMatrix(): number[] {
    // Force update matrices and return view matrix
    this.updateMatrices();
    return this.viewMatrix;
  }

  // Create a default perspective camera
  static createDefault(): PerspectiveCamera {
    return new PerspectiveCamera({
      position: new Vector3(0, 0, -5),
      target: new Vector3(0, 0, 0),
      up: Vector3.up(),
      fov: Math.PI / 4, // 45 degrees
      aspect: 16 / 9,
      near: 0.1,
      far: 1000
    });
  }
}
