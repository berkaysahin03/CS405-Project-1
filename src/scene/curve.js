import * as line from "../render/line.js"

import * as curves from "../math/curves.js"
import { Painting } from "../render/painting.js"
import * as renderer from "../render/renderer.js"
import * as mat4 from "../math/mat4.js"

export class Curve {
    /**
     * @param {line.GPUHandle} gpu
     * @param {Painting} painting
     * @param {[number, number, number]} curveColor
     */
    constructor(gpu, painting, curveColor) {
        this.controlPoints = /** @type {[number, number][]} */ ([])
        this.line = new line.Line(gpu, "line-strip", "less")
        this.controlPolygon = new line.Line(gpu, "line-list", "less")
        this.controlPointIndicator = new line.Line(gpu, "line-list", "less")
        this.dirty = false
        this.painting = painting
        this.builtAspect = null
        this.curveColor = curveColor
    }

    /** @returns {string} */
    get kind() { throw Error("Curve.kind is abstract") }

    /**
     * @param {[number, number][]} points
     */
    setControlPoints(points) {
        this.controlPoints = [...points]
        this.dirty = true
    }

    /**
     * @param {[number, number]} param0
     * @returns {[number, number]}
     */
    toWorld([u, v]) {
        const a = this.painting.aspect
        return [
            a * (2 * u - 1),
            1 - 2 * v
        ]
    }

    /**
     * @param {[number, number]} param0
     * @returns {[number, number]}
     */
    fromWorld([x, y]) {
        const a = this.painting.aspect
        return [
            (x / a + 1) / 2,
            (1 - y) / 2
        ]
    }

    /**
     * @param {[number, number]} px
     * @param {mat4.Mat4} viewProj
     * @param {number} width
     * @param {number} height
     * @returns {number}
     */
    hitTest(px, viewProj, width, height) {
        const POINT_SIZE = 10
        
        const dot = (a, b) => a.map((ai, i) => ai * b[i]).reduce((acc, v) => acc + v)
        const distance2 = (a, b) => { const diff = curves.sub(a, b); return dot(diff, diff)}

        let minDist = Number.MAX_VALUE
        let minIndex = -1
        for (let [i, p] of this.controlPoints.entries()) {
            let clip = mat4.transformVec4(viewProj, [...this.toWorld(p), 0, 1])
            if (clip[3] <= 0)
                continue

            let ndc = [clip[0] / clip[3], clip[1] / clip[3]]
            let pxc = [(ndc[0] + 1) / 2 * width, (1 - ndc[1]) / 2 * height]
            let dist2 = distance2(px, pxc) 
            if (dist2 < POINT_SIZE * POINT_SIZE && dist2 < minDist) {
                minDist = dist2
                minIndex = i
            }
        }

        return minIndex
    }

    /**
     * @param {[number, number][]} points 
     * @param {number} z 
     * @param {[number, number, number]} color
     * @returns {Float32Array}
     */
    static pack(points, z, color) {
        return new Float32Array(points.map(p => [...p, z, ...color]).flat())
    }

    cross(worldPoint, z, size, color) {
        const HALF_SEGMENT_LENGTH = size / 2
        const d = HALF_SEGMENT_LENGTH / Math.sqrt(2)
        return [...Curve.pack(
            [
                curves.add(worldPoint, [ d,  d]),
                curves.add(worldPoint, [-d, -d]),
                curves.add(worldPoint, [-d,  d]),
                curves.add(worldPoint, [ d, -d])
            ],
            z,
            color
        )]
    }

