import * as shader from "./shader.js"
import * as renderer from "./renderer.js"
import * as mat4 from "../math/mat4.js"

import lineWGSL from './shaders/line.wgsl?raw'

/**
 * @typedef {{
 *   device: GPUDevice, context: GPUCanvasContext, canvas: HTMLCanvasElement,
 *   canvasFormat: GPUTextureFormat,   // format of the swap-chain texture
 *   viewFormat: GPUTextureFormat,     // format your pipelines must render to
 *   encodeSRGB: boolean,              // true → shaders must encode linear → sRGB themselves
 *   onResize: (fn: (w: number, h: number) => void) => void,
 * }} GPUHandle
 */

export class Line {
    /**
     * @param {GPUHandle} gpu
     * @param {GPUPrimitiveTopology} topology 
     * @param {GPUCompareFunction} depthCompare 
     */
    constructor(gpu, topology = "line-strip", depthCompare = "always") {
        const { device } = gpu

        let uniformBuffer = device.createBuffer({
            size: 4 * 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        /** @type {GPUBuffer|null} */
        let vertexBuffer = null
        let vertexCount = 0
        let capacity = 0

        let shaderModule = shader.createShader(device, lineWGSL)

        /** @type {GPUVertexBufferLayout[]} */
        const vertexBufferLayouts = [
            {
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x3"
                    },
                    {
                        shaderLocation: 1,
                        offset: 12,
                        format: "float32x3"
                    }
                ],
                arrayStride: 24,
                stepMode: "vertex"
            },
        ]

        /** @type {GPURenderPipelineDescriptor} */
        const pipelineDescriptor = {
            vertex: {
                module: shaderModule,
                entryPoint: "vs",
                buffers: vertexBufferLayouts,
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs',
                targets: [{ format: gpu.viewFormat }],
                constants: shader.fragmentConstants(gpu),
            },
            primitive: { topology, cullMode: 'none' },

            depthStencil: { format: renderer.DEPTH_FORMAT, depthWriteEnabled: depthCompare !== "always", depthCompare },
            layout: "auto"
        }

        let pipeline = device.createRenderPipeline(pipelineDescriptor)

        let bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
            ],
        });

        this.data = {
            gpu,
            uniformBuffer,
            vertexBuffer,
            vertexCount,
            capacity,
            shaderModule,
            pipeline,
            bindGroup
        }
    }

    /**
     * @param {Float32Array} vertices 
     */
    setVertices(vertices) {
        const data = this.data
        const { device } = data.gpu

        if (data.vertexBuffer && (vertices.byteLength != data.capacity)) {
            data.vertexBuffer.destroy()
            data.vertexBuffer = null
        }

        if (!data.vertexBuffer) {
            data.vertexBuffer = device.createBuffer({
                size: vertices.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            })
        }

        device.queue.writeBuffer(data.vertexBuffer, 0, vertices)
        this.data.capacity = vertices.byteLength
        this.data.vertexCount = vertices.length / 6
    }

    /**
     * @param {GPURenderPassEncoder} pass
     * @param {mat4.Mat4} viewProj
     * @param {mat4.Mat4} world
     * @param {renderer.Renderer} renderer  
     */
    draw(pass, viewProj, world, renderer) {
        if (this.data.vertexCount === 0) return

        const { device } = this.data.gpu
        const mvp = mat4.multiply(viewProj, world)
        device.queue.writeBuffer(this.data.uniformBuffer, 0, mvp)
        const data = this.data
        pass.setPipeline(data.pipeline)
        pass.setBindGroup(0, data.bindGroup)
        pass.setVertexBuffer(0, data.vertexBuffer)
        pass.draw(data.vertexCount)
        renderer.countDraw(data.vertexCount)
    }
}
