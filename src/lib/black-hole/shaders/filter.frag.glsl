precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec3 uShadows;
uniform vec3 uMidtones;
uniform vec3 uHighlights;

void main() {
  // Input is already tone-mapped display color, including any ASCII/dither marks.
  // A pointwise map preserves their edges and leaves black glyph gaps untouched.
  vec3 color = texture2D(uSource, vUv).rgb;
  float value = clamp(dot(color, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  vec3 mapped = value < 0.5
    ? mix(uShadows, uMidtones, value * 2.0)
    : mix(uMidtones, uHighlights, value * 2.0 - 1.0);
  gl_FragColor = vec4(mapped, 1.0);
}
