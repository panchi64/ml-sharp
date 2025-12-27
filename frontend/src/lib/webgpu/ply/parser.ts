/**
 * PLY file parser for 3D Gaussian Splatting format.
 */

import type { SplatData, PlyHeader, PlyProperty } from "./types";
import { PLY_TYPE_SIZES } from "./types";

/**
 * Parse a PLY file buffer into SplatData.
 * Handles the standard 3DGS PLY format with spherical harmonics, opacity, scale, and rotation.
 */
export async function parsePlyFile(buffer: ArrayBuffer): Promise<SplatData> {
  const header = parseHeader(buffer);

  if (header.format === "ascii") {
    throw new Error("ASCII PLY format not supported, use binary format");
  }

  const isLittleEndian = header.format === "binary_little_endian";
  const dataView = new DataView(buffer, header.headerLength);

  const count = header.vertexCount;

  // Pre-allocate typed arrays
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const opacities = new Float32Array(count);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);

  // Find property indices
  const propMap = new Map(header.properties.map((p, i) => [p.name, { prop: p, index: i }]));

  const getPropertyOffset = (name: string): number | null => {
    const entry = propMap.get(name);
    return entry ? entry.prop.offset : null;
  };

  // Required properties
  const xOffset = getPropertyOffset("x");
  const yOffset = getPropertyOffset("y");
  const zOffset = getPropertyOffset("z");

  if (xOffset === null || yOffset === null || zOffset === null) {
    throw new Error("PLY file missing required position properties (x, y, z)");
  }

  // Color properties (DC spherical harmonics)
  const f_dc_0_offset = getPropertyOffset("f_dc_0");
  const f_dc_1_offset = getPropertyOffset("f_dc_1");
  const f_dc_2_offset = getPropertyOffset("f_dc_2");

  // Fallback to direct RGB if no SH coefficients
  const redOffset = getPropertyOffset("red");
  const greenOffset = getPropertyOffset("green");
  const blueOffset = getPropertyOffset("blue");

  const hasColorSH = f_dc_0_offset !== null && f_dc_1_offset !== null && f_dc_2_offset !== null;
  const hasColorRGB = redOffset !== null && greenOffset !== null && blueOffset !== null;

  // Opacity
  const opacityOffset = getPropertyOffset("opacity");

  // Scale
  const scale0Offset = getPropertyOffset("scale_0");
  const scale1Offset = getPropertyOffset("scale_1");
  const scale2Offset = getPropertyOffset("scale_2");

  // Rotation quaternion
  const rot0Offset = getPropertyOffset("rot_0");
  const rot1Offset = getPropertyOffset("rot_1");
  const rot2Offset = getPropertyOffset("rot_2");
  const rot3Offset = getPropertyOffset("rot_3");

  const hasScale = scale0Offset !== null && scale1Offset !== null && scale2Offset !== null;
  const hasRotation =
    rot0Offset !== null && rot1Offset !== null && rot2Offset !== null && rot3Offset !== null;

  const bytesPerVertex = header.bytesPerVertex;

  for (let i = 0; i < count; i++) {
    const baseOffset = i * bytesPerVertex;

    // Position (negate Y to flip from image coordinates to OpenGL)
    positions[i * 3] = dataView.getFloat32(baseOffset + xOffset, isLittleEndian);
    positions[i * 3 + 1] = -dataView.getFloat32(baseOffset + yOffset, isLittleEndian);
    positions[i * 3 + 2] = dataView.getFloat32(baseOffset + zOffset, isLittleEndian);

    // Color
    if (hasColorSH) {
      // Convert DC spherical harmonic to RGB: sigmoid(0.5 * f_dc + 0.5)
      const SH_C0 = 0.28209479177387814;
      const r = dataView.getFloat32(baseOffset + f_dc_0_offset!, isLittleEndian);
      const g = dataView.getFloat32(baseOffset + f_dc_1_offset!, isLittleEndian);
      const b = dataView.getFloat32(baseOffset + f_dc_2_offset!, isLittleEndian);

      colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * r));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * g));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * b));
    } else if (hasColorRGB) {
      // Direct RGB (0-255 -> 0-1)
      const redProp = propMap.get("red")!.prop;
      if (redProp.type === "uchar") {
        colors[i * 3] = dataView.getUint8(baseOffset + redOffset!) / 255;
        colors[i * 3 + 1] = dataView.getUint8(baseOffset + greenOffset!) / 255;
        colors[i * 3 + 2] = dataView.getUint8(baseOffset + blueOffset!) / 255;
      } else {
        colors[i * 3] = dataView.getFloat32(baseOffset + redOffset!, isLittleEndian);
        colors[i * 3 + 1] = dataView.getFloat32(baseOffset + greenOffset!, isLittleEndian);
        colors[i * 3 + 2] = dataView.getFloat32(baseOffset + blueOffset!, isLittleEndian);
      }
    } else {
      // Default white
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }

    // Opacity (sigmoid of logit)
    if (opacityOffset !== null) {
      const logitOpacity = dataView.getFloat32(baseOffset + opacityOffset, isLittleEndian);
      opacities[i] = sigmoid(logitOpacity);
    } else {
      opacities[i] = 1;
    }

    // Scale (exp of log scale)
    if (hasScale) {
      const logScale0 = dataView.getFloat32(baseOffset + scale0Offset!, isLittleEndian);
      const logScale1 = dataView.getFloat32(baseOffset + scale1Offset!, isLittleEndian);
      const logScale2 = dataView.getFloat32(baseOffset + scale2Offset!, isLittleEndian);

      scales[i * 3] = Math.exp(logScale0);
      scales[i * 3 + 1] = Math.exp(logScale1);
      scales[i * 3 + 2] = Math.exp(logScale2);
    } else {
      scales[i * 3] = 0.01;
      scales[i * 3 + 1] = 0.01;
      scales[i * 3 + 2] = 0.01;
    }

    // Rotation quaternion (normalize)
    if (hasRotation) {
      const w = dataView.getFloat32(baseOffset + rot0Offset!, isLittleEndian);
      const x = dataView.getFloat32(baseOffset + rot1Offset!, isLittleEndian);
      const y = dataView.getFloat32(baseOffset + rot2Offset!, isLittleEndian);
      const z = dataView.getFloat32(baseOffset + rot3Offset!, isLittleEndian);

      const len = Math.sqrt(w * w + x * x + y * y + z * z);
      if (len > 0.0001) {
        rotations[i * 4] = w / len;
        rotations[i * 4 + 1] = x / len;
        rotations[i * 4 + 2] = y / len;
        rotations[i * 4 + 3] = z / len;
      } else {
        // Identity quaternion
        rotations[i * 4] = 1;
        rotations[i * 4 + 1] = 0;
        rotations[i * 4 + 2] = 0;
        rotations[i * 4 + 3] = 0;
      }
    } else {
      // Identity quaternion
      rotations[i * 4] = 1;
      rotations[i * 4 + 1] = 0;
      rotations[i * 4 + 2] = 0;
      rotations[i * 4 + 3] = 0;
    }
  }

  return { count, positions, colors, opacities, scales, rotations };
}