    update() {
        if (!this.dirty && this.builtAspect == this.painting.aspect)
            return

        const N = 32 * this.segmentCount()
        if (N == 0)
            return

        let points = []
        for (let i = 0; i <= N; i++) {
            points.push(this.evaluate(i / N))
        }

        let vertices = Curve.pack(points, 0.003, this.curveColor)
        this.line.setVertices(vertices)

        let control = []
        for (let i = 0; i < this.controlPoints.length - 1; i++) {
            control.push(this.toWorld(this.controlPoints[i]))
            control.push(this.toWorld(this.controlPoints[i + 1]))
        }

        let controlVertices = Curve.pack(control, 0.003, [0.5, 0.5, 0.5])
        this.controlPolygon.setVertices(controlVertices)

        const SEGMENT_LENGTH = 0.05

        let controlPointIndicatorVertices = new Float32Array(
            this.controlPoints.map((p, i) => this.cross(this.toWorld(p), 0.005, SEGMENT_LENGTH, this.markerColor(i))).flat()
        )

        this.controlPointIndicator.setVertices(controlPointIndicatorVertices)

        this.builtAspect = this.painting.aspect
        this.dirty = false
    }

    /**
     * @param {GPURenderPassEncoder} pass
     * @param {mat4.Mat4} viewProj
     * @param {renderer.Renderer} renderer  
     */
    draw(pass, viewProj, renderer) {
        this.line.draw(pass, viewProj, mat4.identity(), renderer)
        this.controlPolygon.draw(pass, viewProj, mat4.identity(), renderer)
        this.controlPointIndicator.draw(pass, viewProj, mat4.identity(), renderer)
    }

    /**
     * @returns {number}
     */
    segmentCount() { throw new Error("Curve.segmentCount is abstract") }

    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    evaluate(u) { throw new Error("Curve.evaluate is abstract") }


    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    tangent(u) { throw new Error("Curve.tangent is abstract") }

    /**
     * @param {number} i
     * @returns {[number, number, number]}
     */
    markerColor(i) { throw new Error("Curve.markerColor is abstract") }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    movePoint(i, uv) { throw new Error("Curve.movePoint is abstract") }
}

export class BezierCurve extends Curve {
    /**
     * @param {line.GPUHandle} gpu
     * @param {Painting} painting
     * @param {[number, number, number]} curveColor
     */
    constructor(gpu, painting, curveColor) {
        super(gpu, painting, curveColor)
        this.deCasteljauLine = new line.Line(gpu, "line-list", "less")
    }

    get kind() { return "bezier-c1" }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    moveJoint(i, uv) {
        let delta = curves.sub(uv, this.controlPoints[i])
        this.controlPoints[i] = uv

        if (i + 1 < this.controlPoints.length)
            this.controlPoints[i + 1] = curves.add(this.controlPoints[i + 1], delta)

        if (i - 1 >= 0)
            this.controlPoints[i - 1] = curves.add(this.controlPoints[i - 1], delta)
    }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    moveBeforeJoint(i, uv) {
        this.controlPoints[i] = uv
        if (i + 2 < this.controlPoints.length)
            this.controlPoints[i + 2] = curves.c1NextControl(this.controlPoints[i], this.controlPoints[i + 1])
    }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    moveAfterJoint(i, uv) {
        this.controlPoints[i] = uv
        if (i - 2 >= 0)
            this.controlPoints[i - 2] = curves.c1NextControl(this.controlPoints[i], this.controlPoints[i - 1])
    }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    movePoint(i, uv) {
        switch (i % 3) {
        case 0: this.moveJoint(i, uv); break
        case 1: this.moveAfterJoint(i, uv); break
        case 2: this.moveBeforeJoint(i, uv); break
        }

        this.dirty = true
    }

    /**
     * @returns {[number, number][][]} 
     */
    segmentsUV() {
        if (this.controlPoints.length < 4 || (this.controlPoints.length - 1) % 3)
            return []

        const n = (this.controlPoints.length - 1) / 3
        let segments = []
        for (let i = 0; i < n; i++) {
            segments.push(this.controlPoints.slice(3 * i, 3 * i + 4))
        }
        return segments
    }

    /**
     * @returns {[number, number][][]} 
     */
    segments() {
        return this.segmentsUV().map(l => l.map(p => this.toWorld(p)))
    }

    /**
     * @param {number} i
     * @returns {[number, number, number]}
     */
    markerColor(i) {
        const JOINT_COLOR = /** @type {[number, number, number]} */ ([1, 1, 0])
        const HANDLE_COLOR = /** @type {[number, number, number]} */ ([0, 1, 0])
        return i % 3 == 0 ? JOINT_COLOR : HANDLE_COLOR
    }

