import * as line from "../render/line.js"

import * as curves from "../math/curves.js"
import { Painting } from "../render/painting.js"
import * as renderer from "../render/renderer.js"
import * as mat4 from "../math/mat4.js"

export class Curve {
    /**
     * @param {line.GPUHandle} gpu
     * @param {Painting} painting  
     */
    constructor(gpu, painting) {
        this.controlPoints = /** @type {[number, number][]} */ ([])
        this.line = new line.Line(gpu, "line-strip", "less")
        this.controlPolygon = new line.Line(gpu, "line-list", "less")
        this.dirty = false
        this.painting = painting
        this.builtAspect = null
    }

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
     * @returns {[number, number][][]} 
     */
    segments() {
        if (this.controlPoints.length < 4 || (this.controlPoints.length - 1) % 3)
            return []

        const points = this.controlPoints.map(p => this.toWorld(p))
        const n = (points.length - 1) / 3

        let segments = []
        for (let i = 0; i < n; i++) {
            segments.push(points.slice(3 * i, 3 * i + 4))
        }

        return segments
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

    update() {
        if (!this.dirty && this.builtAspect == this.painting.aspect)
            return

        const segments = this.segments()
        const n = segments.length
        if (n == 0)
            return
        const N = 32 * n

        let points = []
        for (let i = 0; i <= N; i++) {
            points.push(curves.evalPiecewise(segments, i / N))
        }

        let vertices = Curve.pack(points, 0.003, [1, 0, 0])
        this.line.setVertices(vertices)

        let control = []
        for (let i = 0; i < this.controlPoints.length - 1; i++) {
            control.push(this.toWorld(this.controlPoints[i]))
            control.push(this.toWorld(this.controlPoints[i + 1]))
        }

        let controlVertices = Curve.pack(control, 0.003, [0.5, 0.5, 0.5])
        this.controlPolygon.setVertices(controlVertices)

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
    }
} 