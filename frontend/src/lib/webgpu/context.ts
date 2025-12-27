/**
 * WebGPU device and context initialization utilities.
 */

export class WebGPUNotSupportedError extends Error {
  constructor(message = "WebGPU is not supported in this browser") {
    super(message);
    this.name = "WebGPUNotSupportedError";
  }
}

export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

/**
 * Initialize WebGPU device and canvas context.
 * @throws {WebGPUNotSupportedError} if WebGPU is not available
 */
export async function initWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
  if (!navigator.gpu) {
    throw new WebGPUNotSupportedError();
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (!adapter) {
    throw new WebGPUNotSupportedError("No GPU adapter found");
  }

  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {
      maxStorageBufferBindingSize: 128 * 1024 * 1024, // 128MB for large scenes
    },
  });

  // Handle device loss
  device.lost.then((info) => {
    console.error("WebGPU device lost:", info.message);
    if (info.reason !== "destroyed") {
      // Could attempt to reinitialize here
      console.error("Unexpected device loss, reason:", info.reason);
    }
  });

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("Failed to get WebGPU context from canvas");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  return { device, context, format };
}

/**
 * Check if WebGPU is supported without initializing.
 */
export async function checkWebGPUSupport(): Promise<{
  supported: boolean;
  reason?: string;
}> {
  if (!navigator.gpu) {
    return { supported: false, reason: "WebGPU API not available" };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: "No GPU adapter found" };
    }
    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
