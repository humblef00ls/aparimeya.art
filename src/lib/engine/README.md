# Ray Tracing Engine Architecture

This is a GPU-based ray tracing engine built with WebGPU and WGSL shaders. The engine uses a compute shader for ray tracing and a display shader for scaling and displaying the results.

## Architecture Overview

```
src/lib/engine/
├── math/           # Mathematical utilities
│   └── vector.ts  # Vector3 class for 3D math
├── camera/         # Camera system
│   ├── camera.ts  # Abstract base camera class
│   └── perspective-camera.ts  # Perspective camera implementation
├── shaders/        # WGSL shader files
│   ├── raytracer-compute.wgsl  # Compute shader for ray tracing
│   └── display.wgsl            # Vertex/fragment shader for display
├── raytracer.ts    # TypeScript interface for WebGPU setup
└── index.ts        # Main exports
```

## Key Components

### 1. WGSL Shaders (.wgsl files)

- **raytracer-compute.wgsl**: Compute shader that performs ray tracing on every pixel
- **display.wgsl**: Vertex/fragment shader that scales and displays the compute shader output
- All ray tracing logic runs on the GPU using compute shaders
- Supports dynamic resolution control with pixelated scaling

### 2. Camera System

- **Camera**: Abstract base class with common camera functionality
- **PerspectiveCamera**: Standard perspective projection camera
- Real-time camera movement and rotation controls
- Extensible for orthographic, fisheye, and other camera types

### 3. Math Utilities

- **Vector3**: 3D vector class with essential operations (add, sub, mul, dot, cross, normalize)
- Optimized for GPU shader compatibility
- Used throughout the camera and ray tracing systems

### 4. Ray Tracer

- **RayTracer**: WebGPU pipeline setup and rendering
- Uses compute pipeline for ray tracing and render pipeline for display
- Supports dynamic resolution changes
- Minimal TypeScript code - just enough to interface with GPU

## How It Works

1. **Compute Shader Rendering**: Ray tracing computation runs on the GPU using compute shaders
2. **Two-Stage Pipeline**:
   - Compute pass generates low-resolution ray traced image
   - Render pass scales and displays the result with nearest-neighbor filtering
3. **Dynamic Resolution**: Can render at lower resolution for performance while maintaining display quality
4. **Real-time**: Designed for interactive real-time rendering with camera controls

## Usage Example

```typescript
import {
  RayTracer,
  PerspectiveCamera,
  Vector3,
  type RenderSettings,
} from "$lib/engine";

// Create camera
const camera = new PerspectiveCamera({
  position: new Vector3(0, 0, -5),
  target: new Vector3(0, 0, 0),
  up: Vector3.up(),
  fov: Math.PI / 3, // 60 degrees
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
});

// Create render settings
const renderSettings: RenderSettings = {
  renderWidth: 800,
  renderHeight: 600,
  displayWidth: 1600,
  displayHeight: 1200,
};

// Create ray tracer
const raytracer = new RayTracer(
  device,
  context,
  format,
  camera,
  renderSettings,
);

// Render
raytracer.render();
```

## Extending the Engine

### Adding New Camera Types

1. Extend the `Camera` base class
2. Implement `getProjectionMatrix()` and `getViewMatrix()`
3. Add to the exports in `index.ts`

### Adding New Objects

1. Add intersection test functions in the compute shader
2. Update the `trace_ray` function to include new objects
3. Consider using GPU buffers for dynamic scene data

### Adding Materials

1. Extend the material system in the compute shader
2. Add material properties and lighting calculations
3. Update intersection handling to use new material properties

## Performance Considerations

- **GPU Memory**: Minimize data transfer between CPU and GPU
- **Compute Shaders**: Use compute shaders for parallel ray tracing computation
- **Dynamic Resolution**: Render at lower resolution for performance, scale up for display
- **Shader Complexity**: Keep shader logic efficient for real-time performance
- **Memory Layout**: Optimize data structures for GPU memory access patterns

## Current Features

- ✅ Real-time ray tracing with WebGPU compute shaders
- ✅ Dynamic resolution control with pixelated scaling
- ✅ Interactive camera controls (WASD, QE, Arrow Keys, Mouse)
- ✅ Shift modifier for amplified movement
- ✅ Perspective camera with FOV and aspect ratio control
- ✅ Performance monitoring and debugging UI

## Future Enhancements

- [ ] Acceleration structures (BVH, Octree)
- [ ] Multiple light sources and shadows
- [ ] Advanced materials (PBR, subsurface scattering)
- [ ] Post-processing effects
- [ ] Scene graph and transformations
- [ ] Animation and keyframe interpolation
- [ ] Multiple scene objects and materials
