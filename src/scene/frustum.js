export function buildFrustum(camera, aspect) {
    let t = Math.tan(camera.fovY / 2)
    let h_n = camera.near * t
    let h_f = camera.far * t

    if (camera.projection === "orthographic") {
      h_n = h_f = camera.orthoHeight / 2
    }

    let w_n = h_n * aspect
    let w_f = h_f * aspect

    let corners = [
        [ w_n,  h_n, -camera.near],
        [-w_n,  h_n, -camera.near],

        [-w_n,  h_n, -camera.near],
        [-w_n, -h_n, -camera.near],

        [-w_n, -h_n, -camera.near],
        [ w_n, -h_n, -camera.near],

        [ w_n, -h_n, -camera.near],
        [ w_n,  h_n, -camera.near],


        [ w_f,  h_f, -camera.far],
        [-w_f,  h_f, -camera.far],

        [-w_f,  h_f, -camera.far],
        [-w_f, -h_f, -camera.far],

        [-w_f, -h_f, -camera.far],
        [ w_f, -h_f, -camera.far],

        [ w_f, -h_f, -camera.far],
        [ w_f,  h_f, -camera.far],


        [ w_n,  h_n, -camera.near],
        [ w_f,  h_f, -camera.far],

        [-w_n,  h_n, -camera.near],
        [-w_f,  h_f, -camera.far],

        [-w_n, -h_n, -camera.near],
        [-w_f, -h_f, -camera.far],

        [ w_n, -h_n, -camera.near],
        [ w_f, -h_f, -camera.far],
    ]
    let vertices = new Float32Array(corners.map(v => [...v, 0.5, 0.5, 0.5]).flat())
    return vertices
}