/**
 * vec3 — 3-component vectors as plain arrays [x, y, z].
 *
 * Every function returns a NEW array and never modifies its arguments.
 * Write these yourself (Week 1, Linear Algebra I). Tests: tests/vec3.test.js
 */
import { todo } from './todo.js';

/** @typedef {[number, number, number]} Vec3 */

/** a + b
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/** a − b
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** s · a  (s is a number)
 * @param {Vec3} a
 * @param {number} s
 * @returns {Vec3}
 */
export function scale(a, s) {
    return [s * a[0], s * a[1], s * a[2]]
}

/** -v 
 * @param {Vec3} v
 * @returns {Vec3}
 */
export let negate = v => scale(v, -1)

/** a · b  → number
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {number}
 */
export function dot(a, b) {
    return a.map((v, i) => v * b[i]).reduce((acc, v) => acc + v)
}

/** a × b  (right-handed: cross([1,0,0],[0,1,0]) = [0,0,1])
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ]
}

/** |a|  → number
 * @param {Vec3} a
 * @returns {number}
 */
export function length(a) { return Math.sqrt(dot(a, a)); }

/**
 * a / |a|.
 * For a zero-length vector return [0, 0, 0] — never NaN.
 * @param {Vec3} a
 * @returns {Vec3}
 */
export function normalize(a) {
    let len = length(a)
    if (len == 0) return [0, 0, 0]
    return scale(a, 1 / len);
}
