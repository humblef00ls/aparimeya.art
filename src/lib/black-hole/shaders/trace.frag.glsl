precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uTraceResolution;
uniform int uSamples;
uniform int uRingSamples;
uniform vec3 uCamera;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uTime;
uniform float uLensing;
uniform float uDoppler;
uniform float uStars;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uFov;
uniform vec3 uDiskColor;
uniform float uDiskTexture;
uniform float uDiskScale;
uniform float uDiskBrightness;
uniform float uStarSize;
uniform float uStarVariation;
uniform float uStarDensity;

// Shader modules are composed explicitly in renderer.ts (no custom bundler plugin).
/* NOISE */
/* DISK */
/* SKY */

// Schwarzschild null-orbit equation in Cartesian orbital coordinates:
// d²x/dλ² = -3/2 r_s L² x / |x|⁵, with r_s = 1.
// This integrates spatial paths; coordinate time and Kerr frame dragging are omitted.
vec3 acceleration(vec3 position, float angularMomentumSquared) {
  float radiusSquared = dot(position, position);
  return -1.5 * uLensing * angularMomentumSquared * position /
    (radiusSquared * radiusSquared * sqrt(radiusSquared));
}

vec4 traceRay(vec2 uv) {
  vec2 screen = uv * 2.0 - 1.0;
  screen.x *= uResolution.x / uResolution.y;
  vec3 direction = normalize(uForward + uFov * (screen.x * uRight + screen.y * uUp));
  vec3 position = uCamera;
  // Convert a static observer's local viewing direction to orbital coordinates.
  // The radial tetrad component carries sqrt(1-r_s/r); angular components do not.
  vec3 radial = normalize(position);
  float radialScale = sqrt(1.0 - 1.0 / length(position));
  vec3 velocity = direction + radial * dot(direction, radial) * (radialScale - 1.0) * uLensing;
  vec3 angularMomentum = cross(position, velocity);
  float angularMomentumSquared = dot(angularMomentum, angularMomentum);
  vec3 force = acceleration(position, angularMomentumSquared);
  vec3 radiance = vec3(0.0);
  float transmission = 1.0;
  bool escaped = false;
  bool captured = false;
  float pathLength = 0.0;

  // Velocity Verlet: shrink steps near the horizon, take larger steps in empty space.
  for (int i = 0; i < 320; i++) {
    float radius = length(position);
    if (radius < 1.015) { captured = true; break; }
    if (transmission < 0.025) break;
    // Distant observers must travel inward before a ray can escape.
    if (radius > 65.0 && dot(position, velocity) > 0.0) { escaped = true; break; }
    float stepSize = clamp(radius * mix(0.035, 0.075, smoothstep(2.0, 6.0, radius)), 0.035, 1.4);
    pathLength += stepSize;
    vec3 nextPosition = position + velocity * stepSize + 0.5 * force * stepSize * stepSize;
    vec3 nextForce = acceleration(nextPosition, angularMomentumSquared);
    vec3 nextVelocity = velocity + 0.5 * (force + nextForce) * stepSize;

    // Interpolate the plane crossing rather than depending on the integration step
    // landing inside a very thin disk. Multiple crossings produce higher-order images.
    if (position.y * nextPosition.y < 0.0) {
      float fraction = position.y / (position.y - nextPosition.y);
      vec3 hit = mix(position, nextPosition, fraction);
      float diskRadius = length(hit.xz);
      if (diskRadius > uDiskInner && diskRadius < uDiskOuter) {
        vec4 emission = diskEmission(hit, mix(velocity, nextVelocity, fraction), pathLength * uFov / uResolution.y);
        radiance += transmission * emission.rgb;
        transmission *= 1.0 - emission.a;
      }
    }
    position = nextPosition;
    velocity = nextVelocity;
    force = nextForce;
  }
  if (escaped && uStars > 0.5) radiance += transmission * starField(normalize(velocity));
  return vec4(radiance, captured ? 0.0 : transmission);
}

void main() {
  vec4 radiance = vec4(0.0);
  // Spend extra coverage on the narrow higher-order images near the critical impact
  // parameter (3 sqrt(3) / 2). Uniform supersampling wastes most rays on empty sky.
  vec2 screen = vUv * 2.0 - 1.0;
  screen.x *= uResolution.x / uResolution.y;
  vec3 centerDirection = normalize(uForward + uFov * (screen.x * uRight + screen.y * uUp));
  float observerRadius = length(uCamera);
  float impact = length(cross(uCamera, centerDirection)) / sqrt(1.0 - 1.0 / observerRadius);
  float footprint = 2.0 * observerRadius * uFov / uResolution.y;
  bool critical = uLensing > 0.5 && uRingSamples > uSamples && abs(impact - 2.65) < 0.10 + footprint;
  int sampleCount = critical ? uRingSamples : uSamples;
  float side = sqrt(float(sampleCount));
  for (int sampleIndex = 0; sampleIndex < 36; sampleIndex++) {
    if (sampleIndex >= sampleCount) break;
    vec2 offset = (vec2(mod(float(sampleIndex), side), floor(float(sampleIndex) / side)) + 0.5) / side - 0.5;
    if (sampleCount == 2) offset = sampleIndex == 0 ? vec2(-0.25, -0.25) : vec2(0.25, 0.25);
    radiance += traceRay(vUv + offset / uTraceResolution);
  }
  gl_FragColor = radiance / float(sampleCount);
}
