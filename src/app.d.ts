// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

// WebGPU type definitions
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Navigator {
		gpu: GPU;
	}

	interface GPU {
		requestAdapter(): Promise<GPUAdapter | null>;
		getPreferredCanvasFormat(): GPUTextureFormat;
	}

	interface GPUAdapter {
		requestDevice(): Promise<GPUDevice>;
	}

	interface GPUDevice {
		createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
		createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
		createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
		createCommandEncoder(): GPUCommandEncoder;
		createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
		createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
		createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
		createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
		createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
		createSampler(descriptor: GPUSamplerDescriptor): GPUSampler;
		queue: GPUQueue;
	}

	interface GPUShaderModule {
		label?: string;
	}

	interface GPURenderPipeline {
		label?: string;
		getBindGroupLayout(index: number): GPUBindGroupLayout;
	}

	interface GPUComputePipeline {
		label?: string;
		getBindGroupLayout(index: number): GPUBindGroupLayout;
	}

	interface GPUCommandEncoder {
		beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
		beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
		finish(): GPUCommandBuffer;
	}

	interface GPURenderPassEncoder {
		setPipeline(pipeline: GPURenderPipeline): void;
		setBindGroup(index: number, bindGroup: GPUBindGroup): void;
		draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
		end(): void;
	}

	interface GPUComputePassEncoder {
		setPipeline(pipeline: GPUComputePipeline): void;
		setBindGroup(index: number, bindGroup: GPUBindGroup): void;
		dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
		end(): void;
	}

	interface GPUCommandBuffer {}

	interface GPUQueue {
		submit(commandBuffers: GPUCommandBuffer[]): void;
		writeBuffer(buffer: GPUBuffer, offset: number, data: BufferSource): void;
	}

	interface GPURenderPassDescriptor {
		colorAttachments: GPURenderPassColorAttachment[];
	}

	interface GPUComputePassDescriptor {
		label?: string;
	}

	interface GPURenderPassColorAttachment {
		view: GPUTextureView;
		clearValue?: GPUColor;
		loadOp: GPULoadOp;
		storeOp: GPUStoreOp;
	}

	interface GPUTextureView {}

	interface GPUTexture {
		createView(): GPUTextureView;
		width: number;
		height: number;
		destroy(): void;
	}

	interface GPUTextureDescriptor {
		size: GPUExtent3D;
		format: GPUTextureFormat;
		usage: GPUTextureUsageFlags;
		label?: string;
	}

	interface GPUExtent3D {
		width: number;
		height: number;
		depthOrArrayLayers?: number;
	}

	interface GPUSampler {
		label?: string;
	}

	interface GPUSamplerDescriptor {
		label?: string;
		magFilter?: GPUFilterMode;
		minFilter?: GPUFilterMode;
	}

	type GPUFilterMode = 'nearest' | 'linear';

	interface GPUColor {
		r: number;
		g: number;
		b: number;
		a: number;
	}

	type GPULoadOp = 'load' | 'clear';
	type GPUStoreOp = 'store' | 'discard';

	interface GPURenderPipelineDescriptor {
		label?: string;
		layout: GPUPipelineLayout | 'auto';
		vertex: GPUVertexState;
		fragment?: GPUFragmentState;
		primitive: GPUPrimitiveState;
	}

	interface GPUComputePipelineDescriptor {
		label?: string;
		layout: GPUPipelineLayout | 'auto';
		compute: GPUComputeState;
	}

	interface GPUComputeState {
		module: GPUShaderModule;
		entryPoint: string;
	}

	interface GPUPipelineLayout {}

	interface GPUVertexState {
		module: GPUShaderModule;
		entryPoint: string;
	}

	interface GPUFragmentState {
		module: GPUShaderModule;
		entryPoint: string;
		targets: GPUColorTargetState[];
	}

	interface GPUColorTargetState {
		format: GPUTextureFormat;
	}

	interface GPUPrimitiveState {
		topology: GPUPrimitiveTopology;
	}

	type GPUPrimitiveTopology = 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip';

	interface GPUShaderModuleDescriptor {
		label?: string;
		code: string;
	}

	interface GPUCanvasContext {
		configure(configuration: GPUCanvasConfiguration): void;
		getCurrentTexture(): GPUTexture;
	}

	interface GPUCanvasConfiguration {
		device: GPUDevice;
		format: GPUTextureFormat;
		alphaMode?: GPUCanvasAlphaMode;
	}

	type GPUTextureFormat = 'bgra8unorm' | 'rgba8unorm' | 'rgba8unorm-srgb';
	type GPUCanvasAlphaMode = 'opaque' | 'premultiplied' | 'unpremultiplied';

	// New types for ray tracer
	interface GPUBuffer {
		label?: string;
	}

	interface GPUBufferDescriptor {
		size: number;
		usage: GPUBufferUsageFlags;
		label?: string;
	}

	type GPUBufferUsageFlags = number;
	const GPUBufferUsage: {
		MAP_READ: number;
		MAP_WRITE: number;
		COPY_SRC: number;
		COPY_DST: number;
		INDEX: number;
		VERTEX: number;
		UNIFORM: number;
		STORAGE: number;
		INDIRECT: number;
		QUERY_RESOLVE: number;
	};

	type GPUTextureUsageFlags = number;
	const GPUTextureUsage: {
		COPY_SRC: number;
		COPY_DST: number;
		TEXTURE_BINDING: number;
		STORAGE_BINDING: number;
		RENDER_ATTACHMENT: number;
	};

	interface GPUBindGroupLayout {
		label?: string;
	}

	interface GPUBindGroupLayoutDescriptor {
		entries: GPUBindGroupLayoutEntry[];
		label?: string;
	}

	interface GPUBindGroupLayoutEntry {
		binding: number;
		visibility: GPUShaderStageFlags;
		buffer?: GPUBufferBindingLayout;
		sampler?: GPUSamplerBindingLayout;
		texture?: GPUTextureBindingLayout;
		storageTexture?: GPUStorageTextureBindingLayout;
		externalTexture?: GPUExternalTextureBindingLayout;
	}

	interface GPUBufferBindingLayout {
		type: 'uniform' | 'storage' | 'read-only-storage';
		hasDynamicOffset?: boolean;
		minBindingSize?: number;
	}

	interface GPUSamplerBindingLayout {}
	interface GPUTextureBindingLayout {}
	interface GPUStorageTextureBindingLayout {
		access: 'write-only' | 'read-only' | 'read-write';
		format: GPUTextureFormat;
	}
	interface GPUExternalTextureBindingLayout {}

	type GPUShaderStageFlags = number;
	const GPUShaderStage: {
		VERTEX: number;
		FRAGMENT: number;
		COMPUTE: number;
	};

	interface GPUPipelineLayoutDescriptor {
		bindGroupLayouts: GPUBindGroupLayout[];
		label?: string;
	}

	interface GPUBindGroup {
		label?: string;
	}

	interface GPUBindGroupDescriptor {
		layout: GPUBindGroupLayout;
		entries: GPUBindGroupEntry[];
		label?: string;
	}

	interface GPUBindGroupEntry {
		binding: number;
		resource: GPUBindingResource;
	}

	type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding | GPUExternalTexture;
	interface GPUSampler {}
	interface GPUBufferBinding {
		buffer: GPUBuffer;
		offset?: number;
		size?: number;
	}
	interface GPUExternalTexture {}
}

export {};
