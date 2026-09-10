fn hash21(p: vec2f) -> f32 {
  var p3: vec3f = fract(vec3f(p.xyx) * 0.1031);
  p3 += vec3f(dot(p3, p3.yzx + vec3f(33.33)));
  return fract((p3.x + p3.y) * p3.z);
}

fn noise(p: vec2f) -> f32 {
  var i: vec2f = floor(p);
  var f: vec2f = fract(p);
  f = f * f * (vec2f(3.0) - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1, 0)), f.x),
             mix(hash21(i + vec2f(0, 1)), hash21(i + vec2f(1, 1)), f.x), f.y);
}

fn turbulence(inputP: vec2f) -> f32 {
  var p = inputP;
  var value: f32 = 0.0;
  var amplitude: f32 = 0.5;
  for (var i: i32 = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2f(13.1, 7.7);
    amplitude *= 0.5;
  }
  return value;
}
