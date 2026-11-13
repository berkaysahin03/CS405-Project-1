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
import * as geometry from "./geometry.js"
import * as line from "../render/line.js"
import { BezierCurve, CatmullRomCurve } from "./curve.js";
import * as curves from "../math/curves.js"

export function createScene({ gpu, renderer, painting, panel }) {
  const { device } = gpu;
  const state = {
    debugAxes: false,
    curveKind: "bezier-c1",
    u: 0,
    t: 0,
    move: false,
    lastT: 0,
    lastTime: 0,
    showConstruction: false
  };

  // Example of wiring a control. Add a folder per part as you go.
  const f = panel.folder('Scene');
  f.toggle('debug axes', state, 'debugAxes');
  f.note('Add your objects in src/scene/scene.js.');

  const fm = panel.folder("Model matrix")
  let useSRT = fm.toggle("Use SRT", state, "useSRT")
  fm.note("TRS")
  let { set: setTRSModel } = fm.text()
  fm.note("SRT")
  let { set: setSRTModel } = fm.text()
  let txSlider = fm.slider("tx", state.bookTranslate, "0", -1, 1, 0.01)
  let tySlider = fm.slider("ty", state.bookTranslate, "1", -1, 1, 0.01)
  let tzSlider = fm.slider("tz", state.bookTranslate, "2", -1, 1, 0.01)
  let sxSlider = fm.slider("sx", state.bookScale, "0", 0.05, 1, 0.01)
  let sySlider = fm.slider("sy", state.bookScale, "1", 0.05, 1, 0.01)
  let szSlider = fm.slider("sz", state.bookScale, "2", 0.05, 1, 0.01)
  let yawSlider = fm.slider("yaw", state.bookRotate, "1", 0, Math.PI, 0.01)
  let pitchSlider = fm.slider("pitch", state.bookRotate, "0", 0, Math.PI, 0.01)
  let rollSlider = fm.slider("roll", state.bookRotate, "2", 0, Math.PI, 0.01)

  const fc = panel.folder("Curves")
  fc.select("curve", ["bezier-c1", "catmull-rom"], state.curveKind, v => {
    state.curveKind = v
  })
  let tSlider = fc.slider("t", state, "t", 0, 1, 0.001)
  fc.toggle("Move point with time", state, "move")

  const fd = panel.folder("De Casteljau Construction")
  fd.toggle("Show construction", state, "showConstruction")
  fd.slider("u", state, "u", 0, 1, 0.001)
  let { set, el } = fd.text()

  let root = new SceneNode("root")

  let coffeeCup = new SceneNode("coffee-cup", mat4.translate(-0.27, -0.7, 0.5))
  let cupLocal = mat4.multiply(
    mat4.translate(0, 0.05, 0),
    mat4.scale(0.15, 0.15, 0.15)
  )
  let cup = new drawable.Cube("cup", cupLocal, gpu)
  let plateLocal = mat4.multiply(
    mat4.translate(0, -0.02, 0),
    mat4.scale(0.4, 0.01, 0.4)
  )
  let plate = new drawable.Cube("plate", plateLocal, gpu)
  coffeeCup.addChild(cup)
  coffeeCup.addChild(plate)

  let flowerPot = new SceneNode("flower-pot", mat4.translate(-0.1, 0, 0.2))
  let potLowerLocal = mat4.multiply(
    mat4.translate(0, -0.2, 0),
    mat4.scale(0.35, 0.6, 0.35)
  )
  const LEAF_DEFAULT_ANGLE = 0.15
  let leafAngle = LEAF_DEFAULT_ANGLE
  let leafTranslate = mat4.translate(-0.113, 0.106, 0.0)
  let leafLowerLocal = mat4.multiply(
    leafTranslate,
    mat4.rotateZ(leafAngle)
  )
  let leafLower = new SceneNode("leaf-lower", leafLowerLocal)
  let leafLowerBodyLocal = mat4.multiply(
    mat4.translate(0, 0.115, 0),
    mat4.scale(0.01, 0.23, 0.01)
  )
  let leafLowerBody = new drawable.Cube("leaf-lower-body", leafLowerBodyLocal, gpu)

  let leafUpperLocal = mat4.multiply(
    mat4.translate(-0.23, 0.335, 0.0),
    mat4.multiply(
      mat4.rotateZ(-0.4),
      mat4.scale(0.5, 0.01, 0.1)
    )
  )
  let leafUpper = new drawable.Cube("leaf-upper", leafUpperLocal, gpu)
  let potLower = new drawable.Cube("pot-lower", potLowerLocal, gpu)
  flowerPot.addChild(potLower)
  flowerPot.addChild(leafLower)
  leafLower.addChild(leafLowerBody)
  leafLower.addChild(leafUpper)

  let matTranslate = mat4.translate(state.bookTranslate[0], state.bookTranslate[1], state.bookTranslate[2])
  let matScale = mat4.scale(state.bookScale[0], state.bookScale[1], state.bookScale[2])
  let matRotate = mat4.multiply(
    mat4.rotateY(state.bookRotate[1]),
    mat4.multiply(
      mat4.rotateX(state.bookRotate[0]),
      mat4.rotateZ(state.bookRotate[2]),
    )
  )
  let bookLocalTRS = mat4.multiply(
    matTranslate,
    mat4.multiply(
      matRotate,
      matScale
    )
  )
  let bookLocalSRT = mat4.multiply(
    matScale,
    mat4.multiply(
      matRotate,
      matTranslate
    )
  )

  let bookLocal = bookLocalTRS
  let book = new drawable.Cube("book", bookLocal, gpu)

  let tangent = new SceneNode("tangent", mat4.identity())
  let tangentBody = new drawable.Cube("tangentBody", mat4.scale(0.12, 0.04, 0.04), gpu)
  let tangentNose = new drawable.Cube("tangentNose", mat4.multiply(mat4.translate(0.08, 0, 0), mat4.scale(0.04, 0.02, 0.02)), gpu)
  tangent.addChild(tangentBody)
  tangent.addChild(tangentNose)

  root.addChild(coffeeCup)
  root.addChild(book)
  root.addChild(flowerPot)
  root.addChild(tangent)
  cube.addChild(small)

  root.traverse((node) => {
    node.data.axes = new line.Line(gpu, "line-list", "always")
    node.data.axes.setVertices(geometry.axes(1.5))
  })

  let bezier = new BezierCurve(gpu, painting, [1, 0, 0])
  bezier.setControlPoints([
    [0.10, 0.50], [0.20, 0.20], [0.30, 0.20],
    [0.40, 0.50],                // joint
    [0.50, 0.80], [0.55, 0.80],  // P4 = 2·P3 − P2
    [0.65, 0.50],                // joint
    [0.75, 0.20], [0.85, 0.20],  // P7 = 2·P6 − P5
    [0.90, 0.50],
  ])

  let catmullRom = new CatmullRomCurve(gpu, painting, [0, 0, 1])
  catmullRom.setControlPoints(
    [[0.10, 0.50], [0.25, 0.30], [0.40, 0.60], [0.55, 0.30], [0.70, 0.60], [0.90, 0.40]]
  )

  return {
    state,
    get curve() { return state.curveKind === "bezier-c1" ? bezier : catmullRom },

    update(dt, time) {
      // TODO: animate nodes, then root.updateWorld()
      cube.data.animate(dt, time)

      let [i, t] = curves.mapToSegmentIndex(bezier.segmentCount(), state.u)
      set("segment = " + i + ", t = " + t.toFixed(3))
      if (state.curveKind === "bezier-c1" && state.showConstruction)
        bezier.updateDeCasteljau(state.u)

      if (state.move) {
        let deltat = (time - state.lastTime) / 10
        state.t = (state.lastT + deltat - Math.floor(state.lastT + deltat))
        tSlider.update(state.t)
      } else {
        state.lastT = state.t
        state.lastTime = time
      }

      matTranslate = mat4.translate(state.bookTranslate[0], state.bookTranslate[1], state.bookTranslate[2])
      matScale = mat4.scale(state.bookScale[0], state.bookScale[1], state.bookScale[2])
      matRotate = mat4.multiply(
        mat4.rotateY(state.bookRotate[1]),
        mat4.multiply(
          mat4.rotateX(state.bookRotate[0]),
          mat4.rotateZ(state.bookRotate[2]),
        )
      )

      bookLocalTRS = mat4.multiply(
        matTranslate,
        mat4.multiply(
          matRotate,
          matScale
        )
      )
      bookLocalSRT = mat4.multiply(
        matScale,
        mat4.multiply(
          matRotate,
          matTranslate
        )
      )

      if (state.useSRT) {
        book.local = bookLocalSRT
      } else {
        book.local = bookLocalTRS
      }

      setTRSModel(mat4.format(bookLocalTRS))
      setSRTModel(mat4.format(bookLocalSRT))

      let tan = this.curve.tangent(state.t)
      let theta = Math.atan2(tan[1], tan[0])
      let point = this.curve.evaluate(state.t)
      tangent.local = mat4.rotateZ(theta)
      tangent.local = mat4.multiply(mat4.translate(point[0], point[1], 0.02), tangent.local)

      leafAngle = 0.12 * Math.sin(Math.PI * 0.5 * time) + LEAF_DEFAULT_ANGLE
      leafLower.local = mat4.multiply(
        leafTranslate,
        mat4.rotateZ(leafAngle)
      )

      root.updateWorld()
      this.curve.update()
    },

    /** @param {GPURenderPassEncoder} pass  @param {Float32Array} viewProj  P · V */
    draw(pass, viewProj) {
      // TODO: one draw per object, with  mvp = viewProj · model
      root.traverse((node, depth) => {
        if (node instanceof drawable.Drawable) {
          node.draw(pass, viewProj, renderer)
        }
      })

      this.curve.draw(pass, viewProj, renderer)

      if (state.curveKind === "bezier-c1" && state.showConstruction)
        bezier.drawDeCasteljau(pass, viewProj, renderer)

      if (state.debugAxes)
        root.traverse((node) => node.data.axes.draw(pass, viewProj, node.world, renderer))
    },

    reset() {
      // TODO: put every object (and the camera, in main.js) back where it started
    },
  };
}
