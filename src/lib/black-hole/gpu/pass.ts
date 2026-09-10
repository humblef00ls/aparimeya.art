import { FRAME_UNIFORM_BYTES } from "./uniforms";

/** A fullscreen pass owns a uniform buffer and lazily rebuilt texture bindings. */
export class FullscreenPass {
  private readonly device: GPUDevice;
  private readonly buffer: GPUBuffer;
  private readonly layout: GPUBindGroupLayout;
  private readonly samplers: [GPUSampler, GPUSampler];
  private group?: GPUBindGroup;
  private views: GPUTextureView[] = [];
  constructor(
    device: GPUDevice,
    layout: GPUBindGroupLayout,
    samplers: [GPUSampler, GPUSampler],
    readonly pipeline: GPURenderPipeline,
  ) {
    this.device = device;
    this.layout = layout;
    this.samplers = samplers;
    this.buffer = device.createBuffer({
      label: "Pass uniforms",
      size: FRAME_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  draw(
    encoder: GPUCommandEncoder,
    output: GPUTextureView,
    data: Float32Array,
    textures: [GPUTextureView, GPUTextureView, GPUTextureView],
  ) {
    this.device.queue.writeBuffer(this.buffer, 0, data);
    if (!this.group || textures.some((v, i) => v !== this.views[i])) {
      this.views = textures;
      this.group = this.device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.buffer } },
          { binding: 1, resource: this.samplers[0] },
          ...textures.map((resource, i) => ({ binding: i + 2, resource })),
          { binding: 5, resource: this.samplers[1] },
        ],
      });
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: output,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.group);
    pass.draw(6);
    pass.end();
  }
  dispose() {
    this.buffer.destroy();
    this.group = undefined;
    this.views = [];
  }
}
