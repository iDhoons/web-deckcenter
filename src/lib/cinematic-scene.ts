import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Cinematic WebGL scene for the 데크센터 homepage — a dark, moody "product film" of
 * WPC(합성목재) products: spotlit hero pieces on a glossy floor, drifting dust in the
 * light, bloom, haze, dramatic camera moves. All procedural, no remote assets.
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

interface Quality { pixelRatio: number; antialias: boolean; shadowMapSize: number; bloom: boolean; label: string; }

function getQuality(): Quality {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
  if (isMobile || isLowEnd) {
    return { pixelRatio: Math.min(1.5, window.devicePixelRatio), antialias: false, shadowMapSize: 1024, bloom: !isMobile, label: 'balanced' };
  }
  return { pixelRatio: Math.min(2, window.devicePixelRatio), antialias: true, shadowMapSize: 2048, bloom: true, label: 'cinematic' };
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  if (x) {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,224,178,0.85)');
    g.addColorStop(0.6, 'rgba(255,196,128,0.3)');
    g.addColorStop(1, 'rgba(255,180,110,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Procedural WPC surface: uniform co-extruded grain, matte cap. */
function createWpcTexture(baseHex: number, grainHex: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.flipY = false;
    return fallback;
  }
  const base = new THREE.Color(baseHex);
  const grain = new THREE.Color(grainHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = `#${grain.getHexString()}`;
  for (let i = 0; i < 150; i++) {
    const y = Math.random() * 512;
    ctx.globalAlpha = 0.05 + Math.random() * 0.12;
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let px = 0; px <= 1024; px += 64) ctx.lineTo(px, y + (Math.random() - 0.5) * 2.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, 1024, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface Colorway { base: number; grain: number; }
const COLORWAYS: Colorway[] = [
  { base: 0xa06a3c, grain: 0x744a28 }, // teak
  { base: 0x5c3b28, grain: 0x3d2718 }, // walnut
  { base: 0x8f8d88, grain: 0x6d6b66 }, // gray
  { base: 0x6d4a32, grain: 0x49301f }, // coffee
];

function boardMaterial(cw: Colorway): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createWpcTexture(cw.base, cw.grain),
    roughness: 0.52,
    metalness: 0.06,
    envMapIntensity: 0.7,
    emissive: new THREE.Color(0x1a0f07),
    emissiveIntensity: 0.2,
    transparent: true,
  });
}

function makeBoard(cw: Colorway, lengthM: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.145, 0.03, lengthM);
  const mat = boardMaterial(cw);
  if (mat.map) mat.map.repeat.set(1, Math.max(2, lengthM * 0.7));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeDeckModule(cw: Colorway, boards = 7, lengthM = 2.4): THREE.Group {
  const g = new THREE.Group();
  const pitch = 0.145 + 0.02;
  const start = (-(boards - 1) * pitch) / 2;
  for (let i = 0; i < boards; i++) {
    const b = makeBoard(cw, lengthM);
    b.position.x = start + i * pitch;
    (b.material as THREE.MeshStandardMaterial).color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
    g.add(b);
  }
  return g;
}

function makeFencePanel(cw: Colorway): THREE.Group {
  const g = new THREE.Group();
  const mat = boardMaterial(cw);
  const post = new THREE.BoxGeometry(0.09, 1.5, 0.09);
  [-0.85, 0.85].forEach((x) => { const p = new THREE.Mesh(post, mat.clone()); p.position.x = x; p.castShadow = true; g.add(p); });
  const rail = new THREE.BoxGeometry(1.8, 0.08, 0.06);
  [0.62, -0.62].forEach((y) => { const r = new THREE.Mesh(rail, mat.clone()); r.position.y = y; r.castShadow = true; g.add(r); });
  const slat = new THREE.BoxGeometry(0.05, 1.15, 0.04);
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(slat, mat.clone()); s.position.x = -0.72 + i * 0.18; s.castShadow = true; g.add(s); }
  return g;
}

function makePergola(cw: Colorway): THREE.Group {
  const g = new THREE.Group();
  const mat = boardMaterial(cw);
  const post = new THREE.BoxGeometry(0.1, 1.7, 0.1);
  [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]].forEach(([x, z]) => { const p = new THREE.Mesh(post, mat.clone()); p.position.set(x, 0, z); p.castShadow = true; g.add(p); });
  const beam = new THREE.BoxGeometry(2.0, 0.1, 0.1);
  [-0.6, 0.6].forEach((z) => { const b = new THREE.Mesh(beam, mat.clone()); b.position.set(0, 0.85, z); b.castShadow = true; g.add(b); });
  const louver = new THREE.BoxGeometry(1.9, 0.14, 0.03);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(louver, mat.clone()); l.position.set(0, 0.9, -0.52 + i * 0.13); l.rotation.x = 0.5; l.castShadow = true; g.add(l); }
  return g;
}

