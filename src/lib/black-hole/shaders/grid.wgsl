// Illustrative, transparent gravity well: y = -2 - 9 / (1 + 0.08 r²).
// Its implicit equation is cubic along a ray. Splitting at derivative roots
// gives monotone intervals, so every crossing can be found without march gaps.
fn gridPolynomial(c: vec4f, t: f32) -> f32 {
  return ((c.x * t + c.y) * t + c.z) * t + c.w;
}

fn gridLine(point: vec3f, direction: vec3f, distanceFromCamera: f32) -> f32 {
  var radius: f32 = length(point.xz);
  var lineDistance: vec2f = abs(fract(point.xz / 1.5 + vec2f(0.5)) - vec2f(0.5)) * 1.5;
  var denominator: f32 = 1.0 + 0.08 * radius * radius;
  var gradient: vec2f = 1.44 * point.xz / (denominator * denominator);
  var normal: vec3f = normalize(vec3f(-gradient.x, 1.0, -gradient.y));
  var grazing: f32 = max(0.08, abs(dot(normal, direction)));
  var pixelWidth: f32 = max(0.018, distanceFromCamera * u.tanHalfFov / (u.resolution.y * grazing));
  var line: f32 = 1.0 - smoothstep(pixelWidth * 0.5, pixelWidth * 1.5, min(lineDistance.x, lineDistance.y));
  var fade: f32 = (1.0 - smoothstep(16.0, 23.0, radius)) * smoothstep(0.7, 1.3, radius);
  return line * fade * 0.7;
}

fn gravityGrid(origin: vec3f, direction: vec3f) -> vec3f {
  // Bound the surface itself, not the camera distance. All visible grid points
  // fit inside this sphere, including when the camera is at maximum zoom-out.
  var b: f32 = dot(origin, direction);
  var discriminant: f32 = b * b - dot(origin, origin) + 625.0;
  if (discriminant <= 0.0) { return vec3f(0.0); }
  var nearT: f32 = max(0.0, -b - sqrt(discriminant));
  var farT: f32 = -b + sqrt(discriminant);
  if (farT <= nearT) { return vec3f(0.0); }
  var start: vec3f = origin + direction * nearT;
  var span: f32 = farT - nearT;
  var q0: f32 = 1.0 + 0.08 * dot(start.xz, start.xz);
  var q1: f32 = 0.16 * dot(start.xz, direction.xz);
  var q2: f32 = 0.08 * dot(direction.xz, direction.xz);
  var c: vec4f = vec4f(direction.y * q2, (start.y + 2.0) * q2 + direction.y * q1,
    (start.y + 2.0) * q1 + direction.y * q0, (start.y + 2.0) * q0 + 9.0);
  var cuts: array<f32, 4>;
  cuts[0] = 0.0;
  var count: i32 = 1;
  var a: f32 = 3.0 * c.x;
  var d: f32 = 2.0 * c.y;
  if (abs(a) < 0.000001) {
    if (abs(d) > 0.000001) {
      var root: f32 = -c.z / d;
      if (root > 0.0 && root < span) { cuts[count] = root; count++; }
    }
  } else {
    var det: f32 = d * d - 4.0 * a * c.z;
    if (det > 0.0) {
      var r1: f32 = (-d - sqrt(det)) / (2.0 * a);
      var r2: f32 = (-d + sqrt(det)) / (2.0 * a);
      var low: f32 = min(r1, r2); var high: f32 = max(r1, r2);
      if (low > 0.0 && low < span) { cuts[count] = low; count++; }
      if (high > 0.0 && high < span) { cuts[count] = high; count++; }
    }
  }
  cuts[count] = span;
  var coverage: f32 = 0.0;
  for (var i: i32 = 0; i < 3; i++) {
    if (i >= count) { break; }
    var low: f32 = cuts[i]; var high: f32 = cuts[i + 1];
    var lowValue: f32 = gridPolynomial(c, low);
    if (lowValue * gridPolynomial(c, high) > 0.0) { continue; }
    for (var j: i32 = 0; j < 18; j++) {
      var mid: f32 = (low + high) * 0.5;
      var value: f32 = gridPolynomial(c, mid);
      if (value * lowValue > 0.0) { low = mid; lowValue = value; }
      else { high = mid; }
    }
    var t: f32 = (low + high) * 0.5;
    var line: f32 = gridLine(start + direction * t, direction, nearT + t);
    // Gaps are transparent: a near crossing must not hide the far wall/bottom.
    coverage += (1.0 - coverage) * line;
  }
  return vec3f(0.13, 0.32, 0.48) * coverage;
}

@fragment fn main(@location(0) vUv: vec2f) -> @location(0) vec4f {
 var screen = vUv * 2.0 - vec2f(1.0);
 screen.x *= u.resolution.x / u.resolution.y;
 let direction = normalize(u.forward + u.tanHalfFov * (screen.x * u.right + screen.y * u.up));
 return vec4f(gravityGrid(u.cameraPosition, direction), 1.0);
}
