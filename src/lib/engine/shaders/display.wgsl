// Simple display shader to scale up the raytraced output
// This creates a pixelated/retro look when scaling up low-resolution renders

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct Uniforms {
    render_width: f32,
    render_height: f32,
    display_width: f32,
    display_height: f32,
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
    
    // Sample the input texture (this will create the pixelated look)
    let color = textureSample(inputTexture, inputSampler, vec2f(pixel_x, pixel_y) / vec2f(uniforms.render_width, uniforms.render_height));
    
    return color;
}
