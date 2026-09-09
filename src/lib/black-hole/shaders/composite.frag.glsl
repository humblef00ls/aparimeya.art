precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uGrid;
uniform float uGravityGrid;
uniform sampler2D uBloom;
uniform vec2 uTexel;
uniform float uExposure;
uniform float uBloomStrength;

vec3 toneMap(vec3 color) {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}

vec3 displayColor(vec2 uv) {
  vec4 traced = texture2D(uScene, uv);
  vec3 scene = traced.rgb;
  if (uGravityGrid > 0.5) scene += texture2D(uGrid, uv).rgb * traced.a;
  vec3 glow = texture2D(uBloom, uv).rgb;
  return pow(toneMap((scene + glow * uBloomStrength) * uExposure), vec3(1.0 / 2.2));
}

void main() {
  // Shade one discrete source pixel per output block. Never interpolate across blocks.
  // Quantize bloom and display dither too, so no full-resolution softness leaks through.
  vec2 pixel = floor(vUv / uTexel);
  vec2 uv = (pixel + 0.5) * uTexel;
  vec3 color = displayColor(uv);
  float dither = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(max(color + (dither - 0.5) / 255.0, vec3(0.0)), 1.0);
}
