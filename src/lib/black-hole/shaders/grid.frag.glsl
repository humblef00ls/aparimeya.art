precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uTraceResolution;
uniform vec3 uCamera;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uFov;
/* GRID */
void main() {
  vec2 screen = vUv * 2.0 - 1.0;
  screen.x *= uResolution.x / uResolution.y;
  vec3 direction = normalize(uForward + uFov * (screen.x * uRight + screen.y * uUp));
  gl_FragColor = vec4(gravityGrid(uCamera, direction), 1.0);
}
