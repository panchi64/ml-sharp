/**
 * Main Gaussian Splat Renderer class.
 * Manages WebGPU lifecycle, camera, sorting, and rendering.
 */

import { vec3 } from "gl-matrix";
import { initWebGPU, type WebGPUContext } from "./context";
import { createSplatPipeline, type PipelineConfig } from "./pipeline";
import {
  createSplatBuffers,
  updateUniforms,
  updateIndices,
  destroyBuffers,
  type SplatBuffers,
} from "./buffers";
import { OrbitCamera } from "./camera/orbit-camera";
import { CameraController } from "./camera/controller";
import { sortSplatsByDepth } from "./sorting/cpu-sort";
import type { SplatData } from "./ply/types";

export interface RendererStats {
  fps: number;
  splatCount: number;
  sortTimeMs: number;
  renderTimeMs: number;
}

export class GaussianSplatRenderer {
  private canvas: HTMLCanvasElement;
  private gpuContext: WebGPUContext | null = null;
  private pipeline: PipelineConfig | null = null;
  private buffers: SplatBuffers | null = null;
  private bindGroup: GPUBindGroup | null = null;

  // Camera
  private camera: OrbitCamera;
  private controller: CameraController | null = null;

  // Splat data (kept for sorting)
  private splatData: SplatData | null = null;
  private sortedIndices: Uint32Array | null = null;

  // Render state
  private rafId: number | null = null;
  private isInitialized = false;
  private needsSort = true;
  private lastCameraPosition = vec3.create();

  // Stats
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;
  private lastSortTime = 0;
  private lastRenderTime = 0;