/**
 * Parse PLY header to extract format, vertex count, and property definitions.
 */
function parseHeader(buffer: ArrayBuffer): PlyHeader {
  const decoder = new TextDecoder("ascii");
  const maxHeaderSize = Math.min(buffer.byteLength, 65536);
  const headerBytes = new Uint8Array(buffer, 0, maxHeaderSize);
  const headerText = decoder.decode(headerBytes);

  const endHeaderIndex = headerText.indexOf("end_header");
  if (endHeaderIndex === -1) {
    throw new Error("Invalid PLY file: missing end_header");
  }

  const headerLength = endHeaderIndex + "end_header".length + 1; // +1 for newline
  const headerLines = headerText.substring(0, endHeaderIndex).split("\n");

  let format: PlyHeader["format"] = "binary_little_endian";
  let vertexCount = 0;
  const properties: PlyProperty[] = [];
  let currentOffset = 0;
  let inVertexElement = false;

  for (const line of headerLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("comment")) continue;

    const parts = trimmed.split(/\s+/);

    if (parts[0] === "format") {
      if (parts[1] === "binary_little_endian") {
        format = "binary_little_endian";
      } else if (parts[1] === "binary_big_endian") {
        format = "binary_big_endian";
      } else if (parts[1] === "ascii") {
        format = "ascii";
      }
    } else if (parts[0] === "element") {
      if (parts[1] === "vertex") {
        vertexCount = parseInt(parts[2], 10);
        inVertexElement = true;
      } else {
        inVertexElement = false;
      }
    } else if (parts[0] === "property" && inVertexElement) {
      const typeName = parts[1] as PlyProperty["type"];
      const propName = parts[2];
      const size = PLY_TYPE_SIZES[typeName] ?? 4;

      properties.push({
        name: propName,
        type: typeName,
        offset: currentOffset,
        size,
      });

      currentOffset += size;
    }
  }

  return {
    format,
    vertexCount,
    properties,
    headerLength,
    bytesPerVertex: currentOffset,
  };
}

/**
 * Sigmoid activation function.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
