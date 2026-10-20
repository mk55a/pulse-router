// Pulse Router — Three.js board view, loaded through the scene host (src/app/scene.js).
// Instanced raised tiles, glyphs, a shader-driven path trail, the pulse head and a bloom pass.
// The view never decides rules; gameplay.js tells it what happened.
// The path, pulse and Source follow the equipped skin (src/game/skins.js); the rest uses PALETTE.
import { SKINS } from '../skins.js';

export const PALETTE = Object.freeze({
  background: 0x090e21,
  base: 0x121a36,
  tile: 0x26304f,
  tileLit: 0x34416b,
  accent: 0x65e7ff,   // path and pulse
  node: 0xb99bff,     // nodes (diamond silhouette)
  exit: 0xff8ac9,     // exit (square gate silhouette)
  hazard: 0xffb347,   // failure and unpowered warnings
  alarm: 0xff4d5e,    // nodes a Locked pulse missed
  dark: 0x3a4466
});

const TILE_PITCH = 1.0, TILE_SIZE = 0.86, TILE_H = 0.32, LIFT = 0.12;

function waitForEngine(signal, timeoutMs = 20000) {
  const ready = () => globalThis.THREE?.WebGLRenderer;
  if (ready()) return Promise.resolve(globalThis.THREE);
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const timer = setInterval(() => {
      if (signal?.aborted) { clearInterval(timer); reject(signal.reason); return; }
      if (ready()) { clearInterval(timer); resolve(globalThis.THREE); return; }
      if (performance.now() - started > timeoutMs) { clearInterval(timer); reject(new Error('Three.js did not load')); }
    }, 30);
  });
}
// Bloom scripts are optional: the board must read without them.
function waitForBloom(timeoutMs = 4000) {
  const ready = () => globalThis.THREE?.EffectComposer && globalThis.THREE?.UnrealBloomPass && globalThis.THREE?.RenderPass;
  if (ready()) return Promise.resolve(true);
  return new Promise(resolve => {
    const started = performance.now();
    const timer = setInterval(() => {
      if (ready()) { clearInterval(timer); resolve(true); }
      else if (performance.now() - started > timeoutMs) { clearInterval(timer); resolve(false); }
    }, 40);
  });
}

