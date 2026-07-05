import * as THREE from 'three';

/**
 * Cinematic WebGL scene for the 데크센터 homepage — an all-procedural WPC(합성목재)
 * product studio. No remote assets: geometry + canvas-generated wood-grain textures only.
 * The Astro island (CinematicStage.astro) owns the lifecycle and feeds scroll state in.
 */

export interface CineStats {
  loadedProducts: number;
  activeAct: number;
  actCount: number;
  mode: 'procedural-webgl';
  quality: string;
}

export interface CineController {
  setProgress(p: number): void;
  setActiveAct(index: number): void;
  resize(): void;
  dispose(): void;
  readonly stats: CineStats;
}

export const ACT_COUNT = 5;

interface Quality {
  pixelRatio: number;
  antialias: boolean;
  shadowMapSize: number;
  shadow: boolean;
  label: string;
}

function getQuality(): Quality {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
  if (isMobile || isLowEnd) {
    return { pixelRatio: Math.min(1.5, window.devicePixelRatio), antialias: false, shadowMapSize: 1024, shadow: true, label: 'balanced' };
  }
  return { pixelRatio: Math.min(2, window.devicePixelRatio), antialias: true, shadowMapSize: 2048, shadow: true, label: 'studio' };
}

/** Procedural WPC surface: more uniform / matte / capped than natural timber. */
function createWpcTexture(baseHex: number, grainHex: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const base = new THREE.Color(baseHex);
  const grain = new THREE.Color(grainHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 1024, 512);

  // long, mostly-straight co-extruded grain streaks (subtle)
  ctx.strokeStyle = `#${grain.getHexString()}`;
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * 512;
    ctx.globalAlpha = 0.04 + Math.random() * 0.10;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 2.2);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // faint brushed micro-noise (matte cap look)
  const img = ctx.getImageData(0, 0, 1024, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface Colorway { base: number; grain: number; name: string; }
const COLORWAYS: Colorway[] = [
  { base: 0x9c6b3f, grain: 0x7a4f2c, name: 'teak' },
  { base: 0x5b3d2b, grain: 0x3f2a1d, name: 'walnut' },
  { base: 0x8d8b86, grain: 0x6f6d68, name: 'gray' },
  { base: 0x6b4a34, grain: 0x4b3222, name: 'coffee' },
];

function boardMaterial(cw: Colorway): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createWpcTexture(cw.base, cw.grain),
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.35,
    transparent: true,
  });
}

/** A single WPC deck board (rectangular plank, grain along its length). */
function makeBoard(cw: Colorway, lengthM: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.145, 0.028, lengthM);
  const mat = boardMaterial(cw);
  if (mat.map) mat.map.repeat.set(1, Math.max(2, lengthM * 0.7));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A run of parallel deck boards with the domain-standard gap — the signature product. */
function makeDeckModule(cw: Colorway, boards = 7, lengthM = 2.4): THREE.Group {
  const g = new THREE.Group();
  const width = 0.145;
  const gap = 0.02;
  const pitch = width + gap;
  const start = (-(boards - 1) * pitch) / 2;
  for (let i = 0; i < boards; i++) {
    const b = makeBoard(cw, lengthM);
    b.position.x = start + i * pitch;
    b.position.y = (Math.random() - 0.5) * 0.004;
    const m = b.material as THREE.MeshStandardMaterial;
    m.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
    g.add(b);
  }
  return g;
}

/** WPC fence / 난간 panel: two posts + horizontal rails + vertical slats. */
function makeFencePanel(cw: Colorway): THREE.Group {
  const g = new THREE.Group();
  const mat = boardMaterial(cw);
  const post = new THREE.BoxGeometry(0.09, 1.5, 0.09);
  [-0.85, 0.85].forEach((x) => {
    const p = new THREE.Mesh(post, mat.clone());
    p.position.set(x, 0, 0);
    p.castShadow = true;
    g.add(p);
  });
  const rail = new THREE.BoxGeometry(1.8, 0.08, 0.06);
  [0.62, -0.62].forEach((y) => {
    const r = new THREE.Mesh(rail, mat.clone());
    r.position.set(0, y, 0);
    r.castShadow = true;
    g.add(r);
  });
  const slat = new THREE.BoxGeometry(0.05, 1.15, 0.04);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(slat, mat.clone());
    s.position.set(-0.72 + i * 0.18, 0, 0);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

/** WPC pergola / 파고라 louver frame: 4 posts + top louver blades. */
function makePergola(cw: Colorway): THREE.Group {
  const g = new THREE.Group();
  const mat = boardMaterial(cw);
  const post = new THREE.BoxGeometry(0.1, 1.7, 0.1);
  [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]].forEach(([x, z]) => {
    const p = new THREE.Mesh(post, mat.clone());
    p.position.set(x, 0, z);
    p.castShadow = true;
    g.add(p);
  });
  const beam = new THREE.BoxGeometry(2.0, 0.1, 0.1);
  [-0.6, 0.6].forEach((z) => {
    const b = new THREE.Mesh(beam, mat.clone());
    b.position.set(0, 0.85, z);
    b.castShadow = true;
    g.add(b);
  });
  const louver = new THREE.BoxGeometry(1.9, 0.14, 0.03);
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(louver, mat.clone());
    l.position.set(0, 0.9, -0.52 + i * 0.13);
    l.rotation.x = 0.5;
    l.castShadow = true;
    g.add(l);
  }
  return g;
}

