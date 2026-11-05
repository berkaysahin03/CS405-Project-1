import { mat4, SceneNode } from "./node.js";
import * as geometry from "./geometry.js"
import * as shader from "../render/shader.js"

import paintingWGSL from '../render/shaders/drawable.wgsl?raw'

/** @typedef {function(Drawable, number, number): void} AnimationFunction */

export class Drawable extends SceneNode {
    /**
     * @param {string} name
     * @param {mat4.Mat4} local
     * @param {GPUDevice} device
     * @param {Float32Array} vertices
     * @param {AnimationFunction} animate
     */
    constructor(name, local, device, vertices, animate) {
        super(name, local)

        let uniformBuffer = device.createBuffer({
            size: this.local.byteLength * 2,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        let vertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        })
        device.queue.writeBuffer(vertexBuffer, 0, vertices)

        let shaderModule = shader.createShader(device, paintingWGSL)

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
                entryPoint: "fs",
                targets: [
                    {
                        format: /** @type {GPUTextureFormat} */ (navigator.gpu.getPreferredCanvasFormat() + "-srgb")
                    }
                ]
            },
            primitive: {
                topology: "triangle-list"
            },
            depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: 'less' },
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
            ...this.data,
            device,
            vertices,
            uniformBuffer,
            vertexBuffer,
            shaderModule,
            pipeline,
            bindGroup,
            animate: (/** @type {number} */ dt, /** @type {number} */ time) => animate(this, dt, time)
        }
    }

    /**
     * @param {GPURenderPassEncoder} pass 
     * @param {mat4.Mat4} viewProj 
     */
    draw(pass, viewProj) {
        const mtn = mat4.transpose(mat4.invertRigid(this.world))
        const mvp = mat4.multiply(viewProj, this.world)
        this.data.device.queue.writeBuffer(this.data.uniformBuffer, 0, mvp)
        this.data.device.queue.writeBuffer(this.data.uniformBuffer, mvp.byteLength, mtn)
        const data = this.data
        pass.setPipeline(data.pipeline)
        pass.setBindGroup(0, data.bindGroup)
        pass.setVertexBuffer(0, data.vertexBuffer)
        pass.draw(data.vertices.length / 6)
    }
}

export class Cube extends Drawable {
    /**
     * @param {string} name
     * @param {mat4.Mat4} local
     * @param {GPUDevice} device
     * @param {AnimationFunction|null} animationFn 
     */
    constructor(name, local = mat4.identity(), device, animationFn = null) {
        super(name, local, device, geometry.cube(), animationFn)
    }
}