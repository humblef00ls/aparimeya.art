import raytracerComputeShader from './shaders/raytracer-compute.wgsl?raw';
import displayShader from './shaders/display.wgsl?raw';
import type { Camera } from './camera/camera';

export interface RenderSettings {
  renderWidth: number;
  renderHeight: number;
  displayWidth: number;
  displayHeight: number;
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
  private renderTexture: GPUTexture;
  private renderTextureView: GPUTextureView;
  private sampler: GPUSampler;
  private computeBindGroup: GPUBindGroup;
  private displayBindGroup: GPUBindGroup;
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
      size: 16, // 4 floats: render_width, render_height, display_width, display_height
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create render texture (lower resolution)
    this.renderTexture = this.device.createTexture({
      size: [renderSettings.renderWidth, renderSettings.renderHeight],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.renderTextureView = this.renderTexture.createView();

    // Create sampler for display
    this.sampler = this.device.createSampler({
      magFilter: 'nearest', // This creates the pixelated look
      minFilter: 'nearest',
    });

    this.computePipeline = this.createComputePipeline();
    this.displayPipeline = this.createDisplayPipeline();
    this.computeBindGroup = this.createComputeBindGroup();
    this.displayBindGroup = this.createDisplayBindGroup();
    this.updateCameraData();
    this.updateUniformsData();
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
      this.renderSettings.displayHeight
    ]);
    
    this.device.queue.writeBuffer(this.uniformsBuffer, 0, uniformsData);
  }

  render(): void {
    this.updateCameraData();
    
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
    renderPass.setBindGroup(0, this.displayBindGroup);
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
  }

  // Method to update camera (useful for interactive camera movement)
  updateCamera(camera: Camera): void {
    this.camera = camera;
    this.updateCameraData();
  }

  // Method to update render settings (useful for dynamic resolution control)
  updateRenderSettings(settings: RenderSettings): void {
    this.renderSettings = settings;
    
    // Recreate render texture if dimensions changed
    if (settings.renderWidth !== this.renderTexture.width || 
        settings.renderHeight !== this.renderTexture.height) {
      this.renderTexture.destroy();
      this.renderTexture = this.device.createTexture({
        size: [settings.renderWidth, settings.renderHeight],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.renderTextureView = this.renderTexture.createView();
      
      // Recreate bind groups with new texture
      this.computeBindGroup = this.createComputeBindGroup();
      this.displayBindGroup = this.createDisplayBindGroup();
    }
    
    this.updateUniformsData();
  }
}
