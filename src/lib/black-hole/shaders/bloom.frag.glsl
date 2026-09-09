precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uDirection;
void main() {
  vec3 color = texture2D(uSource, vUv).rgb * 0.227027;
  color += texture2D(uSource, vUv + uDirection * 1.384615).rgb * 0.316216;
  color += texture2D(uSource, vUv - uDirection * 1.384615).rgb * 0.316216;
  color += texture2D(uSource, vUv + uDirection * 3.230769).rgb * 0.070270;
  color += texture2D(uSource, vUv - uDirection * 3.230769).rgb * 0.070270;
  gl_FragColor = vec4(color, 1.0);
}
