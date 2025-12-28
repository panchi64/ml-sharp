/**
 * PLY file exporter for 3D Gaussian Splatting format.
 */

import type { SplatData } from "./types";

/**
 * Export SplatData to a binary PLY file blob.
 * Reverses the transformations applied during parsing.
 */
export function exportToPly(data: SplatData): Blob {
  const { count, positions, colors, opacities, scales, rotations } = data;

  // Build header
  const header = `ply
format binary_little_endian 1.0
element vertex ${count}
property float x
property float y
property float z
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float opacity
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
end_header
`;

  const headerBytes = new TextEncoder().encode(header);

  // 14 floats per vertex: x,y,z, f_dc_0/1/2, opacity, scale_0/1/2, rot_0/1/2/3
  const bytesPerVertex = 14 * 4;
  const dataBytes = new ArrayBuffer(bytesPerVertex * count);
  const dataView = new DataView(dataBytes);

  const SH_C0 = 0.28209479177387814;

  for (let i = 0; i < count; i++) {
    const offset = i * bytesPerVertex;

    // Position (negate Y back to original image coordinates)
    dataView.setFloat32(offset + 0, positions[i * 3], true);
    dataView.setFloat32(offset + 4, -positions[i * 3 + 1], true);
    dataView.setFloat32(offset + 8, positions[i * 3 + 2], true);

    // Color: convert RGB (0-1) back to DC spherical harmonic
    // Original: color = 0.5 + SH_C0 * sh
    // Inverse: sh = (color - 0.5) / SH_C0
    dataView.setFloat32(offset + 12, (colors[i * 3] - 0.5) / SH_C0, true);
    dataView.setFloat32(offset + 16, (colors[i * 3 + 1] - 0.5) / SH_C0, true);
    dataView.setFloat32(offset + 20, (colors[i * 3 + 2] - 0.5) / SH_C0, true);

    // Opacity: convert to logit (inverse sigmoid)
    // Original: opacity = sigmoid(logit)
    // Inverse: logit = log(o / (1 - o))
    const o = Math.max(0.0001, Math.min(0.9999, opacities[i]));
    dataView.setFloat32(offset + 24, Math.log(o / (1 - o)), true);

    // Scale: convert to log scale
    // Original: scale = exp(logScale)
    // Inverse: logScale = log(scale)
    const s0 = Math.max(0.0001, scales[i * 3]);
    const s1 = Math.max(0.0001, scales[i * 3 + 1]);
    const s2 = Math.max(0.0001, scales[i * 3 + 2]);
    dataView.setFloat32(offset + 28, Math.log(s0), true);
    dataView.setFloat32(offset + 32, Math.log(s1), true);
    dataView.setFloat32(offset + 36, Math.log(s2), true);

    // Rotation quaternion (already normalized, write as-is)
    dataView.setFloat32(offset + 40, rotations[i * 4], true);
    dataView.setFloat32(offset + 44, rotations[i * 4 + 1], true);
    dataView.setFloat32(offset + 48, rotations[i * 4 + 2], true);
    dataView.setFloat32(offset + 52, rotations[i * 4 + 3], true);
  }

  return new Blob([headerBytes, dataBytes], { type: "application/octet-stream" });
}
