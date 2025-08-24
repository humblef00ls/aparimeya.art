export class Vector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // Basic arithmetic operations
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  sub(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  mul(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  div(scalar: number): Vector3 {
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  // Vector operations
  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return new Vector3();
    return this.div(len);
  }

  // Utility methods
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  // Static factory methods
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  static up(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  static down(): Vector3 {
    return new Vector3(0, -1, 0);
  }

  static left(): Vector3 {
    return new Vector3(-1, 0, 0);
  }

  static right(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  static forward(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  static backward(): Vector3 {
    return new Vector3(0, 0, -1);
  }
}
