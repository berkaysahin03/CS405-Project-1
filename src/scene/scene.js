/**
 * YOUR SCENE — Parts A, B and D live here (and in files you add next to it).
 *
 * main.js calls, every frame:
 *     scene.update(dt, time)          dt and time in seconds
 *     scene.draw(pass, viewProj)      inside the frame's render pass
 * and scene.reset() from the panel's "reset" button.
 *
 * Suggested steps
 *   Part A  Write a small mesh pipeline (copy the structure of
 *           render/painting.js: vertex buffer → uniform buffer → bind group
 *           → pipeline → draw). Use geometry.js for cube data. Place at least
 *           three objects in front of the painting (z > 0) with YOUR mat4.
 *   Part B  Build a SceneNode tree (scene/node.js), call root.updateWorld()
 *           in update(), and draw every node with  viewProj · node.world.
 *   Part D  Draw control points and the curve over the painting
 *           (topology 'line-strip' or 'point-list' works for a start).
 *
 * WebGPU gotcha: queue.writeBuffer() calls all run BEFORE the frame's
 * commands execute. If several objects share ONE uniform buffer, they all
 * see the last value written. Give each object its own uniform buffer (or
 * its own slice of a big one, with a dynamic offset).
 *
 * Call renderer.countDraw(vertexCount) after each draw so the vertex
 * counter in the panel is correct (Part E).
 */

import { mat4, SceneNode } from "./node.js";
import * as drawable from "./drawable.js"

export function createScene({ gpu, renderer, painting, panel }) {
  const { device } = gpu;
  const state = {
    debugAxes: false,
  };

  // Example of wiring a control. Add a folder per part as you go.
  const f = panel.folder('Scene');
  f.toggle('debug axes', state, 'debugAxes');
  f.note('Add your objects in src/scene/scene.js.');

  let root = new SceneNode("root")
  let cube = new drawable.Cube("cube", mat4.multiply(mat4.translate(0, -0.5, 1), mat4.scale(0.1, 0.1, 0.1)), gpu, (cube, dt, time) => {
    cube.local = mat4.multiply(mat4.translate(Math.cos(time/2)*dt/4, Math.sin(time/2)*dt/4, Math.sin(time)*dt/2), cube.local)
    cube.local = mat4.multiply(cube.local, mat4.rotateX(dt))
    cube.local = mat4.multiply(cube.local, mat4.rotateY(dt))
  })
  let small = new drawable.Cube("small", mat4.multiply(mat4.translate(0.0, 0.0, 1.0), mat4.scale(0.5, 0.5, 0.5)), gpu)

  root.addChild(cube)
  cube.addChild(small)

  return {
    state,

    update(dt, time) {
      // TODO: animate nodes, then root.updateWorld()
      cube.data.animate(dt, time)
      root.updateWorld()
    },

    /** @param {GPURenderPassEncoder} pass  @param {Float32Array} viewProj  P · V */
    draw(pass, viewProj) {
      // TODO: one draw per object, with  mvp = viewProj · model
      root.traverse((node, depth) => {
        if (node instanceof drawable.Drawable) {
          node.draw(pass, viewProj)
        }
      })
    },

    reset() {
      // TODO: put every object (and the camera, in main.js) back where it started
    },
  };
}
