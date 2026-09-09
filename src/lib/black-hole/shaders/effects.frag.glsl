precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform int uEffect;
uniform float uSize;

// Five-column, seven-row glyphs: . : - + * o O # @.
int glyphRow(int glyph, int row) {
  if (glyph == 0) return 0;
  if (glyph == 1) return row == 6 ? 4 : 0;
  if (glyph == 2) return row == 2 || row == 5 ? 4 : 0;
  if (glyph == 3) return row == 3 ? 14 : 0;
  if (glyph == 4) return row == 3 ? 31 : (row > 0 && row < 6 ? 4 : 0);
  if (glyph == 5) return row == 3 ? 31 : (row == 2 || row == 4 ? 14 : (row == 1 || row == 5 ? 21 : 0));
  if (glyph == 6) return row == 1 || row == 5 ? 14 : (row > 1 && row < 5 ? 17 : 0);
  if (glyph == 7) return row == 0 || row == 6 ? 14 : 17;
  if (glyph == 8) return row == 2 || row == 4 ? 31 : 10;
  return row == 0 || row == 6 ? 14 : (row == 1 || row == 5 ? 17 : (row == 4 ? 16 : 23));
}

float bayer4(vec2 pixel) {
  ivec2 p = ivec2(mod(pixel, 4.0));
  int x0 = p.x & 1, y0 = p.y & 1;
  int x1 = (p.x >> 1) & 1, y1 = (p.y >> 1) & 1;
  return (float(4 * ((x0 ^ y0) * 2 + y0) + ((x1 ^ y1) * 2 + y1)) + 0.5) / 16.0;
}

void main() {
  vec2 pixel = vUv * uResolution;
  if (uEffect == 1) {
    vec2 cellSize = vec2(uSize, uSize * 1.5);
    vec2 cell = floor(pixel / cellSize);
    vec2 center = (cell + 0.5) * cellSize / uResolution;
    // Average the cell area so tiny features do not blink between glyphs.
    vec2 offset = cellSize / uResolution * 0.25;
    vec3 color = (texture2D(uSource, center + offset).rgb + texture2D(uSource, center - offset).rgb
      + texture2D(uSource, center + vec2(offset.x, -offset.y)).rgb
      + texture2D(uSource, center + vec2(-offset.x, offset.y)).rgb) * 0.25;
    float brightness = dot(color, vec3(0.299, 0.587, 0.114));
    int glyph = int(clamp(floor(brightness * 10.0), 0.0, 9.0));
    ivec2 local = ivec2(floor(fract(pixel / cellSize) * vec2(6.0, 8.0)));
    int row = glyphRow(glyph, 6 - local.y);
    float ink = local.x < 5 && local.y < 7 ? float((row >> (4 - local.x)) & 1) : 0.0;
    gl_FragColor = vec4(color * ink, 1.0);
  } else {
    float blockSize = max(1.0, floor(uSize / 4.0));
    vec2 cell = floor(pixel / blockSize);
    vec3 color = texture2D(uSource, (cell + 0.5) * blockSize / uResolution).rgb;
    // Ordered 4x4 Bayer quantization, four levels per channel; black stays black.
    vec3 quantized = floor(color * 3.0 + bayer4(cell)) / 3.0;
    gl_FragColor = vec4(quantized, 1.0);
  }
}