    /**
     * @returns {number}
     */
    segmentCount() {
        return this.segments().length
    }

    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    evaluate(u) {
        const segments = this.segments()
        return curves.evalPiecewise(segments, u)
    }

    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    tangent(u) {
        const segments = this.segments()
        let [i, t] = curves.mapToSegmentIndex(segments.length, u)
        let p = segments[i]
        return curves.cubicBezierTangent(p[0], p[1], p[2], p[3], t)
    }

    updateDeCasteljau(u) {
        const LEVEL_COLORS = /** @type {[number, number, number][]} */ ([
          [0.0, 0.8, 1.0],   // level 0: the current segment's control polygon (cyan)
          [1.0, 0.0, 1.0],   // level 1: magenta
          [1.0, 0.25, 0.0],  // level 2: orange
          [1.0, 1.0, 1.0],   // level 3: the point on the curve (white)
        ])

        const segments = this.segments()
        let [i, t] = curves.mapToSegmentIndex(segments.length, u)
        let list = curves.deCasteljau(segments[i], t)
        let vertices =  []
        for (let [j, l] of list.entries()) {
            for (let k = 0; k < l.length - 1; k++) {
                let line = Curve.pack(
                    [l[k], l[k + 1]],
                    0.006,
                    LEVEL_COLORS[j % LEVEL_COLORS.length]
                )
                vertices = [...vertices, ...line]
            }
        }
        let point = list[list.length - 1][0]
        let pointVertices = this.cross(point, 0.006, 0.05, LEVEL_COLORS[(list.length - 1) % LEVEL_COLORS.length])
        this.deCasteljauLine.setVertices(new Float32Array([...vertices, ...pointVertices]))
    }


    /**
     * @param {GPURenderPassEncoder} pass
     * @param {mat4.Mat4} viewProj
     * @param {renderer.Renderer} renderer  
     */
    drawDeCasteljau(pass, viewProj, renderer) {
        this.deCasteljauLine.draw(pass, viewProj, mat4.identity(), renderer)
    }
}

export class CatmullRomCurve extends Curve {
    get kind() { return "catmull-rom" }

    /**
     * @returns {number}
     */
    segmentCount() {
        return this.controlPoints.length < 2 ? 0 : this.controlPoints.length - 1
    }

    segmentPoints(i) {

        let p0 = [0, 0]
        let p1 = this.controlPoints[i]
        let p2 = this.controlPoints[i + 1]
        let p3 = [0, 0]

        if (i - 1 < 0)
            p0 = this.controlPoints[i]
        else
            p0 = this.controlPoints[i - 1]

        if (i + 2 >= this.controlPoints.length)
            p3 = this.controlPoints[i + 1]
        else
            p3 = this.controlPoints[i + 2]

        return [p0, p1, p2, p3]
    }

    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    evaluate(u) {
        let n = this.segmentCount()
        let [i, t] = curves.mapToSegmentIndex(n, u)
        let p = this.segmentPoints(i)

        return this.toWorld(curves.catmullRom(p[0], p[1], p[2], p[3], t))
    }

    /**
     * @param {number} i
     * @returns {[number, number, number]}
     */
    markerColor(i) { return [1, 1, 0] }

    /**
     * @param {number} i 
     * @param {[number, number]} uv 
     */
    movePoint(i, uv) {
        this.controlPoints[i] = uv
        this.dirty = true
    }

    /**
     * @param {number} u
     * @returns {[number, number]}
     */
    tangent(u) {
        let n = this.segmentCount()
        let [i, t] = curves.mapToSegmentIndex(n, u)
        let c = this.segmentPoints(i)

        let p = curves.catmullRomToCubicBezier(c[0], c[1], c[2], c[3])

        let tan = curves.cubicBezierTangent(p[0], p[1], p[2], p[3], t)
        tan[0] = 2 * this.painting.aspect * tan[0]
        tan[1] = -2 * tan[1]
        return tan
    }
}