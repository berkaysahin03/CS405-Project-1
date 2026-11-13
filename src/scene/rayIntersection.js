import * as curves from "../math/curves.js"
import * as mat4 from "../math/mat4.js"
import * as vec3 from "../math/vec3.js"

export function rayZIntersect(camera, aspect, ndc) {
    let [right, up, forward] = mat4.computeCameraBasis(
      /** @type {vec3.Vec3} */ (camera.eye),
      /** @type {vec3.Vec3} */ (camera.target),
      /** @type {vec3.Vec3} */ (camera.up)
    )
    forward = [-forward[0], -forward[1], -forward[2]]

    let direction = [0, 0, 0]
    let origin = [0, 0, 0]
    let k = Math.tan(camera.fovY / 2)
    const H = camera.orthoHeight / 2;
    const W = H * aspect

    if (camera.projection == "orthographic") {
      origin = curves.add(
        camera.eye,
        curves.add(
          curves.scale(right, ndc[0] * W),
          curves.scale(up, ndc[1] * H)
        )
      )
      direction = forward
    } else {
      origin = camera.eye
      direction = curves.add(
        curves.add(
          forward,
          curves.scale(right, ndc[0] * k * aspect),
        ),
        curves.scale(up, ndc[1] * k)
      )
    }

    if (Math.abs(direction[2]) < 1e-6)
      return null

    let t = -origin[2] / direction[2]
    if (t < 0)
      return null

    let x = origin[0] + t * direction[0]
    let y = origin[1] + t * direction[1]

    return [x, y]
}