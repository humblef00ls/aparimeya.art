precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
// Must match MAX_GRADIENT_STOPS in filters.ts.
uniform int uStopCount;
uniform float uPositions[16];
uniform vec3 uColors[16];

void main() {
  // Map display-space brightness after ASCII/dither without resampling its edges.
  vec3 color = texture2D(uSource, vUv).rgb;
  float value = clamp(dot(color, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  vec3 mapped = uColors[0];
  for (int i = 1; i < 16; i++) {
    if (i >= uStopCount) break;
    float blend = clamp((value - uPositions[i - 1]) /
      max(uPositions[i] - uPositions[i - 1], 0.00001), 0.0, 1.0);
    mapped = mix(mapped, uColors[i], blend);
  }
  gl_FragColor = vec4(mapped, 1.0);
}
