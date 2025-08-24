// Ray tracing compute shader for WebGPU
// This shader runs on every pixel to perform ray tracing

// Camera uniform buffer
struct CameraUniforms {
    position: vec4f,    // Camera position (w unused)
    forward: vec4f,     // Camera forward direction (w unused)
    up: vec4f,          // Camera up vector (w unused)
    right: vec4f,       // Camera right vector (w unused)
    fov: f32,           // Field of view in radians
    aspect: f32,        // Aspect ratio (width/height)
    render_width: f32,  // Render width in pixels
    render_height: f32, // Render height in pixels
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;

struct Ray {
    origin: vec3f,
    direction: vec3f,
}

struct Sphere {
    center: vec3f,
    radius: f32,
    material: u32,
}

struct Material {
    albedo: vec3f,
    metallic: f32,
    roughness: f32,
    emission: vec3f,
}

struct HitRecord {
    t: f32,
    point: vec3f,
    normal: vec3f,
    material: u32,
    front_face: bool,
}

// Generate ray from camera for given pixel coordinates
fn get_ray(pixel_x: f32, pixel_y: f32, viewport_width: f32, viewport_height: f32) -> Ray {
    // Calculate normalized device coordinates (-1 to 1)
    let pixel_ndc_x = (pixel_x / viewport_width) * 2.0 - 1.0;
    let pixel_ndc_y = 1.0 - (pixel_y / viewport_height) * 2.0;
  
    // Use the actual render aspect ratio
    let screen_aspect = viewport_width / viewport_height;
  
    // Calculate viewport dimensions based on FOV
    let viewport_height_half = tan(camera.fov * 0.5);
    let viewport_width_half = viewport_height_half * screen_aspect;

    let viewport_x = pixel_ndc_x * viewport_width_half;
    let viewport_y = pixel_ndc_y * viewport_height_half;

    // Generate ray direction using standard ray tracing approach
    let ray_direction = normalize(
        camera.forward.xyz + camera.right.xyz * viewport_x + camera.up.xyz * viewport_y
    );

    return Ray(camera.position.xyz, ray_direction);
}

// Sphere intersection test
fn hit_sphere(ray: Ray, sphere: Sphere) -> f32 {
    let oc = ray.origin - sphere.center;
    let a = dot(ray.direction, ray.direction);
    let b = 2.0 * dot(oc, ray.direction);
    let c = dot(oc, oc) - sphere.radius * sphere.radius;
    let discriminant = b * b - 4.0 * a * c;

    if discriminant < 0.0 {
        return -1.0;
    }

    let t = (-b - sqrt(discriminant)) / (2.0 * a);
    if t > 0.0 {
        return t;
    }

    let t2 = (-b + sqrt(discriminant)) / (2.0 * a);
    if t2 > 0.0 {
        return t2;
    }
    return -1.0;
}

// Ray tracing with sphere intersection
fn trace_ray(ray: Ray) -> vec3f {
    // Place a sphere at the origin
    let sphere = Sphere(vec3f(0.0, 0.0, 0.0), 1.0, 0u);
    let t = hit_sphere(ray, sphere);

    if t > 0.0 {
        // Hit the sphere - show normal as color
        let hit_point = ray.origin + ray.direction * t;
        let normal = normalize(hit_point - sphere.center);
        // Convert normal (-1,1) to color (0,1) for visualization
        return (normal + 1.0) * 0.5;
    }
    
    // No hit - show directional color
    return vec3f(
        (ray.direction.x + 1.0) * 0.5,  // Red based on X direction
        (ray.direction.y + 1.0) * 0.5,  // Green based on Y direction
        (ray.direction.z + 1.0) * 0.5   // Blue based on Z direction
    );
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // Check if we're within the render bounds
    if global_id.x >= u32(camera.render_width) || global_id.y >= u32(camera.render_height) {
        return;
    }

    // Generate ray for this specific pixel
    let ray = get_ray(f32(global_id.x), f32(global_id.y), camera.render_width, camera.render_height);
    
    // Trace the ray and get color
    let color = trace_ray(ray);
    
    // Write the result to the output texture
    textureStore(outputTexture, vec2<i32>(global_id.xy), vec4f(color, 1.0));
}
