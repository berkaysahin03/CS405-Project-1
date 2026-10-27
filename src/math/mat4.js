/**
 * mat4 — 4×4 matrices for Parts A and C.
 *
 * CONVENTIONS (the tests check exactly these):
 *   • A matrix is a Float32Array(16) in COLUMN-MAJOR order — the layout WebGPU
 *     expects for a mat4x4f in a uniform buffer. Element (row r, column c)
 *     lives at index  c * 4 + r.  The translation of an affine matrix is
 *     therefore at indices 12, 13, 14.
 *   • Column vectors: a point p is transformed as  M · p.
 *     multiply(A, B) returns A·B, so B is applied FIRST.
 *   • Right-handed world space. Angles in RADIANS. A positive angle rotates
 *     counter-clockwise when you look down the axis towards the origin
 *     (rotateZ(π/2) takes +x to +y).
 *   • View space: the camera sits at the origin and looks down −z, +y is up.
 *   • Clip space is WebGPU's: after the divide by w, x and y are in [−1, 1]
 *     and z is in [0, 1] (near → 0, far → 1). NOT OpenGL's [−1, 1].
 *
 * No maths libraries (no gl-matrix, no Three.js). Tests: tests/mat4.test.js
 */
import { todo } from './todo.js';
import * as vec3 from './vec3.js'

/* ------------------------------------------------------------- Part A ---- */

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {[number, number, number, number]} Vec4
 * @typedef {Float32Array} Mat4
 * @typedef {number} Radians
 */

/**
 * The 4×4 identity.
 * @returns {Mat4}
 */
export function identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

/** A · B (apply B first, then A). Must not modify a or b.
 * @param {Mat4} a
 * @param {Mat4} b
 * @returns {Mat4}
*/
export function multiply(a, b) {
  let res = new Float32Array(16)

  let ar = [
    a.filter((_, i) => i % 4 == 0),
    a.filter((_, i) => i % 4 == 1),
    a.filter((_, i) => i % 4 == 2),
    a.filter((_, i) => i % 4 == 3)
  ]

  let bc = [
    b.slice(0, 4),
    b.slice(4, 8),
    b.slice(8, 12),
    b.slice(12, 16)
  ]

  /** @type {function(Float32Array, Float32Array): number} */
  let dot = (a, b) => a.map((v, i) => v * b[i]).reduce((acc, v) => acc + v)

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      res[j * 4 + i] = dot(ar[i], bc[j])
    } 
  }

  return res;
}

/** Translation by (tx, ty, tz).
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @returns {Mat4} 
*/
export function translate(tx, ty, tz) {
  return new Float32Array([
    1,  0,  0,  0,
    0,  1,  0,  0,
    0,  0,  1,  0,
    tx, ty, tz, 1,
  ])
}

let sin = Math.sin
let cos = Math.cos

/** Rotation by `rad` about the x axis.
 * @param {Radians} rad
 * @returns {Mat4} 
*/
export function rotateX(rad) {
  return new Float32Array([
    1,         0,        0, 0,
    0,  cos(rad), sin(rad), 0,
    0, -sin(rad), cos(rad), 0,
    0,         0,        0, 1,
  ])
}

/** Rotation by `rad` about the y axis.
 * @param {Radians} rad
 * @returns {Mat4} 
*/
export function rotateY(rad) {
  return new Float32Array([
    cos(rad), 0, -sin(rad), 0,
    0,        1,         0, 0,
    sin(rad), 0,  cos(rad), 0,
    0,        0,         0, 1,
  ])
}

/** Rotation by `rad` about the z axis.
 * @param {Radians} rad
 * @returns {Mat4} 
*/
export function rotateZ(rad) {
  return new Float32Array([
     cos(rad), sin(rad), 0, 0,
    -sin(rad), cos(rad), 0, 0,
            0,        0, 1, 0,
            0,        0, 0, 1,
  ])
}

/** Non-uniform scale by (sx, sy, sz).
 * @param {number} sx
 * @param {number} sy
 * @param {number} sz
 * @returns {Mat4} 
*/
export function scale(sx, sy, sz) {
  return new Float32Array([
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1,
  ])
}

/** Mᵀ
 * @param {Mat4} m
 * @returns {Mat4} 
*/
export function transpose(m) {
  let res = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      res[i * 4 + j] = m[j * 4 + i]
    }
  } 
  return res;
}

