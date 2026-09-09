precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;

void main() {
  // Area-filter before decimation: every source texel contributes to the glow.
  vec3 color = texture2D(uSource, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  color += texture2D(uSource, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  color += texture2D(uSource, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  color += texture2D(uSource, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  color *= 0.25;
  float brightness = max(color.r, max(color.g, color.b));
  gl_FragColor = vec4(color * smoothstep(0.6, 1.8, brightness), 1.0);
}
