import raytracerComputeShader from './shaders/raytracer-compute.wgsl?raw';
import displayShader from './shaders/display.wgsl?raw';
import type { Camera } from './camera/camera';

export interface RenderSettings {
  renderWidth: number;
  renderHeight: number;
  displayWidth: number;
  displayHeight: number;
  maxBounces: number;
  raysPerPixel: number;
}

export class RayTracer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private computePipeline: GPUComputePipeline;
  private displayPipeline: GPURenderPipeline;
  private format: GPUTextureFormat;
  private camera: Camera;
  private cameraBuffer: GPUBuffer;
  private uniformsBuffer: GPUBuffer;
  private maxBouncesBuffer: GPUBuffer;
  private raysPerPixelBuffer: GPUBuffer;
  private frameCountBuffer: GPUBuffer;
  private renderTexture: GPUTexture;
  private renderTextureView: GPUTextureView;
  private lastFrameBuffer: GPUTexture;
  private lastFrameBufferView: GPUTextureView;
  private accumulatedFrameTexture: GPUTexture;
  private accumulatedFrameTextureView: GPUTextureView;
  private sampler: GPUSampler;
  private copyPipeline: GPURenderPipeline;
  private computeBindGroup: GPUBindGroup;
  private displayBindGroup: GPUBindGroup;
  private copyDimensionsBuffer: GPUBuffer;
  private renderSettings: RenderSettings;

  constructor(
    device: GPUDevice, 
    context: GPUCanvasContext, 
    format: GPUTextureFormat, 
    camera: Camera,
    renderSettings: RenderSettings
  ) {
    this.device = device;
    this.context = context;
    this.format = format;
    this.camera = camera;
    this.renderSettings = renderSettings;
    
    // Create camera uniform buffer
    this.cameraBuffer = this.device.createBuffer({
      size: 80, // 4 vec4s (position, forward, up, right) + fov + aspect + render_width + render_height
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create uniforms buffer for display shader
    this.uniformsBuffer = this.device.createBuffer({
      size: 20, // 5 floats: render_width, render_height, display_width, display_height, frame_count
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create max bounces buffer
    this.maxBouncesBuffer = this.device.createBuffer({
      size: 4, // 1 uint32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create rays per pixel buffer
    this.raysPerPixelBuffer = this.device.createBuffer({
      size: 4, // 1 uint32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create frame count buffer
    this.frameCountBuffer = this.device.createBuffer({
      size: 4, // 1 uint32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create copy dimensions buffer
    this.copyDimensionsBuffer = this.device.createBuffer({
      size: 8, // 2 floats: width, height
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create render texture (lower resolution)
    this.renderTexture = this.device.createTexture({
      size: { width: renderSettings.renderWidth, height: renderSettings.renderHeight, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.renderTextureView = this.renderTexture.createView();

    // Create lastFrameBuffer for debugging (same size as display)
    this.lastFrameBuffer = this.device.createTexture({
      size: { width: renderSettings.displayWidth, height: renderSettings.displayHeight, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.lastFrameBufferView = this.lastFrameBuffer.createView();

    // Create accumulatedFrameTexture for temporal accumulation
    this.accumulatedFrameTexture = this.device.createTexture({
      size: { width: renderSettings.displayWidth, height: renderSettings.displayHeight, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.accumulatedFrameTextureView = this.accumulatedFrameTexture.createView();

    // Create sampler for display
    this.sampler = this.device.createSampler({
      magFilter: 'nearest', // This creates the pixelated look
      minFilter: 'nearest',
    });

    this.computePipeline = this.createComputePipeline();
    this.displayPipeline = this.createDisplayPipeline();
    this.copyPipeline = this.createCopyPipeline();
    this.computeBindGroup = this.createComputeBindGroup();
    this.displayBindGroup = this.createDisplayBindGroup();
    this.updateCameraData();
    this.updateUniformsData();
    
    // Initialize copy dimensions buffer
    const copyDimensionsData = new Float32Array([
      renderSettings.displayWidth,
      renderSettings.displayHeight
    ]);
    this.device.queue.writeBuffer(this.copyDimensionsBuffer, 0, copyDimensionsData);
  }

  private createComputePipeline(): GPUComputePipeline {
    const shaderModule = this.device.createShaderModule({
      label: 'Ray tracer compute shader',
      code: raytracerComputeShader,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: 'write-only', format: 'rgba8unorm' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        }
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    return this.device.createComputePipeline({
      label: 'Ray tracer compute pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'computeMain',
      }
    });
  }

  private createDisplayPipeline(): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      label: 'Display shader',
      code: displayShader,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          storageTexture: { access: 'write-only', format: 'rgba8unorm' }
        }
      ]
    });

    const uniformsBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, uniformsBindGroupLayout]
    });

    return this.device.createRenderPipeline({
      label: 'Display pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format
        }]
      },
      primitive: {
        topology: 'triangle-list',
      }
    });
  }

  private createCopyPipeline(): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({
      label: 'Copy shader',
      code: `
        @group(0) @binding(0) var inputTexture: texture_2d<f32>;
        @group(0) @binding(1) var inputSampler: sampler;
        @group(1) @binding(0) var<uniform> dimensions: vec2f;

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
          let uv = vec2f(position.xy) / dimensions;
          return textureSample(inputTexture, inputSampler, uv);
        }
      `
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    });

    const uniformsBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, uniformsBindGroupLayout]
    });

    return this.device.createRenderPipeline({
      label: 'Copy pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: 'rgba8unorm'
        }]
      },
      primitive: {
        topology: 'triangle-list',
      }
    });
  }

  private createComputeBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.cameraBuffer }
        },
        {
          binding: 1,
          resource: this.renderTextureView
        },
        {
          binding: 2,
          resource: { buffer: this.maxBouncesBuffer }
        },
        {
          binding: 3,
          resource: { buffer: this.raysPerPixelBuffer }
        },
        {
          binding: 4,
          resource: { buffer: this.frameCountBuffer }
        }
      ]
    });
  }

  private createDisplayBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.displayPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.renderTextureView
        },
        {
          binding: 1,
          resource: this.sampler
        },
        {
          binding: 2,
          resource: this.accumulatedFrameTextureView
        },
        {
          binding: 3,
          resource: this.lastFrameBufferView
        }
      ]
    });
  }

  private updateCameraData(): void {
    const cameraData = this.camera.getShaderData();
    
    const bufferData = new Float32Array([
      cameraData.position[0], cameraData.position[1], cameraData.position[2], 0,
      cameraData.forward[0], cameraData.forward[1], cameraData.forward[2], 0,
      cameraData.up[0], cameraData.up[1], cameraData.up[2], 0,
      cameraData.right[0], cameraData.right[1], cameraData.right[2], 0,
      cameraData.fov, cameraData.aspect, this.renderSettings.renderWidth, this.renderSettings.renderHeight
    ]);
    
    this.device.queue.writeBuffer(this.cameraBuffer, 0, bufferData);
  }

  private updateUniformsData(): void {
    const uniformsData = new Float32Array([
      this.renderSettings.renderWidth,
      this.renderSettings.renderHeight,
      this.renderSettings.displayWidth,
      this.renderSettings.displayHeight,
      0.0 // frame_count - will be updated each frame
    ]);
    
    this.device.queue.writeBuffer(this.uniformsBuffer, 0, uniformsData);
  }

  private updateMaxBouncesData(): void {
    const maxBouncesData = new Uint32Array([this.renderSettings.maxBounces]);
    this.device.queue.writeBuffer(this.maxBouncesBuffer, 0, maxBouncesData);
  }

  private updateRaysPerPixelData(): void {
    const raysPerPixelData = new Uint32Array([this.renderSettings.raysPerPixel]);
    this.device.queue.writeBuffer(this.raysPerPixelBuffer, 0, raysPerPixelData);
  }

  private updateFrameCountData(frameCount: number): void {
    const frameCountData = new Uint32Array([frameCount]);
    this.device.queue.writeBuffer(this.frameCountBuffer, 0, frameCountData);
  }

  private updateDisplayFrameCount(frameCount: number): void {
    const uniformsData = new Float32Array([
      this.renderSettings.renderWidth,
      this.renderSettings.renderHeight,
      this.renderSettings.displayWidth,
      this.renderSettings.displayHeight,
      frameCount
    ]);
    
    this.device.queue.writeBuffer(this.uniformsBuffer, 0, uniformsData);
  }

  // Reset temporal accumulation by clearing the accumulated frame texture
  resetAccumulation(): void {
    // Clear the accumulated frame texture to start fresh
    const commandEncoder = this.device.createCommandEncoder();
    
    const clearPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.accumulatedFrameTextureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });
    clearPass.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  // Reset both accumulation and frame count
  resetTemporalAccumulation(): void {
    this.resetAccumulation();
    // Reset frame count to 0 to restart accumulation
    this.updateDisplayFrameCount(0);
  }

  render(frameCount: number = 0): void {
    this.updateCameraData();
    this.updateMaxBouncesData();
    this.updateRaysPerPixelData();
    this.updateFrameCountData(frameCount);
    this.updateDisplayFrameCount(frameCount);
    
    const commandEncoder = this.device.createCommandEncoder();
    
    // Step 1: Run compute shader to generate the raytraced image
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    
    // Calculate workgroup count based on render resolution
    const workgroupSizeX = 16;
    const workgroupSizeY = 16;
    const workgroupCountX = Math.ceil(this.renderSettings.renderWidth / workgroupSizeX);
    const workgroupCountY = Math.ceil(this.renderSettings.renderHeight / workgroupSizeY);
    
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
    computePass.end();
    
    // Step 2: Render the scaled-up result to the display
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    renderPass.setPipeline(this.displayPipeline);
    
    // Create a new bind group each frame with the current result as previous frame
    const currentDisplayBindGroup = this.device.createBindGroup({
      layout: this.displayPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.renderTextureView
        },
        {
          binding: 1,
          resource: this.sampler
        },
        {
          binding: 2,
          resource: this.accumulatedFrameTextureView
        },
        {
          binding: 3,
          resource: this.lastFrameBufferView
        }
      ]
    });
    
    renderPass.setBindGroup(0, currentDisplayBindGroup);
    renderPass.setBindGroup(1, this.device.createBindGroup({
      layout: this.displayPipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformsBuffer }
      }]
    }));
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
    
    // Copy the blended result to the accumulated frame texture for next frame
    const copyCommandEncoder = this.device.createCommandEncoder();
    
    // Create bind group for copying
    const copyBindGroup = this.device.createBindGroup({
      layout: this.copyPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.lastFrameBufferView
        },
        {
          binding: 1,
          resource: this.sampler
        }
      ]
    });

    // Render the copy
    const copyRenderPass = copyCommandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.accumulatedFrameTextureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    copyRenderPass.setPipeline(this.copyPipeline);
    copyRenderPass.setBindGroup(0, copyBindGroup);
    copyRenderPass.setBindGroup(1, this.device.createBindGroup({
      layout: this.copyPipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this.copyDimensionsBuffer }
      }]
    }));
    copyRenderPass.draw(6, 1, 0, 0);
    copyRenderPass.end();

    this.device.queue.submit([copyCommandEncoder.finish()]);
  }

  // Method to update camera (useful for interactive camera movement)
  updateCamera(camera: Camera): void {
    this.camera = camera;
    this.updateCameraData();
    // Reset temporal accumulation when camera changes
    this.resetTemporalAccumulation();
  }

  // Method to get the lastFrameBuffer for debugging display
  getLastFrameBuffer(): GPUTexture {
    return this.lastFrameBuffer;
  }

  // Method to get the device for external use
  getDevice(): GPUDevice {
    return this.device;
  }

  // Method to update render settings (useful for dynamic resolution control)
  updateRenderSettings(settings: RenderSettings): void {
    this.renderSettings = settings;
    // Reset temporal accumulation when render settings change
    this.resetTemporalAccumulation();
    
    // Recreate render texture if dimensions changed
    if (settings.renderWidth !== this.renderTexture.width || 
        settings.renderHeight !== this.renderTexture.height) {
      this.renderTexture.destroy();
      
      this.renderTexture = this.device.createTexture({
        size: { width: settings.renderWidth, height: settings.renderHeight, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.renderTextureView = this.renderTexture.createView();
      
      // Recreate bind groups with new texture
      this.computeBindGroup = this.createComputeBindGroup();
      this.displayBindGroup = this.createDisplayBindGroup();
    }
    
    // Recreate lastFrameBuffer if display dimensions changed
    if (settings.displayWidth !== this.lastFrameBuffer.width || 
        settings.displayHeight !== this.lastFrameBuffer.height) {
      this.lastFrameBuffer.destroy();
      this.accumulatedFrameTexture.destroy();
      
      this.lastFrameBuffer = this.device.createTexture({
        size: { width: settings.displayWidth, height: settings.displayHeight, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.lastFrameBufferView = this.lastFrameBuffer.createView();
      
      this.accumulatedFrameTexture = this.device.createTexture({
        size: { width: settings.displayWidth, height: settings.displayHeight, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.accumulatedFrameTextureView = this.accumulatedFrameTexture.createView();
      
      // Recreate display bind group with new buffer
      this.displayBindGroup = this.createDisplayBindGroup();
      
      // Recreate copy pipeline with new dimensions
      this.copyPipeline = this.createCopyPipeline();
      
      // Update copy dimensions buffer
      const copyDimensionsData = new Float32Array([
        settings.displayWidth,
        settings.displayHeight
      ]);
      this.device.queue.writeBuffer(this.copyDimensionsBuffer, 0, copyDimensionsData);
    }
    
    this.updateUniformsData();
  }


}
