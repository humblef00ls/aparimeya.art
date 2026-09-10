// Uniform layout matches FrameUniforms: eleven 16-byte rows, then sixteen stops.
struct Frame {
  resolution: vec2f, traceResolution: vec2f,
  cameraPosition: vec3f, tanHalfFov: f32,
  forward: vec3f, time: f32,
  right: vec3f, lensing: f32,
  up: vec3f, doppler: f32,
  diskColor: vec3f, textureStrength: f32,
  textureScale: f32, diskBrightness: f32, stars: f32, starSize: f32,
  starVariation: f32, starDensity: f32, diskInner: f32, diskOuter: f32,
  exposure: f32, bloom: f32, effect: f32, effectSize: f32,
  displayTexel: vec2f, blurDirection: vec2f,
  stopCount: f32, gridEnabled: f32, padding: vec2f,
  stops: array<vec4f, 16>,
}
@group(0) @binding(0) var<uniform> u: Frame;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var source: texture_2d<f32>;
@group(0) @binding(3) var gridImage: texture_2d<f32>;
@group(0) @binding(4) var bloomImage: texture_2d<f32>;
@group(0) @binding(5) var linearSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 6>(vec2f(-1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  // Keep the simulation's bottom-up screen coordinates; textures use top-down UVs.
  output.uv = positions[index] * 0.5 + vec2f(0.5);
  return output;
}
fn textureUV(uv: vec2f) -> vec2f { return vec2f(uv.x, 1.0 - uv.y); }
fn sampleSource(uv: vec2f) -> vec4f {
  return textureSampleLevel(source, sourceSampler, textureUV(uv), 0.0);
}
