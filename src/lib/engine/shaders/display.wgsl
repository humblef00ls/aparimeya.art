// Simple display shader to scale up the raytraced output
// This creates a pixelated/retro look when scaling up low-resolution renders

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var previousFrameTexture: texture_2d<f32>;
@group(0) @binding(3) var lastFrameBuffer: texture_storage_2d<rgba8unorm, write>;

struct Uniforms {
    render_width: f32,
    render_height: f32,
    display_width: f32,
    display_height: f32,
    frame_count: f32,
}

@group(1) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 6>(
        vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
        vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1)
    );

    return vec4f(pos[vertexIndex], 0, 1);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
    // Calculate the pixel coordinates in the input texture
    let pixel_x = position.x * uniforms.render_width / uniforms.display_width;
    let pixel_y = position.y * uniforms.render_height / uniforms.display_height;
    let uv = vec2f(pixel_x, pixel_y) / vec2f(uniforms.render_width, uniforms.render_height);
    
    // Sample the current frame (new render)
    let currentFrame = textureSample(inputTexture, inputSampler, uv);
    
    // Sample the previous frame (accumulated result)
    let previousFrame = textureSample(previousFrameTexture, inputSampler, uv);
    
    // Temporal accumulation using weighted average
    let frameCount = uniforms.frame_count;
    
    // For the first few frames, just show current frame to avoid darkening
    let shouldAccumulate = frameCount >= 5.0;
    
    // Use select() to avoid variable declaration issues
    let weight = select(0.0, 1.0 / (frameCount + 1.0), shouldAccumulate);
    let accumulatedColor = select(currentFrame, previousFrame * (1.0 - weight) + currentFrame * weight, shouldAccumulate);
    
    // Write to debug buffer
    let buffer_coord = vec2<i32>(position.xy);
    textureStore(lastFrameBuffer, buffer_coord, accumulatedColor);

    return accumulatedColor;
}
