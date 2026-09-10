// Pipeline constants come from model.ts; statistics and shader coverage stay in sync.
override raySamples: i32 = 2;
override ringSamples: i32 = 16;

// Schwarzschild null-orbit equation in Cartesian orbital coordinates:
// d²x/dλ² = -3/2 r_s L² x / |x|⁵, with r_s = 1.
// This integrates spatial paths; coordinate time and Kerr frame dragging are omitted.
fn acceleration(position: vec3f, angularMomentumSquared: f32) -> vec3f {
  var radiusSquared: f32 = dot(position, position);
  return -1.5 * u.lensing * angularMomentumSquared * position /
    (radiusSquared * radiusSquared * sqrt(radiusSquared));
}

fn traceRay(uv: vec2f) -> vec4f {
  var screen: vec2f = uv * 2.0 - vec2f(1.0);
  screen.x *= u.resolution.x / u.resolution.y;
  var direction: vec3f = normalize(u.forward + u.tanHalfFov * (screen.x * u.right + screen.y * u.up));
  var position: vec3f = u.cameraPosition;
  // Convert a static observer's local viewing direction to orbital coordinates.
  // The radial tetrad component carries sqrt(1-r_s/r); angular components do not.
  var radial: vec3f = normalize(position);
  var radialScale: f32 = sqrt(1.0 - 1.0 / length(position));
  var velocity: vec3f = direction + radial * dot(direction, radial) * (radialScale - 1.0) * u.lensing;
  var angularMomentum: vec3f = cross(position, velocity);
  var angularMomentumSquared: f32 = dot(angularMomentum, angularMomentum);
  var force: vec3f = acceleration(position, angularMomentumSquared);
  var radiance: vec3f = vec3f(0.0);
  var transmission: f32 = 1.0;
  var escaped: bool = false;
  var captured: bool = false;
  var pathLength: f32 = 0.0;

  // Velocity Verlet: shrink steps near the horizon, take larger steps in empty space.
  for (var i: i32 = 0; i < 320; i++) {
    var radius: f32 = length(position);
    if (radius < 1.015) { captured = true; break; }
    if (transmission < 0.025) { break; }
    // Distant observers must travel inward before a ray can escape.
    if (radius > 65.0 && dot(position, velocity) > 0.0) { escaped = true; break; }
    var stepSize: f32 = clamp(radius * mix(0.035, 0.075, smoothstep(2.0, 6.0, radius)), 0.035, 1.4);
    pathLength += stepSize;
    var nextPosition: vec3f = position + velocity * stepSize + 0.5 * force * stepSize * stepSize;
    var nextForce: vec3f = acceleration(nextPosition, angularMomentumSquared);
    var nextVelocity: vec3f = velocity + 0.5 * (force + nextForce) * stepSize;

    // Interpolate the plane crossing rather than depending on the integration step
    // landing inside a very thin disk. Multiple crossings produce higher-order images.
    if (position.y * nextPosition.y < 0.0) {
      var fraction: f32 = position.y / (position.y - nextPosition.y);
      var hit: vec3f = mix(position, nextPosition, fraction);
      var diskRadius: f32 = length(hit.xz);
      if (diskRadius > u.diskInner && diskRadius < u.diskOuter) {
        var emission: vec4f = diskEmission(hit, mix(velocity, nextVelocity, fraction), pathLength * u.tanHalfFov / u.resolution.y);
        radiance += transmission * emission.rgb;
        transmission *= 1.0 - emission.a;
      }
    }
    position = nextPosition;
    velocity = nextVelocity;
    force = nextForce;
  }
  if (escaped && u.stars > 0.5) { radiance += transmission * starField(normalize(velocity)); }
  return vec4f(radiance, select(transmission, 0.0, captured));
}

@fragment fn main(@location(0) vUv: vec2f) -> @location(0) vec4f {
  var radiance: vec4f = vec4f(0.0);
  // Spend extra coverage on the narrow higher-order images near the critical impact
  // parameter (3 sqrt(3) / 2). Uniform supersampling wastes most rays on empty sky.
  var screen: vec2f = vUv * 2.0 - vec2f(1.0);
  screen.x *= u.resolution.x / u.resolution.y;
  var centerDirection: vec3f = normalize(u.forward + u.tanHalfFov * (screen.x * u.right + screen.y * u.up));
  var observerRadius: f32 = length(u.cameraPosition);
  var impact: f32 = length(cross(u.cameraPosition, centerDirection)) / sqrt(1.0 - 1.0 / observerRadius);
  var footprint: f32 = 2.0 * observerRadius * u.tanHalfFov / u.resolution.y;
  var critical: bool = u.lensing > 0.5 && ringSamples > raySamples && abs(impact - 2.65) < 0.10 + footprint;
  var sampleCount: i32 = select(raySamples, ringSamples, critical);
  var side: f32 = sqrt(f32(sampleCount));
  for (var sampleIndex: i32 = 0; sampleIndex < 36; sampleIndex++) {
    if (sampleIndex >= sampleCount) { break; }
    var offset: vec2f = (vec2f((f32(sampleIndex) - side * floor(f32(sampleIndex) / side)), floor(f32(sampleIndex) / side)) + vec2f(0.5)) / side - vec2f(0.5);
    if (sampleCount == 2) { offset = select(vec2f(0.25, 0.25), vec2f(-0.25, -0.25), sampleIndex == 0); }
    radiance += traceRay(vUv + offset / u.traceResolution);
  }
  return radiance / f32(sampleCount);
}
