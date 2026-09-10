@fragment fn prefilter(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = sampleSource(uv + u.displayTexel * vec2f(-0.5, -0.5)).rgb;
  color += sampleSource(uv + u.displayTexel * vec2f(0.5, -0.5)).rgb;
  color += sampleSource(uv + u.displayTexel * vec2f(-0.5, 0.5)).rgb;
  color += sampleSource(uv + u.displayTexel * vec2f(0.5, 0.5)).rgb;
  color *= 0.25;
  let brightness = max(color.r, max(color.g, color.b));
  return vec4f(color * smoothstep(0.6, 1.8, brightness), 1.0);
}
@fragment fn blur(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = sampleSource(uv).rgb * 0.227027;
  color += sampleSource(uv + u.blurDirection * 1.384615).rgb * 0.316216;
  color += sampleSource(uv - u.blurDirection * 1.384615).rgb * 0.316216;
  color += sampleSource(uv + u.blurDirection * 3.230769).rgb * 0.070270;
  color += sampleSource(uv - u.blurDirection * 3.230769).rgb * 0.070270;
  return vec4f(color, 1.0);
}
fn toneMap(color: vec3f) -> vec3f {
  return clamp((color * (2.51 * color + vec3f(0.03))) / (color * (2.43 * color + vec3f(0.59)) + vec3f(0.14)), vec3f(0.0), vec3f(1.0));
}
@fragment fn composite(@location(0) vUv: vec2f) -> @location(0) vec4f {
  let texel = 1.0 / u.traceResolution;
  let pixel = floor(vUv / texel);
  let uv = (pixel + vec2f(0.5)) * texel;
  let traced = sampleSource(uv);
  var scene = traced.rgb;
  if (u.gridEnabled > 0.5) {
    scene += textureSampleLevel(gridImage, linearSampler, textureUV(uv), 0.0).rgb * traced.a;
  }
  let glow = textureSampleLevel(bloomImage, linearSampler, textureUV(uv), 0.0).rgb;
  let color = pow(toneMap((scene + glow * u.bloom) * u.exposure), vec3f(1.0 / 2.2));
  let dither = fract(52.9829189 * fract(dot(pixel, vec2f(0.06711056, 0.00583715))));
  return vec4f(max(color + vec3f((dither - 0.5) / 255.0), vec3f(0.0)), 1.0);
}
// Five-column, seven-row glyphs, unchanged from the original rendering.
fn glyphRow(glyph: i32, row: i32) -> i32 {
  if (glyph == 0) { return 0; }
  if (glyph == 1) { return select(0, 4, row == 6); }
  if (glyph == 2) { return select(0, 4, row == 2 || row == 5); }
  if (glyph == 3) { return select(0, 14, row == 3); }
  if (glyph == 4) { return select(select(0, 4, row > 0 && row < 6), 31, row == 3); }
  if (glyph == 5) { return select(select(select(0, 21, row == 1 || row == 5), 14, row == 2 || row == 4), 31, row == 3); }
  if (glyph == 6) { return select(select(0, 17, row > 1 && row < 5), 14, row == 1 || row == 5); }
  if (glyph == 7) { return select(17, 14, row == 0 || row == 6); }
  if (glyph == 8) { return select(10, 31, row == 2 || row == 4); }
  return select(select(select(23, 16, row == 4), 17, row == 1 || row == 5), 14, row == 0 || row == 6);
}
fn bayer4(pixel: vec2f) -> f32 {
  let p = vec2i(pixel - 4.0 * floor(pixel / 4.0));
  let x0 = p.x & 1; let y0 = p.y & 1;
  let x1 = (p.x >> 1u) & 1; let y1 = (p.y >> 1u) & 1;
  return (f32(4 * ((x0 ^ y0) * 2 + y0) + ((x1 ^ y1) * 2 + y1)) + 0.5) / 16.0;
}
@fragment fn effects(@location(0) uv: vec2f) -> @location(0) vec4f {
  let pixel = uv * u.resolution;
  if (u.effect == 1.0) {
    let cellSize = vec2f(u.effectSize, u.effectSize * 1.5);
    let cell = floor(pixel / cellSize);
    let center = (cell + vec2f(0.5)) * cellSize / u.resolution;
    let offset = cellSize / u.resolution * 0.25;
    let color = (sampleSource(center + offset).rgb + sampleSource(center - offset).rgb
      + sampleSource(center + vec2f(offset.x, -offset.y)).rgb
      + sampleSource(center + vec2f(-offset.x, offset.y)).rgb) * 0.25;
    let brightness = dot(color, vec3f(0.299, 0.587, 0.114));
    let glyph = i32(clamp(floor(brightness * 10.0), 0.0, 9.0));
    let local = vec2i(floor(fract(pixel / cellSize) * vec2f(6.0, 8.0)));
    let row = glyphRow(glyph, 6 - local.y);
    var ink = 0.0;
    if (local.x < 5 && local.y < 7) { ink = f32((row >> u32(4 - local.x)) & 1); }
    return vec4f(color * ink, 1.0);
  }
  let blockSize = max(1.0, floor(u.effectSize / 4.0));
  let cell = floor(pixel / blockSize);
  let color = sampleSource((cell + vec2f(0.5)) * blockSize / u.resolution).rgb;
  return vec4f(floor(color * 3.0 + vec3f(bayer4(cell))) / 3.0, 1.0);
}
@fragment fn gradientMap(@location(0) uv: vec2f) -> @location(0) vec4f {
  let value = clamp(dot(sampleSource(uv).rgb, vec3f(0.299, 0.587, 0.114)), 0.0, 1.0);
  var mapped = u.stops[0].rgb;
  for (var i = 1u; i < 16u; i++) {
    if (i >= u32(u.stopCount)) { break; }
    let blend = clamp((value - u.stops[i-1u].w) / max(u.stops[i].w - u.stops[i-1u].w, 0.00001), 0.0, 1.0);
    mapped = mix(mapped, u.stops[i].rgb, blend);
  }
  return vec4f(mapped, 1.0);
}
