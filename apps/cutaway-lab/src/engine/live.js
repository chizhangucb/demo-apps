// The fixed Live runtime: builds a three.js object from a validated ModelSpec (data only, never code) and films it in
// the same near-white studio the official piranha uses (vendored stage.js). Parts open along their explode offsets on
// the same act windows as the official tours, then the whole object comes apart on a turntable and snaps back.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createStage} from '@/vendor/cutaway/sims/piranha-shared/stage.js';
import {liveStateAt} from '@/lib/modelspec';
import {createCallouts} from './callouts.js';

const FLOOR = -1.28;
const D2R = Math.PI / 180;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// the skill's palette: white clear-coated shells, green only as accents, dark mechanism, black lens glass, milky glass
function materials() {
  return {
    shell: new THREE.MeshPhysicalMaterial({color: '#f3f4f1', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12}),
    accent: new THREE.MeshPhysicalMaterial({color: '#17b865', roughness: 0.38, clearcoat: 0.6, emissive: '#0b7a40', emissiveIntensity: 0.25}),
    graphite: new THREE.MeshStandardMaterial({color: '#2b2e30', roughness: 0.55, metalness: 0.35}),
    black: new THREE.MeshPhysicalMaterial({color: '#0c0d0e', roughness: 0.25, clearcoat: 1}),
    steel: new THREE.MeshStandardMaterial({color: '#b8bdc1', roughness: 0.28, metalness: 1}),
    lens: new THREE.MeshPhysicalMaterial({color: '#050506', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02}),
    glass: new THREE.MeshPhysicalMaterial({color: '#f4faf7', roughness: 0.35, transmission: 0.85, thickness: 0.35, transparent: true, opacity: 0.85}),
  };
}

// unit shapes that fit a 1x1x1 box, scaled by each primitive's size
function geometries() {
  return {
    box: new RoundedBoxGeometry(1, 1, 1, 3, 0.08),
    sphere: new THREE.SphereGeometry(0.5, 40, 24),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 40),
    cone: new THREE.ConeGeometry(0.5, 1, 40),
    torus: new THREE.TorusGeometry(0.4, 0.1, 20, 56),
    capsule: new THREE.CapsuleGeometry(0.3, 0.4, 8, 24),
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} overlay
 * @param {{spec: object, film: object, idle: object, partTimeline: (act: string, tEvt: number) => object, lite?: boolean}} opts
 */
export function createLiveEngine(canvas, overlay, opts) {
  const {spec} = opts;
  const st = createStage({canvas, floorY: FLOOR, span: 3.8});
  if (opts.lite) st.setQuality({samples: 0, ao: false, shadow: 1024, floor: 'one', blur: 4});
  else st.setQuality({samples: 4, shadow: 2048});
  const M = materials();
  const G = geometries();
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const clear = [];
  const parts = spec.parts.map((p) => {
    const g = new THREE.Group();
    for (const pr of p.primitives) {
      const mesh = new THREE.Mesh(G[pr.shape], M[pr.material]);
      mesh.scale.set(...pr.size);
      mesh.position.set(...pr.pos);
      mesh.rotation.set(pr.rot[0] * D2R, pr.rot[1] * D2R, pr.rot[2] * D2R);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (pr.material === 'glass') clear.push(mesh);
      g.add(mesh);
    }
    model.add(g);
    return {spec: p, group: g, anchor: new THREE.Vector3(...p.anchor), explode: new THREE.Vector3(...p.explode)};
  });
  // fit: about 3.2 units across, centred over the floor, hovering a little like the official objects
  const box = new THREE.Box3().setFromObject(model);
  const ext = box.getSize(new THREE.Vector3());
  const k = 3.2 / Math.max(0.2, ext.x, ext.y, ext.z);
  model.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * k, -box.min.y * k + FLOOR + 0.35, -c.z * k);
  const centre = new THREE.Vector3(0, FLOOR + 0.35 + (ext.y * k) / 2, 0);
  st.addBody({root, clear, M: {lens: M.lens}});

  const size = {w: 1, h: 1};
  const setSize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    st.resize(w, h, pr);
  };
  let partKey = '';
  let partTL = null;
  const tlFor = (tt) => {
    if (tt.source === 'film') return opts.film;
    if (tt.source === 'idle') return opts.idle;
    const key = `${tt.act}@${tt.tEvt}`;
    if (key !== partKey) {
      partKey = key;
      partTL = opts.partTimeline(tt.act, tt.tEvt);
    }
    return partTL;
  };

  const callouts = createCallouts(overlay);
  const w = new THREE.Vector3();
  let cam = null;
  const render = (tt, now, held = 0) => {
    const s = liveStateAt(tlFor(tt), tt.t);
    const t = tt.t;
    root.rotation.y = (s.turn + 4 * Math.sin(t * 0.4)) * D2R;
    root.position.y = 0.05 * Math.sin(t * 1.1);
    let focus = null;
    let fk = 0;
    for (const p of parts) {
      const o = s.open[p.spec.id] ?? 0;
      if (o > fk) {
        fk = o;
        focus = p;
      }
      p.group.position.copy(p.explode).multiplyScalar(0.55 * o + s.explode);
      p.group.rotation.y = 0.35 * o * Math.sin(t * 0.8);
    }
    root.updateMatrixWorld(true);
    // camera: a front three-quarter orbit, pushing toward the open part, pulling wide for the explode
    let target = centre.clone();
    if (focus) {
      focus.group.localToWorld(w.copy(focus.anchor));
      target.lerp(w, 0.4 * fk);
    }
    const want = {az: (32 + 6 * Math.sin(t * 0.15) + 8 * Math.sin(held * 0.55)) * D2R, el: (14 - 6 * s.explode) * D2R, d: 10.5 * (1 - 0.18 * fk + 0.3 * s.explode), tx: target.x, ty: target.y, tz: target.z};
    // ease toward it so a click glides rather than cuts
    if (!cam) cam = want;
    else for (const f of Object.keys(want)) cam[f] += (want[f] - cam[f]) * 0.12;
    st.frame({...cam, sx: 0, sy: (size.h / 900) * 16}, {guides: 0.45 + 0.55 * Math.min(1, s.explode * 2.5 + fk)});
    // callouts: the open part, or every part while apart
    const show = s.explode > 0.3 ? parts : focus && fk > 0.3 ? [focus] : [];
    const items = [];
    for (const p of show) {
      p.group.localToWorld(w.copy(p.anchor));
      const at = st.project(w);
      if (at) items.push({x: at[0], y: at[1], name: p.spec.label, sub: p.spec.note});
    }
    callouts.draw(items, Math.max(sm((fk - 0.3) / 0.4), sm((s.explode - 0.3) / 0.4)), size.w, size.h);
    return {explode: s.explode};
  };

  const dispose = () => {
    callouts.dispose();
    Object.values(G).forEach((g) => g.dispose());
    Object.values(M).forEach((m) => m.dispose());
    st.composer.dispose?.();
    st.renderer.dispose();
    st.renderer.forceContextLoss();
  };
  return {setSize, render, dispose};
}
