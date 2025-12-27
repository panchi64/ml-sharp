/**
 * GPU buffer management for Gaussian splatting.
 */

import type { SplatData } from "./ply/types";
import { BYTES_PER_SPLAT, UNIFORM_BUFFER_SIZE } from "./pipeline";

export interface SplatBuffers {
  /** Packed splat data (position, color, scale, rotation, opacity) */
  dataBuffer: GPUBuffer;
  /** Sorted indices for rendering order */
  indexBuffer: GPUBuffer;
  /** Camera uniforms */
  uniformBuffer: GPUBuffer;
  /** Number of splats */
  count: number;
}

/**
 * Create GPU buffers for splat data.
 */
export function createSplatBuffers(device: GPUDevice, splatData: SplatData): SplatBuffers {
  const count = splatData.count;

  // Create and fill splat data buffer
  const dataBuffer = device.createBuffer({
    label: "Splat Data Buffer",
    size: count * BYTES_PER_SPLAT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  const dataArray = new Float32Array(dataBuffer.getMappedRange());
  packSplatData(splatData, dataArray);
  dataBuffer.unmap();

  // Create index buffer (will be updated each frame during sorting)
  const indexBuffer = device.createBuffer({
    label: "Sorted Index Buffer",
    size: count * 4, // u32 per index
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Initialize indices (0, 1, 2, ...)
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    indices[i] = i;
  }
  device.queue.writeBuffer(indexBuffer, 0, indices);

  // Create uniform buffer
  const uniformBuffer = device.createBuffer({
    label: "Uniform Buffer",
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return { dataBuffer, indexBuffer, uniformBuffer, count };
}

/**
 * Pack SplatData into GPU-ready format.
 * Layout per splat (64 bytes):
 * - position: vec3<f32> (12 bytes)
 * - opacity: f32 (4 bytes)
 * - color: vec3<f32> (12 bytes)
 * - padding0: f32 (4 bytes)
 * - scale: vec3<f32> (12 bytes)
 * - padding1: f32 (4 bytes)
 * - rotation: vec4<f32> (16 bytes)
 */
function packSplatData(data: SplatData, output: Float32Array): void {
  const floatsPerSplat = BYTES_PER_SPLAT / 4; // 16 floats

  for (let i = 0; i < data.count; i++) {
    const offset = i * floatsPerSplat;

    // Position (vec3)
    output[offset + 0] = data.positions[i * 3];
    output[offset + 1] = data.positions[i * 3 + 1];
    output[offset + 2] = data.positions[i * 3 + 2];

    // Opacity (f32)
    output[offset + 3] = data.opacities[i];

    // Color (vec3)
    output[offset + 4] = data.colors[i * 3];
    output[offset + 5] = data.colors[i * 3 + 1];
    output[offset + 6] = data.colors[i * 3 + 2];

    // Padding
    output[offset + 7] = 0;

    // Scale (vec3)
    output[offset + 8] = data.scales[i * 3];
    output[offset + 9] = data.scales[i * 3 + 1];
    output[offset + 10] = data.scales[i * 3 + 2];

    // Padding
    output[offset + 11] = 0;

    // Rotation (vec4) - quaternion w, x, y, z
    output[offset + 12] = data.rotations[i * 4];
    output[offset + 13] = data.rotations[i * 4 + 1];
    output[offset + 14] = data.rotations[i * 4 + 2];
    output[offset + 15] = data.rotations[i * 4 + 3];
  }
}

/**
 * Update uniform buffer with camera data.
 */
export function updateUniforms(
  device: GPUDevice,
  uniformBuffer: GPUBuffer,
  viewMatrix: Float32Array,
  projectionMatrix: Float32Array,
  viewportWidth: number,
  viewportHeight: number,
  fov: number
): void {
  const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
  const floatView = new Float32Array(data);

  // View matrix (16 floats)
  floatView.set(viewMatrix, 0);

  // Projection matrix (16 floats)
  floatView.set(projectionMatrix, 16);

  // Viewport size (2 floats)
  floatView[32] = viewportWidth;
  floatView[33] = viewportHeight;

  // Focal length in pixels (2 floats)
  const fovRad = (fov * Math.PI) / 180;
  const focalY = viewportHeight / (2 * Math.tan(fovRad / 2));
  const focalX = focalY; // Assuming square pixels
  floatView[34] = focalX;
  floatView[35] = focalY;

  device.queue.writeBuffer(uniformBuffer, 0, data);
}

/**
 * Update sorted indices buffer.
 */
export function updateIndices(
  device: GPUDevice,
  indexBuffer: GPUBuffer,
  indices: Uint32Array
): void {
  device.queue.writeBuffer(indexBuffer, 0, indices.buffer, indices.byteOffset, indices.byteLength);
}

/**
 * Destroy buffers and free GPU memory.
 */
export function destroyBuffers(buffers: SplatBuffers): void {
  buffers.dataBuffer.destroy();
  buffers.indexBuffer.destroy();
  buffers.uniformBuffer.destroy();
}
