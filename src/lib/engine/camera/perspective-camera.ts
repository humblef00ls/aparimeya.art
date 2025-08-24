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
}
