// Mounts an official cutaway object into the lab's own canvas. Adapted from the upstream entries
// sims/*-shared/sim_green.js (commit 5d8f1c6): the same bodies, stages, tours, poses, green retint and camera maths,
// minus the standalone green HTML page, its cursor and its fixed 1600x900 layout. The tour reads whichever timeline the
// lab's player picks (idle, one part, or the official film) and render(t) stays a pure function of tour time.
import * as THREE from 'three';
import {createCallouts} from './callouts.js';
import {nice, niceSub, ORANGE_TO, PAPER_GREEN, retint} from '@/vendor/cutaway/sims/green/look.js';
import {PAL as PAL_P} from '@/vendor/cutaway/sims/piranha-shared/parts.js';
import {buildPiranha, FLOOR_Y as FLOOR_P} from '@/vendor/cutaway/sims/piranha-shared/piranha.js';
import {createStage as stageP, PAPER as PAPER_P} from '@/vendor/cutaway/sims/piranha-shared/stage.js';
import {makeBeeTour} from '@/vendor/cutaway/sims/piranha-shared/tour_bee.js';
import {PAL as PAL_T} from '@/vendor/cutaway/sims/tarantula-shared/parts.js';
import {buildSpider, FLOOR_Y as FLOOR_T} from '@/vendor/cutaway/sims/tarantula-shared/spider.js';
import {createStage as stageT, PAPER as PAPER_T} from '@/vendor/cutaway/sims/tarantula-shared/stage.js';
import {makeTour as makeSpiderTour, REACH as REACH_T} from '@/vendor/cutaway/sims/tarantula-shared/tour.js';
import {buildBee} from '@/vendor/cutaway/sims/wasp-shared/bee.js';
import {PAL as PAL_W} from '@/vendor/cutaway/sims/wasp-shared/parts.js';
import {createStage as stageW, PAPER as PAPER_W} from '@/vendor/cutaway/sims/wasp-shared/stage.js';
import {FLOOR_Y as FLOOR_W} from '@/vendor/cutaway/sims/wasp-shared/tour.js';
import {makeTour2, REACH as REACH_W} from '@/vendor/cutaway/sims/wasp-shared/tour_v2.js';

const D2R = Math.PI / 180;
const ZOOM = {piranha: 1.32, tarantula: 1.12, wasp: 1.3};
const SY = 10;

// the green look, as every sim_green.js sets it before building
for (const PAL of [PAL_P, PAL_T, PAL_W]) Object.assign(PAL, {orange: ORANGE_TO});
for (const PAPER of [PAPER_P, PAPER_T, PAPER_W]) Object.assign(PAPER, PAPER_GREEN);

const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ------------------------------------------------------------ one driver per object, each a port of its sim_green.js

