# CS405 Project 1 — Transformations, Projection & Curves from Paintings

An interactive WebGPU scene built around **İlhami Demirci — *Natürmort*** from the
Sakıp Sabancı Museum collection. The painting hangs in the scene as a textured
quad. In front of it stand a cup on a saucer, a flower pot with a swaying leaf and
a book you control from the panel. Curves traced over a leaf edge and the pot rim in the painting
carry an object that follows the curve tangent. Parts A–D of the assignment all
live in this one application.

The report is in [`report.pdf`](report.pdf).

## Running it

Requirements: **Node.js 20.19 or newer** and a browser with WebGPU (current Chrome
or Edge, Safari 26+, or Firefox 141+ on Windows).

```bash
npm install
npm run dev        # then open http://localhost:5173
npm test           # unit tests for the matrix, vector, scene-graph and curve maths
```

`npm test` should report 51 passing tests and 1 skipped. The skipped test belongs to
the B-spline family, which was not implemented; Catmull–Rom was implemented instead.

## Controls

### Mouse (on the canvas)

| Input | Effect |
|---|---|
| Left-drag on a control point | Moves the point in the plane of the painting (main view only). Bézier joints and handles keep C¹ continuity. |
| Left-drag anywhere else | Orbits the main camera around its target (pitch limited to ±80°). This also works in the inspection view, where you can watch the frustum move. |
| Mouse wheel | Zoom: changes the field of view (10°–120°) and the orthographic height with it. |

### Panel

| Folder | Control | Effect |
|---|---|---|
| **Painting** | painting | Loads another painting. The curves were traced on *Natürmort*, the default. |
| | Export curve JSON | Downloads the active curve, with its control points in normalised (u, v). |
| **Camera** | projection | Perspective or orthographic. |
| | readout | Live eye, target, fovY, near and far of the main camera. |
| **Scene** | debug axes | Draws every scene-graph node's local x/y/z axes (red/green/blue). |
| **Model matrix** (Part A) | Use SRT | Composes the book's matrix as S·R·T instead of T·R·S. |
| | TRS / SRT | Both matrices, printed live. |
| | tx, ty, tz | Translation of the book. |
| | sx, sy, sz | Scale of the book. |
| | yaw, pitch, roll | Rotation about y, x and z. The rotation is R = Ry·Rx·Rz. |
| **Curves** (Part D) | curve | `bezier-c1`: piecewise cubic Bézier with C¹ joints. `catmull-rom`: spline through the points. |
| | t | Position of the object travelling along the curve. |
| | Move point with time | Animates t, one lap every 10 s. |
| **De Casteljau Construction** | Show construction | Draws the construction levels of the Bézier at u: cyan, magenta, orange, then a white point on the curve. |
| | u | Global curve parameter. The readout shows its segment and local t. |
| **View** | View select | `main`: the camera you orbit. `inspection`: a fixed camera that shows the main camera's frustum. |
| | reset | Restores the camera, projection, view, the book's transform, both curves, t, u and the animation switch. The debug toggles and the painting choice are left as they are. |

The frame time, CPU time and the number of draws and vertices per frame are shown
at the top of the panel.

## Where things are

| Part | Files |
|---|---|
| A · Transformations | `src/math/mat4.js`, `src/math/vec3.js`; book controls in `src/scene/scene.js` |
| B · Scene graph | `src/scene/node.js`, `src/scene/drawable.js`; the tree and leaf animation in `src/scene/scene.js` |
| C · Camera & projection | `lookAt`, `perspective`, `orthographic` in `src/math/mat4.js`; `src/scene/camera.js`; `src/scene/frustum.js`; orbit and zoom in `src/main.js` |
| D · Curves | `src/math/curves.js` (maths), `src/scene/curve.js` (editable curves, picking, rendering), `src/scene/rayIntersection.js` (mouse ray ∩ painting plane), `src/scene/curveExport.js` |
| E · Integration | `src/main.js` (wiring, render loop), `src/render/` (WebGPU pipelines and shaders), `src/ui/` (panel, stats, input) |

Conventions: column-major `Float32Array(16)` matrices, column vectors (`M · p`),
right-handed world with +y up, the camera looking down −z, and WebGPU clip depth
z ∈ [0, 1]. The painting spans x ∈ [−a, a], y ∈ [−1, 1] in the plane z = 0, with
a = width / height, and the objects stand at z > 0.

## Exported curves

The traced curves are in the repository root:

- [`naturmort-bezier-c1.json`](naturmort-bezier-c1.json): 5 Bézier segments, 4 control points each.
- [`naturmort-catmull-rom.json`](naturmort-catmull-rom.json): 8 Catmull–Rom points.

Coordinates are normalised painting coordinates: u, v ∈ [0, 1], with the origin at
the top-left corner and v pointing down. The app loads these same curves at
startup and after reset.

## Troubleshooting

- **"This browser has no WebGPU"**: update the browser and serve from `localhost`
  (opening `index.html` as a file does not work). Chrome on Linux may need
  `chrome://flags/#enable-unsafe-webgpu` and `#enable-vulkan`.
- **Blank canvas**: open the browser console. WGSL errors are printed with line numbers.
