// Illustrative, transparent gravity well: y = -2 - 9 / (1 + 0.08 r²).
// Its implicit equation is cubic along a ray. Splitting at derivative roots
// gives monotone intervals, so every crossing can be found without march gaps.
float gridPolynomial(vec4 c, float t) {
  return ((c.x * t + c.y) * t + c.z) * t + c.w;
}

float gridLine(vec3 point, vec3 direction, float distanceFromCamera) {
  float radius = length(point.xz);
  vec2 lineDistance = abs(fract(point.xz / 1.5 + 0.5) - 0.5) * 1.5;
  float denominator = 1.0 + 0.08 * radius * radius;
  vec2 gradient = 1.44 * point.xz / (denominator * denominator);
  vec3 normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
  float grazing = max(0.08, abs(dot(normal, direction)));
  float pixelWidth = max(0.018, distanceFromCamera * uFov / (uResolution.y * grazing));
  float line = 1.0 - smoothstep(pixelWidth * 0.5, pixelWidth * 1.5, min(lineDistance.x, lineDistance.y));
  float fade = (1.0 - smoothstep(16.0, 23.0, radius)) * smoothstep(0.7, 1.3, radius);
  return line * fade * 0.7;
}

vec3 gravityGrid(vec3 origin, vec3 direction) {
  // Bound the surface itself, not the camera distance. All visible grid points
  // fit inside this sphere, including when the camera is at maximum zoom-out.
  float b = dot(origin, direction);
  float discriminant = b * b - dot(origin, origin) + 625.0;
  if (discriminant <= 0.0) return vec3(0.0);
  float nearT = max(0.0, -b - sqrt(discriminant));
  float farT = -b + sqrt(discriminant);
  if (farT <= nearT) return vec3(0.0);
  vec3 start = origin + direction * nearT;
  float span = farT - nearT;
  float q0 = 1.0 + 0.08 * dot(start.xz, start.xz);
  float q1 = 0.16 * dot(start.xz, direction.xz);
  float q2 = 0.08 * dot(direction.xz, direction.xz);
  vec4 c = vec4(direction.y * q2, (start.y + 2.0) * q2 + direction.y * q1,
    (start.y + 2.0) * q1 + direction.y * q0, (start.y + 2.0) * q0 + 9.0);
  float cuts[4];
  cuts[0] = 0.0;
  int count = 1;
  float a = 3.0 * c.x;
  float d = 2.0 * c.y;
  if (abs(a) < 0.000001) {
    if (abs(d) > 0.000001) {
      float root = -c.z / d;
      if (root > 0.0 && root < span) { cuts[count] = root; count++; }
    }
  } else {
    float det = d * d - 4.0 * a * c.z;
    if (det > 0.0) {
      float r1 = (-d - sqrt(det)) / (2.0 * a);
      float r2 = (-d + sqrt(det)) / (2.0 * a);
      float low = min(r1, r2), high = max(r1, r2);
      if (low > 0.0 && low < span) { cuts[count] = low; count++; }
      if (high > 0.0 && high < span) { cuts[count] = high; count++; }
    }
  }
  cuts[count] = span;
  float coverage = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= count) break;
    float low = cuts[i], high = cuts[i + 1];
    float lowValue = gridPolynomial(c, low);
    if (lowValue * gridPolynomial(c, high) > 0.0) continue;
    for (int j = 0; j < 18; j++) {
      float mid = (low + high) * 0.5;
      float value = gridPolynomial(c, mid);
      if (value * lowValue > 0.0) { low = mid; lowValue = value; }
      else high = mid;
    }
    float t = (low + high) * 0.5;
    float line = gridLine(start + direction * t, direction, nearT + t);
    // Gaps are transparent: a near crossing must not hide the far wall/bottom.
    coverage += (1.0 - coverage) * line;
  }
  return vec3(0.13, 0.32, 0.48) * coverage;
}