function piranha(canvas, filmTL) {
  const st = stageP({canvas, floorY: FLOOR_P, span: 3.8});
  const fish = buildPiranha();
  fish.pose({t: 0, idle: 0});
  fish.root.updateMatrixWorld(true);
  const at = (k) => fish.anchorAt(k).toArray();
  const mid = (...ps) => ps.reduce((a, p) => a.map((v, i) => v + p[i] / ps.length), [0, 0, 0]);
  const A = {
    lens: at('lens'),
    eyeAxis: new THREE.Vector3(1, 0, 0).transformDirection(fish.anchors.lens.obj.matrixWorld).toArray(),
    finHub: at('finHub'),
    lureMid: mid(at('stalk'), at('joint'), at('bulb')),
    core: at('core'),
    jaw: at('jaw'),
  };
  st.addBody(fish);
  retint(fish.root);
  fish.root.rotation.order = 'YXZ';
  fish.root.scale.x = -1;
  const m = -1;
  // the film's push-ins apply to every timeline the lab plays, so a part click frames like the film does
  const PUSH = filmTL.push ?? 1;
  const OPT = filmTL.opt ?? 0.9;
  return {
    st,
    anchors: fish.anchors,
    makeTour: (TL) => {
      const T = makeBeeTour(TL, A);
      const SCR = [...TL.script].sort((a, b) => a.t - b.t);
      T.optWin = (t) => {
        let w = 0;
        SCR.forEach((e, i) => {
          if (e.act !== 'optics') return;
          const t1 = SCR[i + 1]?.t ?? TL.duration;
          w = Math.max(w, sm((t - e.t) / 0.85) * (1 - sm((t - t1) / 0.85)));
        });
        return w;
      };
      return T;
    },
    apply(T, t) {
      const s = T.stateAt(t);
      fish.pose({t, idle: 1, gape: s.gape, swim: s.swim, eye: s.eye, fin: s.fin, finFlip: s.finFlip, lure: s.lure, cage: s.cage, flare: s.flare, rib: s.rib, drop: s.drop, explode: s.explode, spinT: s.spinT, bend: s.bend});
      retint(fish.root);
      const f = s.flight;
      fish.root.position.set(m * f.pos.x, f.pos.y, f.pos.z);
      fish.root.rotation.set(f.roll * D2R, m * f.yaw * D2R, m * f.pitch * D2R);
      const c = s.cam;
      const cam = {...c, az: m * c.az * D2R, el: c.el * D2R, d: c.d * PUSH * (1 - (1 - OPT) * T.optWin(t)), tx: m * c.tx, sx: m * (c.sx ?? 0), sy: c.sy ?? 0};
      return {s, cam, guides: s.guides};
    },
  };
}

function tarantula(canvas) {
  const st = stageT({canvas, floorY: FLOOR_T, guides: {centre: [-0.3, 0.1, 0], scale: 1.3}});
  const sp = buildSpider();
  st.addBee(sp);
  retint(sp.root);
  sp.root.rotation.order = 'YXZ';
  return {
    st,
    anchors: sp.anchors,
    makeTour: (TL) => makeSpiderTour(TL),
    apply(T, t) {
      const s = T.stateAt(t);
      const b = s.body;
      sp.root.position.set(b.x, b.y, b.z);
      sp.root.rotation.set(b.roll, b.yaw + s.turn * D2R, b.pitch);
      sp.root.updateMatrixWorld(true);
      sp.pose({explode: s.explode, spinT: s.spinT, spinA: s.spinA, t, sub: s.sub, feet: s.feet, tuck: s.tuck, palp: s.palp, reach: REACH_T});
      retint(sp.root);
      const c = s.cam;
      return {s, cam: {...c, az: c.az * D2R, el: c.el * D2R, sx: c.sx ?? 0, sy: c.sy ?? 0}, guides: s.guides};
    },
  };
}

function wasp(canvas) {
  const st = stageW({canvas, floorY: FLOOR_W});
  const bee = buildBee();
  st.addBee(bee);
  retint(bee.root);
  bee.root.rotation.order = 'YXZ';
  return {
    st,
    anchors: bee.anchors,
    makeTour: (TL) => makeTour2(TL),
    apply(T, t) {
      const s = T.stateAt(t);
      bee.pose({explode: s.explode, flap: s.flap, flapAmp: s.amp, display: s.display, t: s.spinT, spinT: s.spinT, blur: 1, reach: REACH_W, sub: s.sub, eye: s.eye, wingOut: s.wingOut, wingFlip: s.wingFlip, legK: s.legK, stingK: s.stingK});
      retint(bee.root);
      const f = s.flight;
      bee.root.position.copy(f.pos);
      bee.root.rotation.set(f.roll * D2R, f.yaw * D2R, f.pitch * D2R);
      const c = s.cam;
      return {s, cam: {...c, az: c.az * D2R, el: c.el * D2R, sx: c.sx ?? 0, sy: c.sy ?? 0}, guides: s.guides};
    },
  };
}

const DRIVERS = {piranha, tarantula, wasp};

// ------------------------------------------------------------ the engine the React viewport talks to

/**
 * @param {string} id preset id
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} overlay a positioned element over the canvas for the part callouts
 * @param {{film: object, idle: object, partTimeline: (act: string, tEvt: number) => object, lite?: boolean}} opts
 */
