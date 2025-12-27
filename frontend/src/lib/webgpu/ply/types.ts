/**
 * Types for 3D Gaussian Splatting PLY data.
 */

/**
 * Parsed splat data ready for GPU upload.
 * All arrays are Float32Array for direct GPU buffer mapping.
 */
export interface SplatData {
  /** Number of splats */
  count: number;
  /** Position (x, y, z) per splat, length = count * 3 */
  positions: Float32Array;
  /** Color (r, g, b) per splat, normalized 0-1, length = count * 3 */
  colors: Float32Array;
  /** Opacity per splat, normalized 0-1, length = count */
  opacities: Float32Array;
  /** Scale (sx, sy, sz) per splat, length = count * 3 */
  scales: Float32Array;
  /** Rotation quaternion (w, x, y, z) per splat, normalized, length = count * 4 */
  rotations: Float32Array;
}

/**
 * PLY property definition from header.
 */
export interface PlyProperty {
  name: string;
  type: "float" | "double" | "uchar" | "int" | "uint" | "short" | "ushort";
  offset: number;
  size: number;
}

/**
 * PLY header parse result.
 */
export interface PlyHeader {
  format: "binary_little_endian" | "binary_big_endian" | "ascii";
  vertexCount: number;
  properties: PlyProperty[];
  headerLength: number;
  bytesPerVertex: number;
}

/**
 * Property byte sizes for PLY types.
 */
export const PLY_TYPE_SIZES: Record<PlyProperty["type"], number> = {
  float: 4,
  double: 8,
  uchar: 1,
  int: 4,
  uint: 4,
  short: 2,
  ushort: 2,
};