  // Callbacks
  private onStatsUpdate?: (stats: RendererStats) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.camera = new OrbitCamera();
  }

  /**
   * Initialize WebGPU and create render pipeline.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize WebGPU
      this.gpuContext = await initWebGPU(this.canvas);

      // Create render pipeline
      this.pipeline = createSplatPipeline(this.gpuContext.device, this.gpuContext.format);

      // Setup camera controller
      this.controller = new CameraController(this.camera, this.canvas);

      // Set initial aspect ratio
      this.handleResize();

      this.isInitialized = true;

      // Start render loop
      this.startRenderLoop();
    } catch (error) {
      console.error("Failed to initialize WebGPU renderer:", error);
      throw error;
    }
  }

  /**
   * Load splat data for rendering.
   */
  loadSplats(data: SplatData): void {
    if (!this.gpuContext || !this.pipeline) {
      console.error("Renderer not initialized");
      return;
    }

    // Clean up existing buffers
    if (this.buffers) {
      destroyBuffers(this.buffers);
    }

    // Store data for sorting
    this.splatData = data;

    // Create GPU buffers
    this.buffers = createSplatBuffers(this.gpuContext.device, data);

    // Create sorted indices array
    this.sortedIndices = new Uint32Array(data.count);
    for (let i = 0; i < data.count; i++) {
      this.sortedIndices[i] = i;
    }

    // Create bind group
    this.bindGroup = this.gpuContext.device.createBindGroup({
      label: "Splat Bind Group",
      layout: this.pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.buffers.uniformBuffer } },
        { binding: 1, resource: { buffer: this.buffers.dataBuffer } },
        { binding: 2, resource: { buffer: this.buffers.indexBuffer } },
      ],
    });

    // Fit camera to scene
    this.fitCameraToScene();

    // Force sort on first frame
    this.needsSort = true;
    vec3.copy(this.lastCameraPosition, this.camera.getPosition());
  }

  /**
   * Handle canvas resize.
   */
  handleResize(): void {
    if (!this.gpuContext) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;

      // Reconfigure context
      this.gpuContext.context.configure({
        device: this.gpuContext.device,
        format: this.gpuContext.format,
        alphaMode: "premultiplied",
      });

      // Update camera aspect ratio
      this.camera.setAspect(width / height);
    }
  }

  /**
   * Fit camera to encompass all splats.
   */
  private fitCameraToScene(): void {
    if (!this.splatData) return;

    const positions = this.splatData.positions;
    const count = this.splatData.count;

    if (count === 0) return;

    // Calculate bounding box
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    // Calculate center and radius
    const center = vec3.fromValues(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    const size = vec3.fromValues(maxX - minX, maxY - minY, maxZ - minZ);
    const radius = vec3.length(size) / 2;

    // Fit camera
    this.camera.fitToBounds(center, radius);
  }

  /**
   * Start the render loop.
   */
  private startRenderLoop(): void {
    const renderFrame = (timestamp: number) => {
      this.rafId = requestAnimationFrame(renderFrame);

      // Update FPS counter
      this.frameCount++;
      if (timestamp - this.lastFrameTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = timestamp;
      }

      this.render();
    };

    this.rafId = requestAnimationFrame(renderFrame);
  }

  /**
   * Render a single frame.
   */
  private render(): void {
    if (!this.gpuContext || !this.pipeline || !this.buffers || !this.bindGroup) {
      return;
    }

    const { device, context } = this.gpuContext;

    // Handle resize
    this.handleResize();

    // Check if camera moved (need to re-sort)
    const currentPos = this.camera.getPosition();
    const moved =
      vec3.squaredDistance(currentPos, this.lastCameraPosition) > 0.0001 ||
      this.camera.isDirty();

    if (moved) {
      this.needsSort = true;
      vec3.copy(this.lastCameraPosition, currentPos);
    }

    // Sort splats if needed
    if (this.needsSort && this.splatData && this.sortedIndices) {
      const sortStart = performance.now();

      sortSplatsByDepth(
        this.splatData.positions,
        this.camera.getViewMatrix(),
        this.sortedIndices
      );

      updateIndices(device, this.buffers.indexBuffer, this.sortedIndices);

      this.lastSortTime = performance.now() - sortStart;
      this.needsSort = false;
    }

    this.camera.clearDirty();

    // Update uniforms
    updateUniforms(
      device,
      this.buffers.uniformBuffer,
      this.camera.getViewMatrix(),
      this.camera.getProjectionMatrix(),
      this.canvas.width,
      this.canvas.height,
      this.camera.getFov()
    );

    // Render
    const renderStart = performance.now();

    const textureView = context.getCurrentTexture().createView();

    const commandEncoder = device.createCommandEncoder({
      label: "Render Command Encoder",
    });

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.pipeline.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6, this.buffers.count); // 6 vertices per quad, N instances
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    this.lastRenderTime = performance.now() - renderStart;

    // Notify stats update
    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        fps: this.fps,
        splatCount: this.buffers.count,
        sortTimeMs: this.lastSortTime,
        renderTimeMs: this.lastRenderTime,
      });
    }
  }

  /**
   * Set stats update callback.
   */
  setStatsCallback(callback: (stats: RendererStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Get current stats.
   */
  getStats(): RendererStats {
    return {
      fps: this.fps,
      splatCount: this.buffers?.count ?? 0,
      sortTimeMs: this.lastSortTime,
      renderTimeMs: this.lastRenderTime,
    };
  }

  /**
   * Reset camera to default position.
   */
  resetCamera(): void {
    if (this.splatData) {
      this.fitCameraToScene();
    } else {
      this.camera.reset();
    }
    this.needsSort = true;
  }

  /**
   * Check if renderer is initialized.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if splat data is loaded.
   */
  hasData(): boolean {
    return this.splatData !== null;
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    // Stop render loop
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Dispose controller
    if (this.controller) {
      this.controller.dispose();
      this.controller = null;
    }

    // Destroy buffers
    if (this.buffers) {
      destroyBuffers(this.buffers);
      this.buffers = null;
    }

    // Clear references
    this.bindGroup = null;
    this.pipeline = null;
    this.splatData = null;
    this.sortedIndices = null;

    // Note: We don't destroy the device as it may be shared
    this.gpuContext = null;
    this.isInitialized = false;
  }
}
