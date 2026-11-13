/**
 * Entry point: wires GPU, painting, camera, scene and UI together and runs
 * the render loop. You will edit this file a little (camera controls, views);
 * most of your work goes into src/math/ and src/scene/.
 *
 *   p_clip = P · V · M · p_object
 */
import './ui/style.css';
import { initWebGPU, showFatal } from './render/gpu.js';
import { Renderer } from './render/renderer.js';
import { Painting } from './render/painting.js';
import { createCamera, viewProjection } from './scene/camera.js';
import { createScene } from './scene/scene.js';
import { createPanel } from './ui/panel.js';
import { Stats } from './ui/stats.js';
import { attachPointer } from './ui/input.js';
import { PAINTINGS, DEFAULT_PAINTING, paintingURL } from './config.js';
import * as mat4 from './math/mat4.js';
import * as vec3 from "./math/vec3.js"
import * as curves from "./math/curves.js"
import * as line from "./render/line.js"
import { curveToJSON, downloadJSON } from './scene/curveExport';
import { buildFrustum } from './scene/frustum';
import { rayZIntersect } from './scene/rayIntersection';

async function main() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gfx'));
  const gpu = await initWebGPU(canvas);
  const renderer = new Renderer(gpu);
  const painting = new Painting(gpu);

  const params = new URLSearchParams(location.search);
  let current = PAINTINGS.find((p) => p.id === params.get('painting'))
    ?? PAINTINGS.find((p) => p.id === DEFAULT_PAINTING);
  await painting.load(paintingURL(current));

  /* ---------------- UI ---------------- */
  const panelRoot = document.getElementById('panel');
  const panel = createPanel(panelRoot);
  const title = document.createElement('h1');
  title.textContent = 'CS405 · Project 1';
  panelRoot.appendChild(title);
  const stats = new Stats(panelRoot);

  const pf = panel.folder('Painting');
  pf.select('painting', PAINTINGS.map((p) => ({ value: p.id, label: `${p.artist} — ${p.title}` })), current.id,
    async (id) => {
      current = PAINTINGS.find((p) => p.id === id);
      await painting.load(paintingURL(current));
      history.replaceState(null, '', `?painting=${id}`);
    });

  const CAMERA_NEAR = 0.5
  const CAMERA_FAR = 4
  const camera = createCamera();
  camera.near = CAMERA_NEAR
  camera.far = CAMERA_FAR
  const inspectionCamera = createCamera();
  inspectionCamera.eye = [3.5, 2.5, 4.5]
  inspectionCamera.target = [0, 0, 1]

  let viewWireframe = new line.Line(gpu, "line-list", "less")

  const cf = panel.folder('Camera');
  const camStatus = cf.text('');
  cf.select('projection', ['perspective', 'orthographic'], camera.projection, (v) => (camera.projection = v));
  const camReadout = cf.text('');

  const scene = createScene({ gpu, renderer, painting, panel });

  pf.button('Export curve JSON', () =>
    downloadJSON(curveToJSON(scene.curve, current.id), `${current.id}-${scene.curve.kind}.json`))

  const vf = panel.folder('View');
  vf.button('reset', () => { Object.assign(camera, createCamera()); scene.reset(); });
  vf.note(gpu.encodeSRGB ? 'sRGB: encoded in shader (fallback)' : 'sRGB: canvas -srgb view');

  /* -------------- input --------------- */
  /**
   * @typedef {{
   *    px: [number, number],
   *    ndc: [number, number],
   *    shift: boolean,
   *    alt: boolean
   * }} PointerInfo
   * 
   * @typedef {PointerInfo & { delta: number }} WheelInfo
   * @typedef {PointerInfo & { button: number }} ButtonInfo
   * @typedef {PointerInfo & { button: number, dx: number, dy: number }} DragInfo
   */
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b)
  const radians = d => d / 180 * Math.PI

  let lastViewProj = null
  let mode = null
  let dragIndex = -1

  function updateCamera(/** @type {DragInfo} */ e) {
    const SPEED = 0.005
    const ANGLE_LIMIT = radians(80)
    camera.yaw += -SPEED * e.dx
    camera.pitch += SPEED * e.dy
    camera.pitch = clamp(camera.pitch, -ANGLE_LIMIT, ANGLE_LIMIT)

    camera.eye = vec3.add(
      /** @type {vec3.Vec3} */ (camera.target),
      vec3.scale(
        [
          Math.cos(camera.pitch) * Math.sin(camera.yaw),
          Math.sin(camera.pitch),
          Math.cos(camera.pitch) * Math.cos(camera.yaw)
        ],
        camera.r
      )
    )
  }

  function updatePoint(/** @type {DragInfo} */ e) {
    let p = rayZIntersect(camera, canvas.width / canvas.height, e.ndc)
    if (p)
      scene.curve.movePoint(dragIndex, /** @type {[number, number]} */ (scene.curve.fromWorld(p).map(v => curves.clamp(v, 0, 1))))
  }

  attachPointer(canvas, {
    // TODO (Part C): orbit the camera on drag, zoom on wheel.
    // TODO (Part D): pick / drag control points on the painting.
    drag(/** @type {DragInfo} */ e) {
      if (mode === "orbit")
        updateCamera(e)
      else if (mode === "point")
        updatePoint(e)
    },
    wheel(/** @type {WheelInfo} */ e) {
      const SCROLL_SPEED = 0.001
      const LOW_FOV_LIMIT = radians(10)
      const HIGH_FOV_LIMIT = radians(120)
      camera.fovY += SCROLL_SPEED * e.delta
      camera.fovY = clamp(camera.fovY, LOW_FOV_LIMIT, HIGH_FOV_LIMIT)
      camera.orthoHeight = 2 * camera.r * Math.tan(camera.fovY/2)
    },
    down(/** @type {ButtonInfo} */ e) {
      if (e.button !== 0) {
        mode = null
        return
      }

      const W = canvas.clientWidth
      const H = canvas.clientHeight
      const vp = viewProjection(camera, W / H, painting.aspect);
      if (!vp.fallback) lastViewProj = vp.matrix

      if (lastViewProj === null)
        return

      dragIndex = scene.curve.hitTest(e.px, vp.matrix, W, H)
      if (dragIndex > -1 && view === "main")
        mode = "point"
      else
        mode = "orbit"
    },

    up(/** @type {ButtonInfo} */ e) {
      mode = null
      dragIndex = -1
    }
  });

  /* ------------ render loop ----------- */
  let last = performance.now();
  function frame(now) {
    stats.begin(now);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    scene.update(dt, now / 1000);

    const aspect = canvas.width / canvas.height;
    if (view === "inspection") {
      let vertices = buildFrustum(camera, aspect)
      viewWireframe.setVertices(vertices)
    }

    const vp = viewProjection(view === "main" ? camera : inspectionCamera, aspect, painting.aspect);
    camStatus.set(vp.fallback
      ? `PLACEHOLDER view (no camera yet)\n${vp.missing}`
      : `camera: P · V (${camera.projection})`);
    camStatus.el.classList.toggle('warn', vp.fallback);
    camReadout.set(
      `eye    ${camera.eye.map((x) => x.toFixed(2)).join(', ')}\n` +
      `target ${camera.target.map((x) => x.toFixed(2)).join(', ')}\n` +
      `fovY ${(camera.fovY * 180 / Math.PI).toFixed(1)}°  near ${camera.near}  far ${camera.far}`
    );

    const paintingMVP = vp.fallback ? vp.matrix : mat4.multiply(vp.matrix, painting.model);
    renderer.render((pass) => {
      painting.draw(pass, paintingMVP, renderer);
      scene.draw(pass, vp.matrix);
      if (view === "inspection") {
        let V = mat4.lookAt(camera.eye, camera.target, camera.up)
        let Vinv = mat4.invertRigid(V)
        viewWireframe.draw(pass, vp.matrix, Vinv, renderer)
      }
    });

    stats.end(renderer.stats);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  showFatal(e.message ?? String(e));
});
