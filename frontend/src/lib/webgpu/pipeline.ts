/**
 * WebGPU render pipeline configuration for Gaussian splatting.
 */

import splatShaderCode from "./shaders/splat.wgsl?raw";

export interface PipelineConfig {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
}

/**
 * Create the Gaussian splat render pipeline.
 */
export function createSplatPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): PipelineConfig {
  // Bind group layout for uniforms and storage buffers
  const bindGroupLayout = device.createBindGroupLayout({
    label: "Splat Bind Group Layout",
    entries: [
      // Uniform buffer (camera matrices, viewport)
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      // Splat data storage buffer
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
      // Sorted indices storage buffer
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    label: "Splat Pipeline Layout",
    bindGroupLayouts: [bindGroupLayout],
  });

  // Create shader module
  const shaderModule = device.createShaderModule({
    label: "Splat Shader",
    code: splatShaderCode,
  });

  // Create render pipeline
  const pipeline = device.createRenderPipeline({
    label: "Splat Render Pipeline",
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [
        {
          format,
          blend: {
            // Premultiplied alpha blending
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
          writeMask: GPUColorWrite.ALL,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none", // Billboards face camera from both sides
    },
    // No depth buffer - we rely on sorted order
  });

  return { pipeline, bindGroupLayout };
}

/**
 * Uniform buffer layout (must match shader):
 * - viewMatrix: mat4x4<f32> (64 bytes)
 * - projectionMatrix: mat4x4<f32> (64 bytes)
 * - viewportSize: vec2<f32> (8 bytes)
 * - focalLength: vec2<f32> (8 bytes)
 * Total: 144 bytes, aligned to 256 bytes
 */
export const UNIFORM_BUFFER_SIZE = 256;

/**
 * Splat data layout (must match shader):
 * - position: vec3<f32> (12 bytes)
 * - opacity: f32 (4 bytes)
 * - color: vec3<f32> (12 bytes)
 * - padding0: f32 (4 bytes)
 * - scale: vec3<f32> (12 bytes)
 * - padding1: f32 (4 bytes)
 * - rotation: vec4<f32> (16 bytes)
 * Total: 64 bytes per splat
 */
export const BYTES_PER_SPLAT = 64;
