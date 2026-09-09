// An illustrative gravity well, not a metric embedding or an extra gravitating object.
float gridHeight(float radius) { return -2.0 - 9.0 / (1.0 + radius * radius * 0.08); }

vec3 gravityGrid(vec3 origin, vec3 direction) {
  float previousT = 0.0;
  float previous = origin.y - gridHeight(length(origin.xz));
  for (int i = 1; i <= 100; i++) {
    float t = float(i) * 0.8;
    vec3 point = origin + direction * t;
    float distanceToSurface = point.y - gridHeight(length(point.xz));
    if (previous * distanceToSurface < 0.0) {
      // Refine the intersection so the funnel and its thin grid lines remain stable.
      float lowT = previousT;
      float highT = t;
      float lowValue = previous;
      for (int j = 0; j < 7; j++) {
        float mid = (lowT + highT) * 0.5;
        vec3 samplePoint = origin + direction * mid;
        float value = samplePoint.y - gridHeight(length(samplePoint.xz));
        if (value * lowValue > 0.0) { lowT = mid; lowValue = value; }
        else highT = mid;
      }
      point = origin + direction * ((lowT + highT) * 0.5);
      float radius = length(point.xz);
      vec2 lineDistance = abs(fract(point.xz / 1.5 + 0.5) - 0.5) * 1.5;
      float denominator = 1.0 + 0.08 * radius * radius;
      vec2 gradient = 1.44 * point.xz / (denominator * denominator);
      vec3 normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
      float grazing = max(0.08, abs(dot(normal, direction)));
      float pixelWidth = max(0.018, t * uFov / (uResolution.y * grazing));
      float line = 1.0 - smoothstep(pixelWidth * 0.5, pixelWidth * 1.5, min(lineDistance.x, lineDistance.y));
      float fade = (1.0 - smoothstep(16.0, 23.0, radius)) * smoothstep(0.7, 1.3, radius);
      return vec3(0.13, 0.32, 0.48) * line * fade * 0.7;
    }
    previous = distanceToSurface;
    previousT = t;
  }
  return vec3(0.0);
}
