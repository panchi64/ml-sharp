/**
 * WebGPU Gaussian Splatting Renderer - Public API
 */

// Main renderer
export { GaussianSplatRenderer, type RendererStats } from "./renderer";

// Context and initialization
export { initWebGPU, checkWebGPUSupport, WebGPUNotSupportedError } from "./context";

// PLY parsing and export
export { parsePlyFile } from "./ply/parser";
export { exportToPly } from "./ply/exporter";
export type { SplatData, PlyHeader, PlyProperty } from "./ply/types";

// Camera
export { OrbitCamera } from "./camera/orbit-camera";
export { CameraController, type ControllerOptions } from "./camera/controller";
