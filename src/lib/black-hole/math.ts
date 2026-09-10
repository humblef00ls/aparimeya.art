/** The vector operations needed by camera and phone orientation; no scene graph. */
export class Vector3 {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v: Vector3) {
    return this.set(v.x, v.y, v.z);
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  negate() {
    return this.set(-this.x, -this.y, -this.z);
  }
  dot(v: Vector3) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  distanceTo(v: Vector3) {
    return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  normalize() {
    const n = this.length() || 1;
    return this.set(this.x / n, this.y / n, this.z / n);
  }
  crossVectors(a: Vector3, b: Vector3) {
    return this.set(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x,
    );
  }
  applyQuaternion(q: Quaternion) {
    const { x, y, z } = this;
    const tx = 2 * (q.y * z - q.z * y),
      ty = 2 * (q.z * x - q.x * z),
      tz = 2 * (q.x * y - q.y * x);
    return this.set(
      x + q.w * tx + q.y * tz - q.z * ty,
      y + q.w * ty + q.z * tx - q.x * tz,
      z + q.w * tz + q.x * ty - q.y * tx,
    );
  }
  applyAxisAngle(axis: Vector3, angle: number) {
    return this.applyQuaternion(new Quaternion().setFromAxisAngle(axis, angle));
  }
}

/** Unit quaternions, composed in device Y-X-Z order. */
export class Quaternion {
  x = 0;
  y = 0;
  z = 0;
  w = 1;
  set(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  clone() {
    return new Quaternion().set(this.x, this.y, this.z, this.w);
  }
  invert() {
    return this.set(-this.x, -this.y, -this.z, this.w);
  }
  setFromAxisAngle(axis: Vector3, angle: number) {
    const s = Math.sin(angle / 2);
    return this.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle / 2));
  }
  setFromYXZ(x: number, y: number, z: number) {
    const c1 = Math.cos(x / 2),
      c2 = Math.cos(y / 2),
      c3 = Math.cos(z / 2),
      s1 = Math.sin(x / 2),
      s2 = Math.sin(y / 2),
      s3 = Math.sin(z / 2);
    return this.set(
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 - s1 * s2 * c3,
      c1 * c2 * c3 + s1 * s2 * s3,
    );
  }
  multiply(b: Quaternion) {
    const { x, y, z, w } = this;
    return this.set(
      x * b.w + w * b.x + y * b.z - z * b.y,
      y * b.w + w * b.y + z * b.x - x * b.z,
      z * b.w + w * b.z + x * b.y - y * b.x,
      w * b.w - x * b.x - y * b.y - z * b.z,
    );
  }
}

/** CSS hex colors are display-space sRGB; disk emission uses linear RGB. */
export function hexColor(
  hex: string,
  linear = false,
): [number, number, number] {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  return channels.map((c) =>
    linear ? (c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) : c,
  ) as [number, number, number];
}
