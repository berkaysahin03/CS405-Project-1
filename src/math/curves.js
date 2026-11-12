/**
 * curves — Part D.
 *
 * Points are plain arrays of any dimension: [x, y] in the plane of the
 * painting, or [x, y, z] in world space. Every function must work for both
 * (the tests use 2D and 3D). Return new arrays; never modify the inputs.
 *
 * A piecewise cubic Bézier curve is an array of segments, each segment being
 * four control points [P0, P1, P2, P3]. Consecutive segments share a joint:
 * segments[i][3] equals segments[i + 1][0].
 *
 * Tests: tests/curves.test.js
 */
import { todo } from './todo.js';

/* ---------------------------------------------------------- Bézier ------ */

/** The four cubic Bernstein basis values [B0(t), B1(t), B2(t), B3(t)]. */
export function bernstein3(t) {
  return [
    Math.pow(1 - t, 3),
    3 * Math.pow(1 - t, 2) * t,
    3 * (1 - t) * Math.pow(t, 2),
    Math.pow(t, 3),
  ];
}

export let add = (a, b) => a.map((ai, i) => ai + b[i])
export let sub = (a, b) => a.map((ai, i) => ai - b[i])
export let scale = (a, s) => a.map(ai => ai * s)
export let lerp = (a, b, t) => add(scale(a, 1 - t), scale(b, t))

/** Point on the cubic Bézier curve with control points p0..p3 at t ∈ [0, 1]. */
export function cubicBezier(p0, p1, p2, p3, t) {
  const B = bernstein3(t)
  return ([p0, p1, p2, p3]).map((pi, i) => scale(pi, B[i])).reduce(add)
}

/** First derivative dB/dt of the cubic Bézier at t (not normalised). */
export function cubicBezierTangent(p0, p1, p2, p3, t) {
  return add(
          scale(sub(p1, p0), 3 * (1 - t) * (1 - t)),
          add(
            scale(sub(p2, p1), 6 * t * (1 - t)),
            scale(sub(p3, p2), 3 * t * t)
          ),
        )
}

/**
 * de Casteljau's construction for any number of control points.
 * Returns every level, for drawing the construction:
 *   levels[0] = the input points (n points)
 *   levels[1] = n − 1 interpolated points
 *   …
 *   levels[n − 1] = [the point on the curve]
 */
export function deCasteljau(points, t) {
  let levels = []
  levels[0] = points

  for (let i = 0; levels[i].length > 1; i++) {
    levels[i + 1] = []
    for (let j = 0; j < levels[i].length - 1; j++) {
      levels[i + 1][j] = lerp(levels[i][j], levels[i][j + 1], t)
    }
  }
  return levels;
}

/* ----------------------------------------------- piecewise, C¹ joints --- */

/**
 * Given the last two control points P2, P3 of one segment, return the P1 of
 * the NEXT segment that makes the joint at P3 C¹-continuous.
 */
export function c1NextControl(p2, p3) {
  return sub(scale(p3, 2), p2)
}

export let clamp = (v, a, b) => Math.min(Math.max(v, a), b)

/**
 * Evaluate a piecewise cubic Bézier at a global parameter u ∈ [0, 1] that
 * runs over the whole curve: with n segments, segment i covers
 * u ∈ [i/n, (i+1)/n]. u = 0 is the first P0, u = 1 the last P3.
 */
export function evalPiecewise(segments, u) {
  let n = segments.length
  let s = clamp(u, 0, 1) * n
  let i = Math.min(Math.floor(s), n - 1)
  let t = s - i
  let [p0, p1, p2, p3] = segments[i]
  return cubicBezier(p0, p1, p2, p3, t);
}

/* ---------------------------- second curve family: implement ONE -------- */
/* The tests skip whichever of the two you leave as a TODO, and fail only   */
/* if you implement neither.                                                */

/**
 * Uniform Catmull–Rom: the segment between p1 and p2 (passes through both),
 * t ∈ [0, 1], with tangents (p2 − p0)/2 at p1 and (p3 − p1)/2 at p2.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  let m1 = scale(sub(p2, p0), 1/2)
  let m2 = scale(sub(p3, p1), 1/2)

  return cubicBezier(
    p1,
    add(p1, scale(m1, 1/3)),
    sub(p2, scale(m2, 1/3)),
    p2,
    t
  );
}

/** Uniform cubic B-spline basis values [N0(t), N1(t), N2(t), N3(t)]. */
export function bsplineBasis(t) { return todo('curves.bsplineBasis'); }

/** Point on the uniform cubic B-spline segment controlled by p0..p3. */
export function bspline(p0, p1, p2, p3, t) { return todo('curves.bspline'); }
