# Ray Tracing Engine Architecture

This is a GPU-based ray tracing engine built with WebGPU and WGSL shaders. The engine is designed to run entirely on the GPU for maximum performance.

## Architecture Overview

```
src/lib/engine/
├── math/           # Mathematical utilities
│   └── vector.ts  # Vector3 class for 3D math
├── camera/         # Camera system
│   ├── camera.ts  # Abstract base camera class
│   └── perspective-camera.ts  # Perspective camera implementation
├── shaders/        # WGSL shader files
│   └── raytracer.wgsl  # Main ray tracing shader
├── raytracer.ts    # TypeScript interface for WebGPU setup
└── index.ts        # Main exports
```

## Key Components

### 1. WGSL Shaders (.wgsl files)
- **raytracer.wgsl**: Main ray tracing shader that runs on every pixel
- All ray tracing logic runs on the GPU
- Supports multiple objects, materials, and lighting

### 2. Camera System
- **Camera**: Abstract base class with common camera functionality
- **PerspectiveCamera**: Standard perspective projection camera
- Extensible for orthographic, fisheye, and other camera types

### 3. Math Utilities
- **Vector3**: 3D vector class with common operations
- Optimized for GPU shader compatibility

### 4. Ray Tracer
- **RayTracer**: WebGPU pipeline setup and rendering
- Minimal TypeScript code - just enough to interface with GPU

## How It Works

1. **GPU Rendering**: The entire ray tracing computation runs on the GPU
2. **Per-Pixel Processing**: Each pixel gets its own ray and performs intersection tests
3. **Shader-Based**: All ray tracing logic is written in WGSL shader code
4. **Real-time**: Designed for interactive real-time rendering

## Usage Example

```typescript
import { RayTracer, PerspectiveCamera } from '$lib/engine';

// Create camera
const camera = PerspectiveCamera.createDefault();

// Create ray tracer
const raytracer = new RayTracer(device, context, format);

// Render
raytracer.render();
```

## Extending the Engine

### Adding New Camera Types
1. Extend the `Camera` base class
2. Implement `getProjectionMatrix()` and `getViewMatrix()`
3. Add to the exports in `index.ts`

### Adding New Objects
1. Add intersection test functions in the WGSL shader
2. Update the `trace_ray` function to include new objects
3. Consider using GPU buffers for dynamic scene data

### Adding Materials
1. Extend the `Material` struct in the shader
2. Add material properties and lighting calculations
3. Update intersection handling to use new material properties

## Performance Considerations

- **GPU Memory**: Minimize data transfer between CPU and GPU
- **Shader Complexity**: Keep shader logic efficient for real-time performance
- **Scene Size**: Use acceleration structures for large scenes
- **Memory Layout**: Optimize data structures for GPU memory access patterns

## Future Enhancements

- [ ] Acceleration structures (BVH, Octree)
- [ ] Multiple light sources and shadows
- [ ] Advanced materials (PBR, subsurface scattering)
- [ ] Post-processing effects
- [ ] Scene graph and transformations
- [ ] Animation and keyframe interpolation