/**
 * Inverse of a RIGID transform M = T·R (rotation + translation only, no scale).
 * Do not write a general 4×4 inverse: use the structure (Week 3).
 * @param {Mat4} m
 * @returns {Mat4} 
 */
export function invertRigid(m) {
  let R = Float32Array.from(m)
  R[12] = R[13] = R[14] = 0
  let Rtran = transpose(R)

  /** @type {Vec4} */
  let t = [m[12], m[13], m[14], 1]
  let Rtrant = transformVec4(Rtran, t)

  Rtran[12] = -Rtrant[0]
  Rtran[13] = -Rtrant[1]
  Rtran[14] = -Rtrant[2]
  return Rtran;
}

/** M · v for a 4-component v = [x, y, z, w]; returns [x', y', z', w'].
 * @param {Mat4} m
 * @param {Vec4} v
 * @returns {Vec4}
*/
export function transformVec4(m, v) {
  let mr = [
    m.filter((_, i) => i % 4 == 0),
    m.filter((_, i) => i % 4 == 1),
    m.filter((_, i) => i % 4 == 2),
    m.filter((_, i) => i % 4 == 3)
  ]

  /** @type {function(Float32Array, Vec4): number} */
  let dot = (a, b) => a.map((v, i) => v * b[i]).reduce((acc, v) => acc + v)
  return /** @type {Vec4} */ (mr.map(mri => dot(mri, v))) 
}

/* ------------------------------------------------------------- Part C ---- */

/**
 * View matrix for a camera at `eye` looking at `target`, with `up` as the
 * approximate up direction. Build the camera basis with two cross products.
 * Must stay finite when `up` is parallel to the view direction — handle it.
 * eye, target, up: [x, y, z]
 * @param {Vec3} eye
 * @param {Vec3} target
 * @param {Vec3} up
 * @returns {Mat4}
 */
export function lookAt(eye, target, up) {
  let forward = vec3.normalize(vec3.sub(eye, target))
  let right = vec3.normalize(vec3.cross(up, forward))
  if (vec3.length(right) == 0)
    right = [1, 0, 0]
  let trueUp = vec3.cross(forward, right)

  let m = new Float32Array([
    right, 0,
    trueUp, 0,
    forward, 0,
    eye, 1
  ].flat())

  return invertRigid(m)
}

/**
 * Perspective projection for WebGPU (depth z ∈ [0, 1]).
 * fovY: vertical field of view in radians; aspect = width / height;
 * near, far: positive distances along −z.
 * @param {Radians} fovY
 * @param {number} aspect
 * @param {number} near
 * @param {number} far
 * @returns {Mat4}
 */
export function perspective(fovY, aspect, near, far) {
  let f = 1 / Math.tan(fovY / 2)
  let x = far/(near - far)

  return new Float32Array([
    f/aspect, 0,        0,  0,
           0, f,        0,  0,
           0, 0,        x, -1,
           0, 0, near * x,  0,
  ]);
}

/**
 * Orthographic projection for WebGPU (depth z ∈ [0, 1]) of the box
 * x ∈ [left, right], y ∈ [bottom, top], z ∈ [−near, −far] in view space.
 * @param {number} left
 * @param {number} right
 * @param {number} bottom
 * @param {number} top
 * @param {number} near
 * @param {number} far
 * @returns {Mat4}
 */
export function orthographic(left, right, bottom, top, near, far) {
  let invrml = 1 / (right - left)
  let invtmb = 1 / (top - bottom)
  let invnmf = 1 / (near - far)
  return new Float32Array([
                  2 * invrml,                        0,             0, 0,
                           0,               2 * invtmb,             0, 0,
                           0,                        0,        invnmf, 0,
    -(right + left) * invrml, -(top + bottom) * invtmb, near * invnmf, 1
  ]);
}

/* ------------------------------------------------- provided (not graded) - */

/**
 * Pretty-print a column-major matrix as four rows, for showing matrices on
 * screen (Part A asks you to display T·R·S and S·R·T).
 */
export function format(m, digits = 2) {
  if (!m) return '(none)';
  const w = digits + 4;
  let s = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) s += (+m[c * 4 + r]).toFixed(digits).padStart(w);
    if (r < 3) s += '\n';
  }
  return s;
}
