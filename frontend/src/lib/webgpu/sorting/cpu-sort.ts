/**
 * CPU-based depth sorting for Gaussian splats.
 * Sorts splats from back to front based on view-space Z.
 */

/**
 * Sort splat indices by depth (back to front).
 * Modifies indices array in place.
 *
 * @param positions Splat positions (x, y, z per splat)
 * @param viewMatrix View matrix (Float32Array of 16 elements, column-major)
 * @param indices Output array of sorted indices
 */
export function sortSplatsByDepth(
  positions: Float32Array,
  viewMatrix: Float32Array,
  indices: Uint32Array
): void {
  const count = indices.length;

  // Extract view matrix row 2 for Z calculation (depth)
  // For column-major: row 2 is at indices [2, 6, 10, 14]
  const m2 = viewMatrix[2];
  const m6 = viewMatrix[6];
  const m10 = viewMatrix[10];
  const m14 = viewMatrix[14];

  // Compute depths and initialize indices
  const depths = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    // View-space Z = dot(viewMatrix.row2, [px, py, pz, 1])
    depths[i] = m2 * px + m6 * py + m10 * pz + m14;
    indices[i] = i;
  }

  // Sort indices by depth (most negative = furthest from camera = render first)
  // We want back-to-front order for proper alpha blending
  if (count > 10000) {
    radixSort(depths, indices, count);
  } else {
    quickSort(depths, indices, 0, count - 1);
  }
}

/**
 * Radix sort for large datasets.
 * Sorts by treating floats as sortable integers.
 */
function radixSort(depths: Float32Array, indices: Uint32Array, count: number): void {
  // Convert floats to sortable integers
  const keys = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const f = depths[i];
    let bits = floatToIntBits(f);
    // Make floats sortable as integers (flip all bits if negative, else flip sign bit)
    bits = bits < 0 ? bits ^ 0x7fffffff : bits ^ 0x80000000;
    // Ascending order gives back-to-front (most negative Z = furthest = rendered first)
    keys[i] = bits;
  }

  // LSD radix sort with 8-bit digits (4 passes)
  const tempKeys = new Int32Array(count);
  const tempIndices = new Uint32Array(count);

  for (let shift = 0; shift < 32; shift += 8) {
    const counts = new Uint32Array(256);

    // Count occurrences
    for (let i = 0; i < count; i++) {
      const digit = (keys[i] >>> shift) & 0xff;
      counts[digit]++;
    }

    // Prefix sum
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      const c = counts[i];
      counts[i] = sum;
      sum += c;
    }

    // Scatter
    for (let i = 0; i < count; i++) {
      const digit = (keys[i] >>> shift) & 0xff;
      const pos = counts[digit]++;
      tempKeys[pos] = keys[i];
      tempIndices[pos] = indices[i];
    }

    // Swap buffers
    keys.set(tempKeys);
    indices.set(tempIndices);
  }
}

/**
 * Quick sort for smaller datasets.
 */
function quickSort(
  depths: Float32Array,
  indices: Uint32Array,
  left: number,
  right: number
): void {
  if (left >= right) return;

  // Use insertion sort for small ranges
  if (right - left < 16) {
    insertionSort(depths, indices, left, right);
    return;
  }

  // Median-of-three pivot selection
  const mid = (left + right) >>> 1;
  if (depths[left] > depths[mid]) swap(depths, indices, left, mid);
  if (depths[left] > depths[right]) swap(depths, indices, left, right);
  if (depths[mid] > depths[right]) swap(depths, indices, mid, right);

  // Partition
  swap(depths, indices, mid, right - 1);
  const pivot = depths[right - 1];

  let i = left;
  let j = right - 1;

  while (true) {
    while (depths[++i] < pivot);
    while (depths[--j] > pivot);
    if (i >= j) break;
    swap(depths, indices, i, j);
  }

  swap(depths, indices, i, right - 1);

  quickSort(depths, indices, left, i - 1);
  quickSort(depths, indices, i + 1, right);
}

/**
 * Insertion sort for small ranges.
 */
function insertionSort(
  depths: Float32Array,
  indices: Uint32Array,
  left: number,
  right: number
): void {
  for (let i = left + 1; i <= right; i++) {
    const depth = depths[i];
    const index = indices[i];
    let j = i - 1;

    while (j >= left && depths[j] > depth) {
      depths[j + 1] = depths[j];
      indices[j + 1] = indices[j];
      j--;
    }

    depths[j + 1] = depth;
    indices[j + 1] = index;
  }
}

/**
 * Swap elements in both arrays.
 */
function swap(
  depths: Float32Array,
  indices: Uint32Array,
  i: number,
  j: number
): void {
  const tempDepth = depths[i];
  depths[i] = depths[j];
  depths[j] = tempDepth;

  const tempIndex = indices[i];
  indices[i] = indices[j];
  indices[j] = tempIndex;
}

/**
 * Convert float32 to int32 bits (reinterpret cast).
 */
function floatToIntBits(f: number): number {
  const buffer = new ArrayBuffer(4);
  const floatView = new Float32Array(buffer);
  const intView = new Int32Array(buffer);
  floatView[0] = f;
  return intView[0];
}
