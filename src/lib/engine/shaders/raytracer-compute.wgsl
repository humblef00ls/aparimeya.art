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
@group(0) @binding(2) var<uniform> maxBounces: u32;
@group(0) @binding(3) var<uniform> raysPerPixel: u32;
@group(0) @binding(4) var<uniform> frameCount: u32;

struct Ray {
    origin: vec3f,
    direction: vec3f,
}

struct Sphere {
    center: vec3f,
    radius: f32,
    material: u32,
}

struct Plane {
    point: vec3f,
    normal: vec3f,
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

// Scene data - multiple spheres and a floor
const SPHERE_COUNT = 6u;
const PLANE_COUNT = 1u;

// Generate jittered ray from camera for given pixel coordinates and ray index
fn get_jittered_ray(pixel_x: f32, pixel_y: f32, ray_index: u32, viewport_width: f32, viewport_height: f32) -> Ray {
    // Generate pseudo-random jitter for anti-aliasing
    let jitter_seed = f32(ray_index) * 0.618033988749895; // Golden ratio for better distribution
    
    // Create jitter offsets within the pixel
    let jitter_x = fract(sin(jitter_seed * 43758.5453) * 43758.5453) - 0.5;
    let jitter_y = fract(sin(jitter_seed * 43758.5453 + 1.0) * 43758.5453) - 0.5;
    
    // Apply jitter to pixel coordinates
    let jittered_x = pixel_x + jitter_x;
    let jittered_y = pixel_y + jitter_y;
    
    // Calculate normalized device coordinates (-1 to 1)
    let pixel_ndc_x = (jittered_x / viewport_width) * 2.0 - 1.0;
    let pixel_ndc_y = 1.0 - (jittered_y / viewport_height) * 2.0;
  
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

// Plane intersection test
fn hit_plane(ray: Ray, plane: Plane) -> f32 {
    let denom = dot(ray.direction, plane.normal);
    if abs(denom) < 0.0001 {
        return -1.0; // Ray is parallel to plane
    }

    let t = dot(plane.point - ray.origin, plane.normal) / denom;
    if t > 0.0 {
        return t;
    }
    return -1.0;
}

// Get material properties
fn get_material(material_id: u32) -> Material {
    if material_id == 0u {
        return Material(vec3f(0.0, 0.0, 0.0), 0.0, 0.0, vec3f(25.0, 25.0, 25.0)); // Super intense big light sphere
    } else if material_id == 1u {
        return Material(vec3f(0.2, 0.8, 0.2), 0.0, 0.3, vec3f(0.0)); // Green matte
    } else if material_id == 2u {
        return Material(vec3f(0.2, 0.2, 0.8), 0.0, 0.3, vec3f(0.0)); // Blue matte
    } else if material_id == 3u {
        return Material(vec3f(0.8, 0.8, 0.2), 0.8, 0.1, vec3f(0.0)); // Gold metallic
    } else if material_id == 4u {
        return Material(vec3f(0.8, 0.8, 0.8), 0.0, 0.1, vec3f(0.0)); // White matte
    } else if material_id == 5u {
        return Material(vec3f(0.3, 0.3, 0.3), 0.0, 0.8, vec3f(0.0)); // Gray floor
    } else if material_id == 6u {
        return Material(vec3f(0.0, 0.0, 0.0), 0.0, 0.0, vec3f(30.0, 30.0, 30.0)); // Super intense big light sphere
    } else {
        return Material(vec3f(0.5, 0.5, 0.5), 0.0, 0.5, vec3f(0.0));
    }
}

// Grid pattern function for the floor
fn get_grid_color(hit_point: vec3f) -> vec3f {
    let grid_size = 1.0;
    
    // Simple grid using floor
    let x_cell = floor(hit_point.x / grid_size);
    let z_cell = floor(hit_point.z / grid_size);
    
    // Alternate colors based on cell position
    let is_even = (x_cell + z_cell) % 2.0 == 0.0;

    if is_even {
        return vec3f(0.8, 0.8, 0.8); // Light cells
    } else {
        return vec3f(0.3, 0.3, 0.3); // Dark cells
    }
}

// Simple lighting calculation
fn calculate_lighting(hit_point: vec3f, normal: vec3f, material: Material) -> vec3f {
    // Return the material's base color (albedo)
    // This makes objects visible with their proper colors
    return material.albedo;
}

// Skybox function
fn get_skybox_color(ray_direction: vec3f) -> vec3f {
    // Simple gradient skybox
    let t = (ray_direction.y + 1.0) * 0.5;
    let sky_top = vec3f(0.5, 0.7, 1.0);    // Light blue
    let sky_bottom = vec3f(0.8, 0.9, 1.0); // White-blue

    return mix(sky_bottom, sky_top, t);
}

// Generate random direction in hemisphere around normal using normal distribution
fn random_hemisphere_direction(normal: vec3f) -> vec3f {
    // Generate two random values for Box-Muller transform
    let u1 = fract(sin(dot(normal, vec3f(12.9898, 78.233, 45.164)) * 43758.5453 + f32(frameCount)));
    let u2 = fract(sin(dot(normal, vec3f(34.5678, 12.3456, 78.9012)) * 43758.5453 + f32(frameCount)));
    
    // Box-Muller transform for normal distribution
    let theta = 2.0 * 3.14159 * u1;
    let rho = sqrt(-2.0 * log(u2));
    
    // Generate two normally distributed values
    let z1 = rho * cos(theta);
    let z2 = rho * sin(theta);
    
    // Generate third normal value for 3D direction
    let u3 = fract(sin(dot(normal, vec3f(56.789, 23.456, 89.123)) * 43758.5453 + f32(frameCount)));
    let u4 = fract(sin(dot(normal, vec3f(45.678, 67.890, 12.345)) * 43758.5453 + f32(frameCount)));
    
    let theta2 = 2.0 * 3.14159 * u3;
    let rho2 = sqrt(-2.0 * log(u4));
    let z3 = rho2 * cos(theta2);
    
    // Create random direction and normalize
    let random_dir = normalize(vec3f(z1, z2, z3));
    
    // Ensure direction is in same hemisphere as normal
    if dot(random_dir, normal) < 0.0 {
        return -random_dir;
    }
    return random_dir;
}

// Trace the path of a ray of light (in reverse) as it travels from the camera,
// reflects off objects in the scene, and ends up (hopefully) at a light source.
fn trace_ray(ray: Ray, max_bounces: u32) -> vec3f {
    var current_ray = ray;
    var incoming_light = vec3f(0.0, 0.0, 0.0);
    var ray_colour = vec3f(1.0, 1.0, 1.0);
    
    for (var i = 0u; i <= max_bounces; i++) {
        var closest_hit: HitRecord = HitRecord(-1.0, vec3f(0.0), vec3f(0.0), 0u, false);
        
        // Test spheres
        let spheres = array<Sphere, SPHERE_COUNT>(
            Sphere(vec3f(0.0, 0.0, 0.0), 0.8, 0u),      // Big bright light sphere at origin
            Sphere(vec3f(-2.0, 0.5, 0.0), 0.8, 1u),     // Green sphere left
            Sphere(vec3f(2.0, 0.5, 0.0), 0.8, 2u),      // Blue sphere right
            Sphere(vec3f(0.0, 1.5, -2.0), 0.6, 3u),     // Gold sphere back
            Sphere(vec3f(0.0, 2.0, 2.0), 0.7, 4u),      // White sphere front
            Sphere(vec3f(0.0, 3.0, 0.0), 1.2, 6u)       // Big bright light sphere above center
        );

        for (var j = 0u; j < SPHERE_COUNT; j++) {
            let t = hit_sphere(current_ray, spheres[j]);
            if t > 0.0 && (closest_hit.t < 0.0 || t < closest_hit.t) {
                let hit_point = current_ray.origin + current_ray.direction * t;
                let normal = normalize(hit_point - spheres[j].center);
                let front_face = dot(current_ray.direction, normal) < 0.0;
                let final_normal = select(-normal, normal, front_face);

                closest_hit = HitRecord(t, hit_point, final_normal, spheres[j].material, front_face);
            }
        }
        
        // Test floor plane
        let floor = Plane(vec3f(0.0, -1.0, 0.0), vec3f(0.0, 1.0, 0.0), 5u);
        let floor_t = hit_plane(current_ray, floor);
        if floor_t > 0.0 && (closest_hit.t < 0.0 || floor_t < closest_hit.t) {
            let hit_point = current_ray.origin + current_ray.direction * floor_t;
            let normal = vec3f(0.0, 1.0, 0.0); // Floor normal always points up
            let front_face = dot(current_ray.direction, normal) < 0.0;

            closest_hit = HitRecord(floor_t, hit_point, normal, floor.material, front_face);
        }
        
        // If we hit something
        if closest_hit.t > 0.0 {
            let material = get_material(closest_hit.material);
            
            // Special handling for floor
            if closest_hit.material == 5u {
                let floor_color = get_grid_color(closest_hit.point);
                incoming_light += floor_color * ray_colour;
                break;
            }
            
            // Add emitted light
            let emitted_light = material.emission;
            incoming_light += emitted_light * ray_colour;
            
            // Multiply ray color by material color for next bounce
            ray_colour *= material.albedo;
            
            // Generate new ray direction for bounce
            let new_direction = random_hemisphere_direction(closest_hit.normal);
            current_ray = Ray(closest_hit.point, new_direction);
        } else {
            // No hit - break and return accumulated light
            break;
        }
    }
    
    return incoming_light;
}

@compute @workgroup_size(16, 16)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // Check if we're within the render bounds
    if global_id.x >= u32(camera.render_width) || global_id.y >= u32(camera.render_height) {
        return;
    }

    // Debug mode: visualize random direction distribution
    let debug_mode = false; // Set to false to disable debug visualization
    
    if debug_mode {
        // Create a sphere visualization centered on screen
        let center_x = camera.render_width * 0.5;
        let center_y = camera.render_height * 0.5;
        let radius = min(center_x, center_y) * 0.8;
        
        let pixel_x = f32(global_id.x);
        let pixel_y = f32(global_id.y);
        
        // Check if pixel is within the debug sphere
        let dx = pixel_x - center_x;
        let dy = pixel_y - center_y;
        let distance = sqrt(dx * dx + dy * dy);
        
        if distance <= radius {
            // Convert pixel position to sphere coordinates
            let u = (pixel_x - center_x) / radius;
            let v = (pixel_y - center_y) / radius;
            let z = sqrt(1.0 - u * u - v * v);
            
            // Create a normal vector for this sphere point
            let normal = normalize(vec3f(u, v, z));
            
            // Generate random direction using your function
            let random_dir = random_hemisphere_direction(normal);
            
            // Visualize the random direction as color
            let direction_color = (random_dir + vec3f(1.0, 1.0, 1.0)) * 0.5; // Convert from [-1,1] to [0,1]
            
            // Write debug visualization
            textureStore(outputTexture, vec2<i32>(global_id.xy), vec4f(direction_color, 1.0));
            return;
        } else {
            // Outside debug sphere - show black
            textureStore(outputTexture, vec2<i32>(global_id.xy), vec4f(0.0, 0.0, 0.0, 1.0));
            return;
        }
    }

    // Normal ray tracing mode
    // Accumulate color from multiple rays per pixel
    var accumulated_color = vec3f(0.0, 0.0, 0.0);
    
    // Shoot multiple rays per pixel
    for (var ray_index = 0u; ray_index < raysPerPixel; ray_index++) {
        // Generate jittered ray for this specific pixel and ray index
        let ray = get_jittered_ray(f32(global_id.x), f32(global_id.y), ray_index, camera.render_width, camera.render_height);
        
        // Trace the ray with max bounces from uniform
        let color = trace_ray(ray, maxBounces);
        
        // Accumulate the color
        accumulated_color += color;
    }
    
    // Average the results
    let final_color = accumulated_color / f32(raysPerPixel);
    
    // Write the result to the output texture
    textureStore(outputTexture, vec2<i32>(global_id.xy), vec4f(final_color, 1.0));
}
