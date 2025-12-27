/**
 * 3D Gaussian Splatting vertex and fragment shader.
 *
 * Renders each Gaussian splat as a billboarded quad with proper
 * covariance projection and Gaussian falloff.
 */

// Uniforms: camera matrices and viewport info
struct Uniforms {
    viewMatrix: mat4x4<f32>,
    projectionMatrix: mat4x4<f32>,
    viewportSize: vec2<f32>,
    focalLength: vec2<f32>,
};

// Packed splat data (64 bytes per splat, aligned)
struct Splat {
    position: vec3<f32>,
    opacity: f32,
    color: vec3<f32>,
    padding0: f32,
    scale: vec3<f32>,
    padding1: f32,
    rotation: vec4<f32>, // quaternion (w, x, y, z)
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> splats: array<Splat>;
@group(0) @binding(2) var<storage, read> sortedIndices: array<u32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) opacity: f32,
    @location(2) quadCoord: vec2<f32>,
};

// Compute 3D covariance matrix from scale and rotation quaternion
fn computeCov3D(scale: vec3<f32>, rotation: vec4<f32>) -> mat3x3<f32> {
    let w = rotation.x;
    let x = rotation.y;
    let y = rotation.z;
    let z = rotation.w;

    // Rotation matrix from quaternion (column-major)
    let R = mat3x3<f32>(
        vec3<f32>(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + w * z), 2.0 * (x * z - w * y)),
        vec3<f32>(2.0 * (x * y - w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + w * x)),
        vec3<f32>(2.0 * (x * z + w * y), 2.0 * (y * z - w * x), 1.0 - 2.0 * (x * x + y * y))
    );

    // Scale matrix (diagonal)
    let S = mat3x3<f32>(
        vec3<f32>(scale.x, 0.0, 0.0),
        vec3<f32>(0.0, scale.y, 0.0),
        vec3<f32>(0.0, 0.0, scale.z)
    );

    // Covariance = R * S * S^T * R^T = (R * S) * (R * S)^T
    let M = R * S;
    return M * transpose(M);
}

// Project 3D covariance to 2D screen space
fn computeCov2D(
    mean3D: vec3<f32>,
    cov3D: mat3x3<f32>,
    viewMatrix: mat4x4<f32>,
    focal: vec2<f32>
) -> vec3<f32> {
    // Transform point to view space
    let t = (viewMatrix * vec4<f32>(mean3D, 1.0)).xyz;

    // Use positive depth (camera looks down -Z, so visible points have negative z)
    let depth = -t.z;

    // Clamp to avoid numerical issues near camera
    let limx = 1.3 * focal.x / depth;
    let limy = 1.3 * focal.y / depth;
    let txtz = clamp(-t.x / t.z, -limx, limx);
    let tytz = clamp(-t.y / t.z, -limy, limy);

    // Jacobian of perspective projection
    let J = mat3x3<f32>(
        vec3<f32>(focal.x / depth, 0.0, 0.0),
        vec3<f32>(0.0, focal.y / depth, 0.0),
        vec3<f32>(focal.x * txtz / depth, focal.y * tytz / depth, 0.0)
    );

    // View matrix rotation part (3x3)
    let W = mat3x3<f32>(
        viewMatrix[0].xyz,
        viewMatrix[1].xyz,
        viewMatrix[2].xyz
    );

    // Transform covariance to 2D
    let T = J * W;
    let cov = T * cov3D * transpose(T);

    // Return 2D covariance as (a, b, c) where matrix is [[a, b], [b, c]]
    // Add small value to avoid zero eigenvalues
    return vec3<f32>(
        cov[0][0] + 0.1,
        cov[0][1],
        cov[1][1] + 0.1
    );
}

@vertex
fn vertexMain(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    var output: VertexOutput;

    // Get sorted splat index
    let splatIndex = sortedIndices[instanceIndex];
    let splat = splats[splatIndex];

    // Quad vertices (2 triangles = 6 vertices)
    var quadVerts = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0)
    );
    let quadCoord = quadVerts[vertexIndex];

    // Transform position to view space
    let viewPos = uniforms.viewMatrix * vec4<f32>(splat.position, 1.0);

    // Skip if behind or too close to camera
    if (viewPos.z > -0.1) {
        output.position = vec4<f32>(0.0, 0.0, 2.0, 1.0); // Clip
        output.color = vec3<f32>(0.0);
        output.opacity = 0.0;
        output.quadCoord = vec2<f32>(0.0);
        return output;
    }

    // Compute 3D and 2D covariance
    let cov3D = computeCov3D(splat.scale, splat.rotation);
    let cov2D = computeCov2D(splat.position, cov3D, uniforms.viewMatrix, uniforms.focalLength);

    // Eigendecomposition of 2D covariance for ellipse
    let a = cov2D.x;
    let b = cov2D.y;
    let c = cov2D.z;

    let det = a * c - b * b;
    let mid = 0.5 * (a + c);
    let disc = sqrt(max(0.1, mid * mid - det));
    let lambda1 = mid + disc;
    let lambda2 = max(mid - disc, 0.1);

    // Compute ellipse axes (3 sigma for ~99% coverage)
    let majorAxis = 3.0 * sqrt(lambda1);
    let minorAxis = 3.0 * sqrt(lambda2);

    // Clamp size to avoid huge splats
    let maxSize = 1024.0;
    let clampedMajor = min(majorAxis, maxSize);
    let clampedMinor = min(minorAxis, maxSize);

    // Ellipse rotation angle
    let angle = 0.5 * atan2(2.0 * b, a - c);
    let cosA = cos(angle);
    let sinA = sin(angle);

    // Scale and rotate quad vertex
    let scaled = vec2<f32>(
        quadCoord.x * clampedMajor,
        quadCoord.y * clampedMinor
    );
    let rotated = vec2<f32>(
        cosA * scaled.x - sinA * scaled.y,
        sinA * scaled.x + cosA * scaled.y
    );

    // Project center to clip space
    let clipPos = uniforms.projectionMatrix * viewPos;
    let ndcCenter = clipPos.xy / clipPos.w;

    // Add offset in screen space (convert pixels to NDC)
    let screenOffset = rotated / uniforms.viewportSize * 2.0;

    output.position = vec4<f32>(
        ndcCenter + screenOffset,
        clipPos.z / clipPos.w,
        1.0
    );
    output.color = splat.color;
    output.opacity = splat.opacity;
    output.quadCoord = quadCoord;

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Gaussian falloff based on distance from center
    let d = input.quadCoord;
    let power = -0.5 * (d.x * d.x + d.y * d.y);

    // Discard if too far from center (optimization)
    if (power < -4.5) {
        discard;
    }

    let gaussian = exp(power);
    let alpha = input.opacity * gaussian;

    // Discard nearly transparent fragments
    if (alpha < 0.004) {
        discard;
    }

    // Premultiplied alpha output
    return vec4<f32>(input.color * alpha, alpha);
}