interface Product { obj: THREE.Object3D; acts: number[]; home: THREE.Vector3; baseScale: number; spin: number; bob: number; phase: number; vis: number; target: number; continuous: boolean; }
interface CameraKey { pos: THREE.Vector3; look: THREE.Vector3; }

export function createCinematicScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }): CineController {
  const quality = getQuality();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bgColor = new THREE.Color(0x0f0c0a);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(0x0f0c0a, 0.05);

  // faint studio env for premium specular (kept low so the mood stays dark)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(3.5, 1.6, 6.5);

  // dramatic raking key + moody fills
  const key = new THREE.DirectionalLight(0xfff0d8, 3.4);
  key.position.set(4, 7, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ea8bf, 1.1);
  rim.position.set(-5, 2.5, -5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x2a2622, 0x0a0806, 0.35));
  const teal = new THREE.PointLight(0x14b8a6, 0.9, 14, 2); // brand accent bounce, kept behind so it grazes edges not text
  teal.position.set(-2.8, 0.8, -2.2);
  scene.add(teal);

  // dark glossy floor: reflects highlights, receives shadows → cinematic grounding
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.34, metalness: 0.6, envMapIntensity: 0.5 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.35;
  floor.receiveShadow = true;
  scene.add(floor);

  const GLOW = glowTexture();

  // subtle warm haze glow high behind the product (depth, not a hotspot — kept small,
  // dim and above the text zones so it never washes out body copy)
  const shaft = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffdcae, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.035 }));
    s.scale.setScalar(3.4 + i * 1.1);
    s.position.set(0.4 + i * 0.2, 2.9 - i * 0.35, -1.6 - i * 0.3);
    shaft.add(s);
  }
  scene.add(shaft);

  // drifting dust motes in the light
  const DUST = quality.label === 'balanced' ? 350 : 900;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSpd = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 18;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1;
    dustSpd[i] = 0.08 + Math.random() * 0.3;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.05, map: GLOW, color: 0xffdca8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  const world = new THREE.Group();
  scene.add(world);
  const products: Product[] = [];
  function add(obj: THREE.Object3D, acts: number[], home: THREE.Vector3, baseScale: number, spin: number, bob: number, continuous = false): void {
    obj.position.copy(home);
    obj.scale.setScalar(0.0001);
    obj.traverse((n) => { const m = n as THREE.Mesh; if (m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => { (mm as THREE.Material).transparent = true; (mm as THREE.Material).opacity = 0; }); } });
    world.add(obj);
    products.push({ obj, acts, home: home.clone(), baseScale, spin, bob, phase: Math.random() * Math.PI * 2, vis: 0, target: 0, continuous });
  }

  // Act 0 & 4 — large spotlit hero deck (teak), slow turntable
  const heroDeck = makeDeckModule(COLORWAYS[0], 8, 3.0);
  heroDeck.rotation.set(-0.28, 0.45, 0);
  add(heroDeck, [0, 4], new THREE.Vector3(0, 0, 0), 1.35, 0.22, 0.08, true);

  // Act 1 — colour lineup
  const cwGroup = new THREE.Group();
  [COLORWAYS[0], COLORWAYS[1], COLORWAYS[2]].forEach((cw, i) => {
    const b = makeBoard(cw, 2.4);
    b.position.set((i - 1) * 0.5, (i - 1) * -0.1, 0);
    b.rotation.set(-0.12, 0.32, (i - 1) * 0.06);
    b.scale.set(3.0, 3.0, 1);
    cwGroup.add(b);
  });
  add(cwGroup, [1], new THREE.Vector3(0, 0.1, 0), 1, 0.05, 0.08);

  // Act 2 — product family
  const deck2 = makeDeckModule(COLORWAYS[3], 6, 2.0); deck2.rotation.set(-0.32, 0.6, 0);
  add(deck2, [2], new THREE.Vector3(-1.9, -0.5, 0.5), 0.9, 0.1, 0.06);
  add(makeFencePanel(COLORWAYS[1]), [2], new THREE.Vector3(1.8, 0.1, -0.3), 0.9, 0.08, 0.05);
  add(makePergola(COLORWAYS[0]), [2], new THREE.Vector3(0.1, -0.1, -1.7), 0.85, 0.05, 0.05);

  // Act 3 — certified board, presentation turntable
  const certBoard = makeDeckModule(COLORWAYS[0], 6, 2.4); certBoard.rotation.set(-0.18, 0.4, 0);
  add(certBoard, [3], new THREE.Vector3(0, 0, 0.3), 1.2, 0.28, 0.07, true);

  const camKeys: CameraKey[] = [
    { pos: new THREE.Vector3(3.4, 1.5, 6.2), look: new THREE.Vector3(0, 0.15, 0) },
    { pos: new THREE.Vector3(1.9, 1.0, 4.0), look: new THREE.Vector3(0, 0.25, 0) },
    { pos: new THREE.Vector3(5.6, 3.4, 7.6), look: new THREE.Vector3(0, 0.1, -0.3) },
    { pos: new THREE.Vector3(2.6, 1.3, 5.0), look: new THREE.Vector3(0, 0.25, 0.2) },
    { pos: new THREE.Vector3(3.2, 1.8, 6.0), look: new THREE.Vector3(0, 0.05, 0) },
  ];

  // post-processing: bloom for cinematic highlights
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bloomPass: UnrealBloomPass | null = null;
  if (quality.bloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.48, 0.5, 0.86);
    composer.addPass(bloomPass);
  }
  composer.addPass(new OutputPass());

  const stats: CineStats = { loadedProducts: products.length, activeAct: 0, actCount: ACT_COUNT, mode: 'procedural-webgl', quality: quality.label };

  let progress = 0, targetProgress = 0, activeAct = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const clock = new THREE.Clock();
  let elapsed = 0, raf = 0, disposed = false;

  function onPointer(e: PointerEvent): void { mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2; mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2; }
  if (!opts.reducedMotion) window.addEventListener('pointermove', onPointer);

  function resize(): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomPass?.resolution.set(w, h);
  }
  resize();

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  function applyCamera(): void {
    const f = progress * (ACT_COUNT - 1);
    const i = Math.min(ACT_COUNT - 2, Math.floor(f));
    const t = f - i;
    const e = t * t * (3 - 2 * t);
    tmpPos.lerpVectors(camKeys[i].pos, camKeys[i + 1].pos, e);
    tmpLook.lerpVectors(camKeys[i].look, camKeys[i + 1].look, e);
    camera.position.copy(tmpPos);
    camera.position.x += mouse.x * 0.7;
    camera.position.y += -mouse.y * 0.4;
    camera.lookAt(tmpLook);
  }

  function applyVisibility(): void {
    for (const p of products) {
      const on = p.acts.includes(activeAct) ? 1 : 0;
      p.vis = on; p.target = on;
      p.obj.scale.setScalar(on ? p.baseScale : 0.0001);
      p.obj.traverse((n) => { const m = n as THREE.Mesh; if (m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => { (mm as THREE.Material).opacity = on; }); } });
    }
  }

  function frame(): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    progress = THREE.MathUtils.damp(progress, targetProgress, 4, dt);
    mouse.x = THREE.MathUtils.damp(mouse.x, mouse.tx, 6, dt);
    mouse.y = THREE.MathUtils.damp(mouse.y, mouse.ty, 6, dt);

    for (const p of products) {
      p.target = p.acts.includes(activeAct) ? 1 : 0;
      p.vis = THREE.MathUtils.damp(p.vis, p.target, 9, dt);
      if (p.vis < 0.002 && p.target < 0.5) p.vis = 0;
      const s = Math.max(0.0001, p.baseScale * p.vis);
      p.obj.scale.setScalar(s);
      p.obj.traverse((n) => { const m = n as THREE.Mesh; if (m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => { (mm as THREE.Material).opacity = Math.min(1, p.vis); }); } });
      if (p.vis > 0.01) {
        p.obj.position.y = p.home.y + Math.sin(elapsed * 0.6 + p.phase) * p.bob;
        if (p.continuous) p.obj.rotation.y += p.spin * dt;
        else p.obj.rotation.y = 0.45 + Math.sin(elapsed * 0.25 + p.phase) * 0.35;
      }
    }

    // atmosphere motion
    const pos = dustGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < DUST; i++) {
      pos[i * 3 + 1] += dustSpd[i] * dt;
      pos[i * 3] += Math.sin(elapsed * 0.15 + i) * 0.0016;
      if (pos[i * 3 + 1] > 5) pos[i * 3 + 1] = -5;
    }
    dustGeo.attributes.position.needsUpdate = true;
    shaft.children.forEach((s, i) => { s.position.x += Math.sin(elapsed * 0.2 + i) * 0.002; });
    teal.intensity = 0.85 + Math.sin(elapsed * 0.8) * 0.3;

    applyCamera();
    composer.render();
  }

  function renderStatic(): void { applyVisibility(); applyCamera(); composer.render(); }

  if (opts.reducedMotion) renderStatic();
  else frame();

  return {
    setProgress(p: number): void { targetProgress = Math.max(0, Math.min(1, p)); },
    setActiveAct(index: number): void {
      activeAct = Math.max(0, Math.min(ACT_COUNT - 1, index));
      stats.activeAct = activeAct;
      if (opts.reducedMotion) renderStatic();
    },
    resize,
    dispose(): void {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => { const sm = mm as THREE.MeshStandardMaterial; if (sm.map) sm.map.dispose(); mm.dispose(); }); }
      });
      GLOW.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      composer.dispose();
      scene.clear();
      renderer.dispose();
    },
    get stats(): CineStats { return stats; },
  };
}