interface Product {
  obj: THREE.Object3D;
  acts: number[];
  home: THREE.Vector3;
  baseScale: number;
  spin: number;
  bob: number;
  phase: number;
  vis: number;      // current visibility 0..1
  target: number;   // target visibility 0..1
}

interface CameraKey { pos: THREE.Vector3; look: THREE.Vector3; }

export function createCinematicScene(
  canvas: HTMLCanvasElement,
  opts: { reducedMotion: boolean },
): CineController {
  const quality = getQuality();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, alpha: false });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = quality.shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(0xedefee);
  scene.background = bg;
  scene.fog = new THREE.Fog(0xedefee, 12, 34);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(4.6, 3.4, 7.4);

  // bright studio lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.85));
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.1);
  sun.position.set(6, 10, 6);
  sun.castShadow = quality.shadow;
  if (quality.shadow) {
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fb8c4, 0.5);
  fill.position.set(-6, 3, -4);
  scene.add(fill);
  const accent = new THREE.PointLight(0x14b8a6, 0.35, 20, 2); // subtle brand teal bounce
  accent.position.set(-2, 1.5, 3);
  scene.add(accent);

  // soft shadow-catching ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.12 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const world = new THREE.Group();
  scene.add(world);

  const products: Product[] = [];
  function add(obj: THREE.Object3D, acts: number[], home: THREE.Vector3, baseScale: number, spin: number, bob: number): void {
    obj.position.copy(home);
    obj.scale.setScalar(0.0001);
    obj.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => { (m as THREE.Material).transparent = true; (m as THREE.Material).opacity = 0; });
      }
    });
    world.add(obj);
    products.push({ obj, acts, home: home.clone(), baseScale, spin, bob, phase: Math.random() * Math.PI * 2, vis: 0, target: 0 });
  }

  // Act 0 & 4 — the hero deck module (teak)
  const heroDeck = makeDeckModule(COLORWAYS[0], 7, 2.6);
  heroDeck.rotation.set(-0.32, 0.5, 0);
  add(heroDeck, [0, 4], new THREE.Vector3(0, 0, 0), 1, 0.12, 0.05);

  // Act 1 — colour lineup (three colourways fanned)
  const cwGroup = new THREE.Group();
  [COLORWAYS[0], COLORWAYS[1], COLORWAYS[2]].forEach((cw, i) => {
    const b = makeBoard(cw, 2.2);
    b.position.set((i - 1) * 0.42, (i - 1) * -0.08, 0);
    b.rotation.set(-0.15, 0.35, (i - 1) * 0.05);
    b.scale.set(2.4, 2.4, 1);
    cwGroup.add(b);
  });
  add(cwGroup, [1], new THREE.Vector3(0, 0.1, 0), 1, 0.06, 0.06);

  // Act 2 — product family (deck + fence + pergola spread in depth)
  const deck2 = makeDeckModule(COLORWAYS[3], 6, 2.0);
  deck2.rotation.set(-0.34, 0.6, 0);
  add(deck2, [2], new THREE.Vector3(-1.9, -0.5, 0.6), 0.9, 0.1, 0.05);
  const fence = makeFencePanel(COLORWAYS[1]);
  add(fence, [2], new THREE.Vector3(1.7, 0.1, -0.4), 0.85, 0.08, 0.04);
  const pergola = makePergola(COLORWAYS[0]);
  add(pergola, [2], new THREE.Vector3(0.1, -0.1, -1.8), 0.8, 0.05, 0.04);

  // Act 3 — a single pristine certified board, slow presentation spin
  const certBoard = makeDeckModule(COLORWAYS[0], 5, 2.2);
  certBoard.rotation.set(-0.2, 0.4, 0);
  add(certBoard, [3], new THREE.Vector3(0, 0, 0.4), 1.05, 0.16, 0.05);

  // camera choreography per act
  const camKeys: CameraKey[] = [
    { pos: new THREE.Vector3(4.6, 3.4, 7.4), look: new THREE.Vector3(0, 0, 0) },      // hero
    { pos: new THREE.Vector3(2.6, 1.9, 5.2), look: new THREE.Vector3(0, 0.2, 0) },    // material close
    { pos: new THREE.Vector3(6.2, 4.4, 8.6), look: new THREE.Vector3(0, 0.1, -0.4) },// product family wide
    { pos: new THREE.Vector3(3.4, 2.4, 6.2), look: new THREE.Vector3(0, 0.2, 0.3) }, // certification
    { pos: new THREE.Vector3(4.4, 3.2, 7.2), look: new THREE.Vector3(0, 0, 0) },      // finale
  ];

  const stats: CineStats = { loadedProducts: products.length, activeAct: 0, actCount: ACT_COUNT, mode: 'procedural-webgl', quality: quality.label };

  let progress = 0;
  let targetProgress = 0;
  let activeAct = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const clock = new THREE.Clock();
  let elapsed = 0;
  let raf = 0;
  let disposed = false;

  function onPointer(e: PointerEvent): void {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  if (!opts.reducedMotion) window.addEventListener('pointermove', onPointer);

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function applyCamera(): void {
    const f = progress * (ACT_COUNT - 1);
    const i = Math.min(ACT_COUNT - 2, Math.floor(f));
    const t = f - i;
    const ease = t * t * (3 - 2 * t);
    tmpPos.lerpVectors(camKeys[i].pos, camKeys[i + 1].pos, ease);
    tmpLook.lerpVectors(camKeys[i].look, camKeys[i + 1].look, ease);
    camera.position.copy(tmpPos);
    camera.position.x += mouse.x * 0.6;
    camera.position.y += -mouse.y * 0.35;
    camera.lookAt(tmpLook);
  }

  function renderOnce(): void {
    products.forEach((p) => {
      const on = p.acts.includes(activeAct) ? 1 : 0;
      p.vis = on;
      p.obj.scale.setScalar(on ? p.baseScale : 0.0001);
      p.obj.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => { (m as THREE.Material).opacity = on; });
        }
      });
    });
    applyCamera();
    renderer.render(scene, camera);
  }

  function frame(): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    // framerate-independent damping (so fades complete on slow GPUs too)
    progress = THREE.MathUtils.damp(progress, targetProgress, 4, dt);
    mouse.x = THREE.MathUtils.damp(mouse.x, mouse.tx, 6, dt);
    mouse.y = THREE.MathUtils.damp(mouse.y, mouse.ty, 6, dt);

    for (const p of products) {
      p.target = p.acts.includes(activeAct) ? 1 : 0;
      p.vis = THREE.MathUtils.damp(p.vis, p.target, 9, dt);
      if (p.vis < 0.002) p.vis = p.target < 0.5 ? 0 : p.vis;
      const s = Math.max(0.0001, p.baseScale * p.vis);
      p.obj.scale.setScalar(s);
      p.obj.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => { (m as THREE.Material).opacity = Math.min(1, p.vis); });
        }
      });
      if (p.vis > 0.01) {
        p.obj.position.y = p.home.y + Math.sin(elapsed * 0.7 + p.phase) * p.bob;
        p.obj.rotation.y += p.spin * dt;
      }
    }

    applyCamera();
    renderer.render(scene, camera);
  }

  if (opts.reducedMotion) {
    activeAct = 0;
    renderOnce();
  } else {
    frame();
  }

  return {
    setProgress(p: number): void { targetProgress = Math.max(0, Math.min(1, p)); },
    setActiveAct(index: number): void {
      activeAct = Math.max(0, Math.min(ACT_COUNT - 1, index));
      stats.activeAct = activeAct;
      if (opts.reducedMotion) renderOnce();
    },
    resize,
    dispose(): void {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const sm = m as THREE.MeshStandardMaterial;
            if (sm.map) sm.map.dispose();
            m.dispose();
          });
        }
      });
      scene.clear();
      renderer.dispose();
    },
    get stats(): CineStats { return stats; },
  };
}
