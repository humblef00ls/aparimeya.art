/** Owns one linear RGBA16F texture and its render/sample view. */
export class RenderTarget {
  readonly device: GPUDevice;
  readonly label: string;
  texture!: GPUTexture;
  view!: GPUTextureView;
  width = 0;
  height = 0;
  constructor(device: GPUDevice, label: string) {
    this.device = device;
    this.label = label;
    this.resize(1, 1);
  }
  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return;
    const texture = this.device.createTexture({
      label: this.label,
      size: [width, height],
      format: "rgba16float",
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.texture?.destroy();
    this.texture = texture;
    this.view = texture.createView();
    this.width = width;
    this.height = height;
  }
  get bytes() {
    return this.width * this.height * 8;
  }
  dispose() {
    this.texture.destroy();
  }
}