const TRAIL_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TRAIL_FRAGMENT = `
  uniform vec3 uColor; uniform float uTime; uniform float uLen; uniform float uDash;
  uniform float uHead; uniform float uHeadOn; uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float along = vUv.x * uLen;
    if (uDash > 0.5 && fract(along * 3.0) > 0.5) discard;
    float band = fract(along * 0.5 - uTime * 0.9);
    float flow = 0.62 + 0.38 * smoothstep(0.0, 0.25, band) * (1.0 - smoothstep(0.25, 0.85, band));
    float trail = uHeadOn * smoothstep(uHead - 2.5, uHead, along) * step(along, uHead + 0.02);
    vec3 col = uColor * (flow * uIntensity + trail * 1.6);
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createBoardView({ reducedMotion = false } = {}) {
  let skin = SKINS[0];
  const api = {
    ready: false, canvas: null, bloomAvailable: false,
    setLevel() {}, setPath() {}, pick() { return null; }, bump() {}, setHint() {},
    lightTile() {}, pulseTile() {}, nodeBurst() {}, setPulse() {}, setPulseBoost() {}, clearMissed() {},
    // Takes effect on the next setLevel.
    setSkin(next) { if (next) skin = next; }, failDrained() {}, failLocked() {}, failStalled() {},
    relight() {}, winRipple() {}, setBloom() {}, setReducedMotion(v) { reducedMotion = v; }
  };

  async function factory({ container, signal }) {
    const THREE = await waitForEngine(signal);
    const bloomReady = await waitForBloom();
    if (signal.aborted) throw signal.reason;
    const T = THREE;

    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.append(renderer.domElement);
    api.canvas = renderer.domElement;

    const scene = new T.Scene();
    scene.background = new T.Color(PALETTE.background);
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 200);

    scene.add(new T.AmbientLight(0xffffff, 0.55));
    scene.add(new T.HemisphereLight(0xd9f0ff, 0x30395c, 0.45));
    const key = new T.DirectionalLight(0xffffff, 0.7);
    key.position.set(-4, 12, 7); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    key.shadow.normalBias = 0.04;
    scene.add(key, key.target);

    // ---------- Bloom (half resolution, optional) ----------
    let composer = null, bloomPass = null, bloomOn = bloomReady;
    if (bloomReady) {
      composer = new T.EffectComposer(renderer);
      composer.addPass(new T.RenderPass(scene, camera));
      bloomPass = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.85, 0.45, 0.62);
      composer.addPass(bloomPass);
    }
    api.bloomAvailable = !!composer;

    // ---------- Shared resources ----------
    const disposables = new Set();
    const own = x => { disposables.add(x); return x; };
    const std = (color, extras = {}) => own(new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2, ...extras }));
    const glowMat = (color, emissiveIntensity) => std(0x111111, { emissive: new T.Color(color), emissiveIntensity });

    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
    const g = glowCanvas.getContext('2d'); const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const glowTex = own(new T.CanvasTexture(glowCanvas));

    let level = null;                // { group, board, tiles, ... }
    const effects = [];              // short-lived animations: fn(dt) -> keep?
    let time = 0;
    // The skin's accent this frame (drifts in hue for hueShift skins).
    const liveAccent = new T.Color(skin.accent), accentHSL = { h: 0, s: 0, l: 0 };

    // ---------- Level construction ----------
    function cellPos(r, c) {
      const b = level.board;
      return new T.Vector3((c - (b.cols - 1) / 2) * TILE_PITCH, 0, (r - (b.rows - 1) / 2) * TILE_PITCH);
    }

    function disposeLevel() {
      if (!level) return;
      effects.length = 0; // their meshes belong to the group being removed
      scene.remove(level.group);
      level.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMap) o.material.map.dispose(); });
      for (const m of level.materials) m.dispose();
      level = null;
    }

    api.setLevel = board => {
      disposeLevel();
      const group = new T.Group(); scene.add(group);
      const materials = [];
      const mat = (m) => { materials.push(m); return m; };
      liveAccent.set(skin.accent); new T.Color(skin.accent).getHSL(accentHSL);
      level = { board, group, materials, tiles: [], trail: null, dashes: null, label: null, glyphs: {}, hint: null, pulseIndex: -1 };
      const n = board.rows * board.cols;

      // Board base with a cyan edge line.
      const baseW = board.cols * TILE_PITCH + 0.5, baseD = board.rows * TILE_PITCH + 0.5;
      const base = new T.Mesh(new T.BoxGeometry(baseW, 0.3, baseD), mat(new T.MeshStandardMaterial({ color: PALETTE.base, roughness: 0.5, metalness: 0.3 })));
      base.position.y = -0.17; base.receiveShadow = true; group.add(base);
      const edgeMat = mat(new T.MeshBasicMaterial({ color: new T.Color(skin.accent).multiplyScalar(0.55) }));
      for (const s of [-1, 1]) {
        const a = new T.Mesh(new T.BoxGeometry(baseW, 0.03, 0.03), edgeMat); a.position.set(0, -0.01, s * baseD / 2); group.add(a);
        const b2 = new T.Mesh(new T.BoxGeometry(0.03, 0.03, baseD), edgeMat); b2.position.set(s * baseW / 2, -0.01, 0); group.add(b2);
      }

      // Raised tiles: one instanced mesh.
      const tileGeo = new T.BoxGeometry(TILE_SIZE, TILE_H, TILE_SIZE);
      const tileMat = mat(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.25 }));
      const tiles = new T.InstancedMesh(tileGeo, tileMat, n);
      tiles.castShadow = true; tiles.receiveShadow = true;
      // Unlit additive glow plates on top of each tile (per-instance colour = glow).
      const plateGeo = new T.PlaneGeometry(TILE_SIZE * 1.02, TILE_SIZE * 1.02); plateGeo.rotateX(-Math.PI / 2);
      const plateMat = mat(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      const plates = new T.InstancedMesh(plateGeo, plateMat, n);
      // Hole sockets: dark recessed squares with a faint rim.
      const socketMat = mat(new T.MeshStandardMaterial({ color: 0x05070f, roughness: 0.9 }));
      const socketRim = mat(new T.MeshBasicMaterial({ color: 0x1b2340 }));
      const tmpColor = new T.Color();
      for (let r = 0; r < board.rows; r++) for (let c = 0; c < board.cols; c++) {
        const i = r * board.cols + c, ch = board.cells[i];
        const p = cellPos(r, c);
        const t = { r, c, i, ch, lift: 0, liftTarget: 0, glow: 0, glowColor: new T.Color(skin.accent), bump: 0, flicker: 0, hole: ch === '#', onPath: false, base: new T.Color(PALETTE.tile) };
        level.tiles.push(t);
        if (t.hole) {
          const s = new T.Mesh(new T.BoxGeometry(TILE_SIZE * 0.92, 0.02, TILE_SIZE * 0.92), socketMat); s.position.set(p.x, -0.01, p.z); group.add(s);
          const rimGeo = new T.RingGeometry(TILE_SIZE * 0.28, TILE_SIZE * 0.31, 4); rimGeo.rotateX(-Math.PI / 2); rimGeo.rotateY(Math.PI / 4);
          const rim = new T.Mesh(rimGeo, socketRim); rim.position.set(p.x, 0.005, p.z); group.add(rim);
        }
        tiles.setColorAt(i, tmpColor.set(PALETTE.tile));
        plates.setColorAt(i, tmpColor.set(0x000000));
      }
      group.add(tiles, plates);
      level.tilesMesh = tiles; level.plates = plates;

      // Glyphs: each type has its own silhouette, not just colour.
      const top = TILE_H + 0.005;
      const sp = cellPos(...board.source);
      const srcMat = mat(glowMat(skin.accent, 1.4));
      const srcCore = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.08, 24), srcMat);
      const src = new T.Group(); src.add(...sourceOutline(skin.source, srcMat), srcCore); src.position.set(sp.x, top + 0.04, sp.z); group.add(src);
      level.glyphs.source = { group: src, mat: srcMat, r: board.source[0], c: board.source[1] };

      const ep = cellPos(...board.exit);
      const exitMat = mat(glowMat(PALETTE.exit, 0.35));
      const frame = new T.Mesh(new T.TorusGeometry(0.3, 0.05, 6, 4), exitMat); frame.rotation.x = -Math.PI / 2; frame.rotation.z = Math.PI / 4;
      const bar1 = new T.Mesh(new T.BoxGeometry(0.34, 0.05, 0.06), exitMat);
      const bar2 = bar1.clone(); bar1.rotation.y = Math.PI / 4; bar2.rotation.y = -Math.PI / 4;
      const lock = new T.Group(); lock.add(bar1, bar2);
      const ex = new T.Group(); ex.add(frame, lock); ex.position.set(ep.x, top + 0.04, ep.z); group.add(ex);
      level.glyphs.exit = { group: ex, mat: exitMat, lock, unlocked: false, flash: 0, r: board.exit[0], c: board.exit[1] };

      level.glyphs.nodes = board.nodes.map(([r, c]) => {
        const p = cellPos(r, c);
        const m = mat(glowMat(PALETTE.node, 0.55));
        const gem = new T.Mesh(new T.OctahedronGeometry(0.2, 0), m); gem.scale.y = 1.35;
        gem.position.set(p.x, top + 0.3, p.z); gem.castShadow = true; group.add(gem);
        // Ordered nodes carry their number, so order never relies on colour.
        const number = board.order[r * board.cols + c];
        const label = number ? numberSprite(number) : null;
        if (label) { label.position.set(p.x, top + 0.78, p.z); group.add(label); materials.push(label.material); }
        return { r, c, mesh: gem, mat: m, number, label, lit: false, onPath: false, pulse: 0, seed: (r * 7 + c * 3) % 10 };
      });

      // Hint marker (hidden until requested).
      const hintMat = mat(new T.MeshBasicMaterial({ color: skin.accent, transparent: true, opacity: 0.0, depthWrite: false }));
      const hintGeo = new T.RingGeometry(0.33, 0.4, 32); hintGeo.rotateX(-Math.PI / 2);
      const hint = new T.Mesh(hintGeo, hintMat); hint.visible = false; group.add(hint);
      level.hint = { mesh: hint, mat: hintMat };

      // Pulse head: bright core + additive halo.
      const headMat = mat(new T.MeshBasicMaterial({ color: new T.Color(skin.head) }));
      const head = new T.Mesh(new T.SphereGeometry(0.13 * (skin.headScale ?? 1), 16, 12), headMat);
      const haloMat = mat(new T.SpriteMaterial({ map: glowTex, color: skin.accent, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      const halo = new T.Sprite(haloMat); halo.scale.set(1.1, 1.1, 1);
      const pulse = new T.Group(); pulse.add(head, halo); pulse.visible = false; group.add(pulse);
      const pulseLight = new T.PointLight(skin.accent, 0, 3.2); pulse.add(pulseLight);
      halo.scale.setScalar(1.1 * (skin.headScale ?? 1));
      level.pulse = { group: pulse, light: pulseLight, halo, fade: 1 };

      fitCamera();
      syncInstances();
    };

    // ---------- Path trail ----------
    function tubeFor(points, { dash = false, color, intensity = 1 }) {
      const path = new T.CurvePath();
      for (let i = 0; i < points.length - 1; i++) path.add(new T.LineCurve3(points[i], points[i + 1]));
      const segments = Math.max(1, points.length - 1);
      const geo = new T.TubeGeometry(path, segments * 12, dash ? 0.045 : 0.065, 8, false);
      const m = new T.ShaderMaterial({
        uniforms: { uColor: { value: new T.Color(color) }, uTime: { value: 0 }, uLen: { value: segments }, uDash: { value: dash ? 1 : 0 }, uHead: { value: -10 }, uHeadOn: { value: 0 }, uIntensity: { value: intensity } },
        vertexShader: TRAIL_VERTEX, fragmentShader: TRAIL_FRAGMENT
      });
      const mesh = new T.Mesh(geo, m);
      level.group.add(mesh);
      return mesh;
    }
    // Source outline per skin: polygons are low-segment tori, so every shape shares one material.
    function sourceOutline(shape, material) {
      const flat = m => { m.rotation.x = -Math.PI / 2; return m; };
      const torus = (r, sides) => flat(new T.Mesh(new T.TorusGeometry(r, 0.05, 8, sides), material));
      if (shape === 'hex') return [torus(0.29, 6)];
      if (shape === 'triangle') { const m = torus(0.32, 3); m.rotation.z = Math.PI / 2; return [m]; }
      if (shape === 'diamond') { const m = torus(0.3, 4); return [m]; }
      if (shape === 'double') return [torus(0.3, 40), torus(0.19, 40)];
      if (shape === 'star') {
        const s = new T.Shape();
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.15 : 0.33;
          if (i) s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        s.closePath();
        const hole = new T.Path(); hole.absarc(0, 0, 0.16, 0, Math.PI * 2, true); s.holes.push(hole);
        return [flat(new T.Mesh(new T.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }), material))];
      }
      return [torus(0.27, 40)];
    }
    function numberSprite(n) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(9,14,33,.9)'; x.strokeStyle = '#b99bff'; x.lineWidth = 4;
      x.beginPath(); x.arc(32, 32, 27, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#f1ebff'; x.font = 'bold 36px Fredoka, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(n), 32, 35);
      const tex = new T.CanvasTexture(cv);
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(0.36, 0.36, 1); s.renderOrder = 5; s.userData.ownMap = true;
      return s;
    }
    function removeMesh(mesh) { if (!mesh) return; mesh.parent?.remove(mesh); mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }
    function labelSprite(text, color) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(9,14,33,.85)'; x.strokeStyle = color; x.lineWidth = 4;
      x.beginPath(); x.roundRect ? x.roundRect(6, 6, 116, 52, 18) : x.rect(6, 6, 116, 52); x.fill(); x.stroke();
      x.fillStyle = color; x.font = 'bold 34px Fredoka, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, 64, 34);
      const tex = new T.CanvasTexture(cv);
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(0.8, 0.4, 1); s.renderOrder = 10;
      level.group.add(s);
      return s;
    }

    const trailY = TILE_H + LIFT + 0.07;
    api.setPath = ({ cells, diesAt, short, exitUnlocked, onPathNodes }) => {
      if (!level) return;
      removeMesh(level.trail); removeMesh(level.dashes); removeMesh(level.label);
      level.trail = level.dashes = level.label = null;
      const pts = cells.map(([r, c]) => { const p = cellPos(r, c); p.y = trailY; return p; });
      const poweredEnd = diesAt > 0 ? diesAt - 1 : cells.length - 1;
      if (poweredEnd >= 1) level.trail = tubeFor(pts.slice(0, poweredEnd + 1), { color: skin.accent, intensity: 1.15 });
      if (diesAt > 0) {
        level.dashes = tubeFor(pts.slice(poweredEnd), { dash: true, color: PALETTE.dark, intensity: 1 });
        level.label = labelSprite(`−${short}`, '#ffb347');
        const p = pts[poweredEnd]; level.label.position.set(p.x, p.y + 0.55, p.z);
      }
      const onSet = new Set(cells.map(([r, c]) => r * level.board.cols + c));
      for (const t of level.tiles) { t.onPath = onSet.has(t.i); t.liftTarget = t.onPath ? LIFT : 0; }
      for (let i = 0; i < cells.length; i++) {
        const t = level.tiles[cells[i][0] * level.board.cols + cells[i][1]];
        t.powered = diesAt < 0 || i < diesAt;
      }
      const ex = level.glyphs.exit;
      if (exitUnlocked && !ex.unlocked) { ex.flash = 1; }
      ex.unlocked = exitUnlocked;
      let next = 1;
      for (const nd of level.glyphs.nodes) { nd.onPath = onPathNodes.has(nd.r * level.board.cols + nd.c); if (nd.number && nd.onPath) next++; }
      // Numbers after the next one wait dimmed until their turn.
      for (const nd of level.glyphs.nodes) if (nd.label) nd.label.material.opacity = nd.onPath || nd.number === next ? 1 : 0.45;
    };

    // ---------- Picking ----------
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -(TILE_H)), hit = new T.Vector3();
    api.pick = (x, y, width, height) => {
      if (!level) return null;
      ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const b = level.board;
      const fc = hit.x / TILE_PITCH + (b.cols - 1) / 2, fr = hit.z / TILE_PITCH + (b.rows - 1) / 2;
      const c = Math.round(fc), r = Math.round(fr);
      return { r, c, fr, fc, inside: r >= 0 && c >= 0 && r < b.rows && c < b.cols };
    };

    // ---------- Feedback ----------
    const tileAt = (r, c) => level?.tiles[r * level.board.cols + c];
    api.bump = (r, c) => { const t = tileAt(r, c); if (t && !t.hole) t.bump = 1; };
    api.lightTile = (r, c, strength = 1, color = skin.accent) => { const t = tileAt(r, c); if (t && !t.hole) { t.glow = Math.max(t.glow, strength); t.glowColor.set(color); } };
    // A tile the pulse enters: light it, plus the skin's burst.
    api.pulseTile = (r, c, progress = 0) => {
      api.lightTile(r, c, 1, liveAccent);
      if (!level || reducedMotion) return;
      const p = cellPos(r, c); p.y = TILE_H + LIFT + 0.08;
      if (skin.burst === 'ring') {
        const geo = new T.RingGeometry(0.16, 0.22, 32); geo.rotateX(-Math.PI / 2);
        const m = new T.MeshBasicMaterial({ color: liveAccent.clone(), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
        const ring = new T.Mesh(geo, m); ring.position.copy(p); level.group.add(ring);
        let t = 0;
        effects.push(dt => { t += dt; const k = t / 0.45; ring.scale.setScalar(1 + k * 2.2); m.opacity = Math.max(0, 0.9 - k); if (k >= 1) { removeMesh(ring); return false; } return true; });
      } else if (skin.burst === 'spark') {
        // More sparks as the run speeds up.
        const count = 2 + Math.round(progress * 3);
        for (let i = 0; i < count; i++) {
          const m = new T.SpriteMaterial({ map: glowTex, color: liveAccent.clone(), blending: T.AdditiveBlending, depthWrite: false, transparent: true });
          const s = new T.Sprite(m); s.position.copy(p); s.scale.setScalar(0.16); level.group.add(s);
          const a = Math.random() * Math.PI * 2, speed = 1.2 + Math.random() * 1.4;
          const v = new T.Vector3(Math.cos(a) * speed * 0.5, 1.4 + Math.random() * 1.2, Math.sin(a) * speed * 0.5);
          let t = 0;
          effects.push(dt => { t += dt; v.y -= dt * 5; s.position.addScaledVector(v, dt); m.opacity = Math.max(0, 1 - t / 0.5); if (t >= 0.5) { level?.group.remove(s); m.dispose(); return false; } return true; });
        }
      }
    };
    api.setHint = cell => {
      if (!level) return;
      const h = level.hint;
      if (!cell) { h.mesh.visible = false; return; }
      const p = cellPos(cell[0], cell[1]); h.mesh.position.set(p.x, TILE_H + LIFT + 0.02, p.z); h.mesh.visible = true; h.t = 0;
    };
    api.nodeBurst = (r, c) => {
      const nd = level?.glyphs.nodes.find(n => n.r === r && n.c === c); if (!nd) return;
      nd.lit = true; nd.pulse = 1;
      const geo = new T.RingGeometry(0.2, 0.26, 40); geo.rotateX(-Math.PI / 2);
      const m = new T.MeshBasicMaterial({ color: PALETTE.node, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const ring = new T.Mesh(geo, m); const p = cellPos(r, c); ring.position.set(p.x, TILE_H + LIFT + 0.1, p.z); level.group.add(ring);
      let t = 0;
      effects.push(dt => { t += dt; const k = t / 0.6; ring.scale.setScalar(1 + k * 3); m.opacity = Math.max(0, 1 - k); if (k >= 1) { removeMesh(ring); return false; } return true; });
    };
    api.setPulse = ({ visible, position = 0, cells = [] }) => {
      if (!level) return;
      const p = level.pulse; p.group.visible = visible; p.light.intensity = visible ? 1.6 * p.fade : 0;
      if (!visible) { if (level.trail) level.trail.material.uniforms.uHeadOn.value = 0; return; }
      const i = Math.min(cells.length - 2, Math.floor(position));
      const f = cells.length > 1 ? position - Math.max(0, i) : 0;
      const a = cellPos(...cells[Math.max(0, i)]), b = cellPos(...cells[Math.min(cells.length - 1, Math.max(0, i) + 1)]);
      p.group.position.lerpVectors(a, b, Math.min(1, f)).setY(trailY + 0.05);
      p.group.scale.setScalar(Math.max(0.05, p.fade));
      if (level.trail) { level.trail.material.uniforms.uHeadOn.value = 1; level.trail.material.uniforms.uHead.value = position; }
    };
    // Failure presentations (each under ~1.2 s).
    api.failDrained = (r, c) => {
      const t = tileAt(r, c); if (!t) return;
      t.flicker = 1.1; t.bump = 0.8;
      level.pulse.fade = 1;
      let k = 0; effects.push(dt => { k += dt; level.pulse.fade = Math.max(0, 1 - k / 0.5); return k < 0.5; });
    };
    api.failLocked = missing => {
      const ex = level.glyphs.exit; ex.reject = 1; level.pulse.fade = 1;
      let k = 0; effects.push(dt => { k += dt; level.pulse.fade = Math.max(0, 1 - k / 0.35); return k < 0.35; });
      // Missed nodes flash, then stay red and swollen until the path changes.
      for (const [r, c] of missing) { const nd = level.glyphs.nodes.find(n => n.r === r && n.c === c); if (nd) { nd.missed = 1.6; nd.alarm = true; } }
    };
    api.clearMissed = () => { if (level) for (const nd of level.glyphs.nodes) nd.alarm = false; };
    api.failStalled = () => { let k = 0; level.pulse.fade = 1; effects.push(dt => { k += dt; level.pulse.fade = Math.max(0, 1 - k / 0.7); return k < 0.7; }); };
    // Ripples spread by board distance from a point; reverse = darkening then relight.
    function ripple(from, { color, strength = 1, speed = 9, delay = 0 }) {
      for (const t of level.tiles) {
        if (t.hole) continue;
        const d = Math.hypot(t.r - from[0], t.c - from[1]);
        const wait = delay + d / speed;
        let k = 0; effects.push(dt => { k += dt; if (k >= wait) { t.glow = Math.max(t.glow, strength); t.glowColor.set(color); return false; } return true; });
      }
    }
    api.relight = from => ripple(from, { color: skin.accent, strength: 0.45, speed: 14 });
    api.winRipple = from => { ripple(from, { color: skin.accent, strength: 1, speed: 7 }); ripple(from, { color: PALETTE.node, strength: 0.8, speed: 7, delay: 0.5 }); };
    api.setBloom = on => { bloomOn = !!on && !!composer; };
    // Bloom swells with the pulse (0..1) and settles back afterwards.
    let boostTarget = 0, boost = 0;
    const BLOOM_BASE = 0.85, BLOOM_SWELL = 0.75;
    api.setPulseBoost = k => { boostTarget = Math.max(0, Math.min(1, k)); };

    // ---------- Camera fit ----------
    let viewport = { width: 1, height: 1 };
    const viewDir = new T.Vector3(0, Math.sin(THREE.MathUtils.degToRad(58)), Math.cos(THREE.MathUtils.degToRad(58)));
    let camDistance = 10, swayT = 0;
    function placeCamera(dist, sway = 0) {
      const dir = viewDir.clone().applyAxisAngle(new T.Vector3(0, 1, 0), sway);
      camera.position.copy(dir.multiplyScalar(dist));
      camera.lookAt(0, 0, 0);
    }
    // Safe area in NDC leaves room for the HUD bars above and below the board.
    const SAFE = { left: -0.9, right: 0.9, top: 0.62, bottom: -0.58 };
    function fitCamera() {
      if (!level) return;
      camera.aspect = viewport.width / Math.max(1, viewport.height);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      const b = level.board, hw = b.cols * TILE_PITCH / 2 + 0.3, hd = b.rows * TILE_PITCH / 2 + 0.3;
      const corners = [];
      for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-0.3, TILE_H + 0.6]) corners.push(new T.Vector3(x, y, z));
      const bounds = d => {
        placeCamera(d); camera.updateMatrixWorld();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of corners) { const q = p.clone().project(camera); minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
        return { minX, maxX, minY, maxY };
      };
      let lo = 2, hi = 80;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2, q = bounds(mid);
        const fits = (q.maxX - q.minX) <= (SAFE.right - SAFE.left) && (q.maxY - q.minY) <= (SAFE.top - SAFE.bottom);
        if (fits) hi = mid; else lo = mid;
      }
      camDistance = hi;
      const q = bounds(camDistance);
      const shiftY = (SAFE.top + SAFE.bottom) / 2 - (q.maxY + q.minY) / 2; // NDC units, + moves content up
      const w = Math.max(1, viewport.width), h = Math.max(1, viewport.height);
      camera.setViewOffset(w, h, 0, -shiftY * h / 2, w, h);
      camera.updateProjectionMatrix();
    }

    // ---------- Per-frame ----------
    const m4 = new T.Matrix4(), q4 = new T.Quaternion(), s3 = new T.Vector3(1, 1, 1), v3 = new T.Vector3(), col = new T.Color(), lit = new T.Color(PALETTE.tileLit);
    function syncInstances() {
      if (!level) return;
      for (const t of level.tiles) {
        const p = cellPos(t.r, t.c);
        if (t.hole) { m4.makeScale(0.0001, 0.0001, 0.0001); level.tilesMesh.setMatrixAt(t.i, m4); level.plates.setMatrixAt(t.i, m4); continue; }
        const bumpY = Math.sin(t.bump * Math.PI) * 0.08;
        const shake = t.flicker > 0 ? Math.sin(time * 70) * 0.03 * Math.min(1, t.flicker) : 0;
        const y = TILE_H / 2 + t.lift + bumpY;
        v3.set(p.x + shake, y, p.z); m4.compose(v3, q4, s3);
        level.tilesMesh.setMatrixAt(t.i, m4);
        v3.set(p.x + shake, TILE_H + t.lift + bumpY + 0.003, p.z); m4.compose(v3, q4, s3);
        level.plates.setMatrixAt(t.i, m4);
        col.copy(t.onPath ? lit : t.base);
        if (t.flicker > 0) col.lerp(new T.Color(PALETTE.hazard), (Math.sin(time * 40) > 0 ? 0.6 : 0.15) * Math.min(1, t.flicker));
        level.tilesMesh.setColorAt(t.i, col);
        const pathGlow = t.onPath ? (t.powered === false ? 0.04 : 0.12) : 0;
        col.copy(t.glowColor).multiplyScalar(Math.min(1, t.glow * 0.85 + pathGlow));
        level.plates.setColorAt(t.i, col);
      }
      level.tilesMesh.instanceMatrix.needsUpdate = true; level.plates.instanceMatrix.needsUpdate = true;
      if (level.tilesMesh.instanceColor) level.tilesMesh.instanceColor.needsUpdate = true;
      if (level.plates.instanceColor) level.plates.instanceColor.needsUpdate = true;
    }

    function update(dt) {
      time += dt;
      for (let i = effects.length - 1; i >= 0; i--) if (!effects[i](dt)) effects.splice(i, 1);
      if (!level) return;
      for (const t of level.tiles) {
        t.lift += (t.liftTarget - t.lift) * Math.min(1, dt * 14);
        t.glow = Math.max(0, t.glow - dt * 1.6);
        t.bump = Math.max(0, t.bump - dt * 5);
        t.flicker = Math.max(0, t.flicker - dt);
      }
      syncInstances();
      const slow = reducedMotion ? 0 : 1;
      // Glyph idle pulses.
      // Glyphs ride on their tile so a raised path tile never swallows them.
      const liftOf = (r, c) => level.tiles[r * level.board.cols + c].lift;
      const src = level.glyphs.source; src.mat.emissiveIntensity = 1.2 + Math.sin(time * 2.4) * 0.3 * slow;
      src.group.position.y = TILE_H + 0.045 + liftOf(src.r, src.c);
      src.group.rotation.y += dt * 0.6 * slow;
      const ex = level.glyphs.exit;
      ex.flash = Math.max(0, (ex.flash || 0) - dt * 2);
      ex.reject = Math.max(0, (ex.reject || 0) - dt * 2.2);
      const exitBase = ex.unlocked ? 1.2 + Math.sin(time * 3) * 0.2 * slow : 0.3;
      ex.mat.emissiveIntensity = exitBase + ex.flash * 1.5 + (ex.reject > 0 && Math.sin(time * 30) > 0 ? 2 : 0);
      ex.lock.visible = !ex.unlocked;
      ex.group.position.y = TILE_H + 0.045 + liftOf(ex.r, ex.c);
      ex.group.position.x = cellPos(ex.r, ex.c).x + (ex.reject > 0 ? Math.sin(time * 60) * 0.05 * ex.reject : 0);
      for (const nd of level.glyphs.nodes) {
        nd.pulse = Math.max(0, nd.pulse - dt * 1.5);
        nd.missed = Math.max(0, (nd.missed || 0) - dt);
        const base = nd.lit ? 1.4 : nd.onPath ? 0.95 : nd.alarm ? 1.1 : 0.5;
        const missFlash = nd.missed > 0 ? (Math.sin(time * 14) > 0 ? 1.6 : 0) : 0;
        nd.mat.emissiveIntensity = base + nd.pulse * 1.5 + missFlash;
        nd.mat.emissive.set(nd.alarm ? PALETTE.alarm : PALETTE.node);
        nd.grow = (nd.grow ?? 1) + ((nd.alarm ? 1.3 : 1) - (nd.grow ?? 1)) * Math.min(1, dt * 8);
        nd.mesh.scale.set(nd.grow, nd.grow * 1.35, nd.grow);
        nd.mesh.rotation.y += dt * (nd.lit ? 2.4 : 0.8) * Math.max(slow, 0.3);
        nd.mesh.position.y = TILE_H + 0.3 + (level.tiles[nd.r * level.board.cols + nd.c].lift) + Math.sin(time * 1.6 + nd.seed) * 0.04 * slow;
        if (nd.label) nd.label.position.y = nd.mesh.position.y + 0.42;
      }
      if (level.hint.mesh.visible) { level.hint.t = (level.hint.t || 0) + dt; level.hint.mat.opacity = 0.45 + Math.sin(level.hint.t * 6) * 0.35; }
      for (const tube of [level.trail, level.dashes]) if (tube) tube.material.uniforms.uTime.value = time;
      if (skin.hueShift) {
        liveAccent.setHSL((accentHSL.h + 0.09 * Math.sin(time * 1.3) + 1) % 1, accentHSL.s, accentHSL.l);
        if (level.trail) level.trail.material.uniforms.uColor.value.copy(liveAccent);
        level.pulse.halo.material.color.copy(liveAccent); level.pulse.light.color.copy(liveAccent);
        level.glyphs.source.mat.emissive.copy(liveAccent);
      }
      // Slight idle sway; none with Reduce Motion.
      boost += (boostTarget - boost) * Math.min(1, dt * (boostTarget > boost ? 12 : 3));
      if (bloomPass) bloomPass.strength = BLOOM_BASE + boost * BLOOM_SWELL;
      swayT += dt;
      placeCamera(camDistance, reducedMotion ? 0 : Math.sin(swayT * 0.35) * 0.012);
    }

    function render() {
      if (bloomOn && composer) composer.render(); else renderer.render(scene, camera);
    }

    return {
      mount() { api.ready = true; },
      update, fixedUpdate() {},
      pause() {}, resume() {},
      resize(size) {
        viewport = size;
        const pr = Math.min(size.pixelRatio || 1, 2);
        renderer.setPixelRatio(pr);
        renderer.setSize(Math.max(1, size.width), Math.max(1, size.height), false);
        if (composer) {
          composer.setPixelRatio?.(pr);
          composer.setSize(Math.max(1, size.width), Math.max(1, size.height));
          // Bloom at half resolution.
          bloomPass.setSize(Math.max(1, size.width * pr / 2), Math.max(1, size.height * pr / 2));
        }
        fitCamera();
      },
      render,
      dispose() {
        api.ready = false; api.canvas = null;
        disposeLevel();
        for (const d of disposables) d.dispose?.();
        composer?.renderTarget1?.dispose(); composer?.renderTarget2?.dispose(); bloomPass?.dispose?.();
        renderer.dispose(); renderer.domElement.remove();
      }
    };
  }

  return { factory, api };
}