export function createOfficialEngine(id, canvas, overlay, opts) {
  const drv = DRIVERS[id](canvas, opts.film);
  const {st} = drv;
  if (opts.lite) st.setQuality({samples: 0, ao: false, shadow: 1024, floor: 'one', blur: 4});
  else st.setQuality({samples: 4, shadow: 2048});
  const tours = {idle: drv.makeTour(opts.idle), film: drv.makeTour(opts.film)};
  let partKey = '';
  let partTour = null;
  const tourFor = (tt) => {
    if (tt.source !== 'part') return tours[tt.source];
    const key = `${tt.act}@${tt.tEvt.toFixed(3)}`;
    if (key !== partKey) {
      partKey = key;
      partTour = drv.makeTour(opts.partTimeline(tt.act, tt.tEvt));
    }
    return partTour;
  };

  const size = {w: 1, h: 1};
  const setSize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    st.resize(w, h, pr);
  };

  // camera blend whenever the source timeline changes (idle to part, film to idle), so a click never cuts hard
  let lastKey = '';
  let lastCam = null;
  let blend = null;
  const BLEND = 0.9;
  const mix = (a, b, k) => {
    const out = {...b};
    for (const f of ['el', 'd', 'tx', 'ty', 'tz', 'sx', 'sy']) out[f] = a[f] + (b[f] - a[f]) * k;
    let dAz = b.az - a.az;
    dAz = ((((dAz + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    out.az = a.az + dAz * k;
    return out;
  };

  const callouts = createCallouts(overlay);
  const p = new THREE.Vector3();
  const drawLabels = (labelSet) => {
    const {set = [], o = 0} = labelSet ?? {};
    const items = [];
    if (o > 0.02) {
      for (const [key, name, sub] of set) {
        const A = drv.anchors[key];
        if (!A) continue;
        let w;
        if (typeof A === 'function') w = A();
        else {
          A.obj.updateWorldMatrix(true, false);
          w = A.obj.localToWorld(p.copy(A.at));
        }
        const at = st.project(w);
        if (at) items.push({x: at[0], y: at[1], name: nice(name), sub: niceSub(sub)});
      }
    }
    callouts.draw(items, o, size.w, size.h);
  };

  /**
   * Draw one frame. tt = {source, t, act?, tEvt?} from the player; now = wall clock seconds; held = seconds a part
   * has been held open (a slow orbit so the hold never parks).
   */
  const render = (tt, now, held = 0) => {
    const T = tourFor(tt);
    const {s, cam: c0, guides} = drv.apply(T, tt.t);
    const key = tt.source === 'part' ? `part:${tt.act}:${tt.tEvt}` : tt.source;
    if (key !== lastKey) {
      if (lastCam) blend = {from: lastCam, t0: now};
      lastKey = key;
    }
    let cam = {...c0};
    if (held > 0) cam.az += 0.16 * Math.sin(held * 0.55);
    if (blend) {
      const k = sm((now - blend.t0) / BLEND);
      if (k >= 1) blend = null;
      else cam = mix(blend.from, cam, k);
    }
    lastCam = cam;
    // the upstream cameras were framed on a 1600x900 page; screen shifts scale with the canvas height
    // and they filled a 1070x600 window; the lab's studio keeps a title above and controls below, so it pulls back
    const k = size.h / 900;
    st.frame({...cam, d: cam.d * ZOOM[id], sx: cam.sx * k, sy: (cam.sy + SY) * k}, {guides});
    let labelSet = null;
    try {
      labelSet = T.telemetry(tt.t, s).labelSet;
    } catch {
      labelSet = null;
    }
    drawLabels(labelSet);
    return {view: s.view, explode: s.explode ?? 0};
  };

  const dispose = () => {
    callouts.dispose();
    st.scene.traverse((o) => {
      o.geometry?.dispose?.();
      for (const mt of [].concat(o.material || [])) mt.dispose?.();
    });
    st.composer.dispose?.();
    st.renderer.dispose();
    st.renderer.forceContextLoss();
  };

  return {setSize, render, dispose};
}
