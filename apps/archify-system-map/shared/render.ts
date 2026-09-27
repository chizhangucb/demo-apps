// Thin Archify-style viewer: compiles a validated architecture IR into one
// self-contained HTML document (inline SVG + CSS + a small runtime for focus,
// guided views, theme, trace motion, zoom/pan and present mode).
// Visual language follows tt-a1i/archify (MIT); this is not the official renderer.
import type { ArchitectureIR, Component, Connection, Point, Side } from './archify.js'

const DEFAULT_SIZE: Point = [150, 64]
const MARGIN = 28

export interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Resolves every component to an absolute box: explicit pos, grid row/col, or auto layered layout. */
export function layoutComponents(ir: ArchitectureIR): Map<string, Box> {
  const boxes = new Map<string, Box>()
  const g = ir.layout
  const cellW = g?.cellW ?? 170
  const cellH = g?.cellH ?? 80
  const gapX = g?.gapX ?? 70
  const gapY = g?.gapY ?? 60
  const [ox, oy] = g?.origin ?? [60, 90]

  const unplaced: Component[] = []
  for (const c of ir.components) {
    const [w, h] = c.size ?? DEFAULT_SIZE
    if (c.pos) boxes.set(c.id, { id: c.id, x: c.pos[0], y: c.pos[1], w, h })
    else if (c.row !== undefined && c.col !== undefined)
      boxes.set(c.id, { id: c.id, x: ox + c.col * (cellW + gapX), y: oy + c.row * (cellH + gapY), w, h })
    else unplaced.push(c)
  }
  if (!unplaced.length) return boxes

  // Longest-path layering over the connection graph (cycle-safe).
  const ids = new Set(unplaced.map((c) => c.id))
  const edges = (ir.connections ?? []).filter((e) => ids.has(e.from) && ids.has(e.to))
  const rank = new Map<string, number>(unplaced.map((c) => [c.id, 0]))
  for (let pass = 0; pass < unplaced.length; pass++) {
    let changed = false
    for (const e of edges) {
      const next = (rank.get(e.from) ?? 0) + 1
      if (next > (rank.get(e.to) ?? 0) && next < unplaced.length) {
        rank.set(e.to, next)
        changed = true
      }
    }
    if (!changed) break
  }
  const columns = new Map<number, Component[]>()
  for (const c of unplaced) {
    const r = rank.get(c.id) ?? 0
    columns.set(r, [...(columns.get(r) ?? []), c])
  }
  const tallest = Math.max(...[...columns.values()].map((col) => col.length))
  for (const [r, col] of columns) {
    const offset = ((tallest - col.length) * (cellH + gapY)) / 2
    col.forEach((c, i) => {
      const [w, h] = c.size ?? DEFAULT_SIZE
      boxes.set(c.id, { id: c.id, x: ox + r * (cellW + gapX), y: oy + offset + i * (cellH + gapY), w, h })
    })
  }
  return boxes
}

function anchor(b: Box, side: Side): Point {
  switch (side) {
    case 'left':
      return [b.x, b.y + b.h / 2]
    case 'right':
      return [b.x + b.w, b.y + b.h / 2]
    case 'top':
      return [b.x + b.w / 2, b.y]
    case 'bottom':
      return [b.x + b.w / 2, b.y + b.h]
  }
}

function autoSides(a: Box, b: Box): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2)
  const dy = b.y + b.h / 2 - (a.y + a.h / 2)
  const horizontalGap = dx > 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w)
  if (horizontalGap > 20 || Math.abs(dx) > Math.abs(dy) * 1.2) return dx >= 0 ? ['right', 'left'] : ['left', 'right']
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']
}

const horizontal = (s: Side) => s === 'left' || s === 'right'

/** Orthogonal route between two boxes; honours explicit sides and via points. */
export function routeConnection(c: Connection, a: Box, b: Box): Point[] {
  const [fs, ts] = autoSides(a, b)
  const fromSide = c.fromSide ?? fs
  const toSide = c.toSide ?? ts
  const p0 = anchor(a, fromSide)
  const p1 = anchor(b, toSide)
  if (c.via?.length) return [p0, ...c.via, p1]
  if (horizontal(fromSide) && horizontal(toSide)) {
    if (Math.abs(p0[1] - p1[1]) < 1) return [p0, p1]
    const mx = (p0[0] + p1[0]) / 2
    return [p0, [mx, p0[1]], [mx, p1[1]], p1]
  }
  if (!horizontal(fromSide) && !horizontal(toSide)) {
    if (Math.abs(p0[0] - p1[0]) < 1) return [p0, p1]
    const my = (p0[1] + p1[1]) / 2
    return [p0, [p0[0], my], [p1[0], my], p1]
  }
  return horizontal(fromSide) ? [p0, [p1[0], p0[1]], p1] : [p0, [p0[0], p1[1]], p1]
}

function labelPoint(points: Point[], c: Connection): Point {
  if (c.labelAt) return c.labelAt
  let best = 0
  let bestLen = -1
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1])
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const [x0, y0] = points[best]
  const [x1, y1] = points[best + 1]
  return [(x0 + x1) / 2 + (c.labelDx ?? 0), (y0 + y1) / 2 + (c.labelDy ?? 0)]
}

const TYPE_LABEL: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend / service',
  database: 'Data store',
  cloud: 'Cloud / infra',
  security: 'Security',
  messagebus: 'Message bus',
  external: 'External',
}

export interface RenderOptions {
  theme?: 'dark' | 'light'
}

export function renderArchitectureHtml(ir: ArchitectureIR, opts: RenderOptions = {}): string {
  const boxes = layoutComponents(ir)
  const connections = ir.connections ?? []

  // Boundaries first so they can grow the canvas.
  const boundaryRects = (ir.boundaries ?? []).map((b, i) => {
    const members = b.wraps.map((id) => boxes.get(id)).filter((x): x is Box => !!x)
    const pad = b.pad ?? (b.kind === 'region' ? 28 : 14)
    const top = b.kind === 'region' ? 26 : 20
    const x = Math.min(...members.map((m) => m.x)) - pad
    const y = Math.min(...members.map((m) => m.y)) - pad - top
    const r = Math.max(...members.map((m) => m.x + m.w)) + pad
    const btm = Math.max(...members.map((m) => m.y + m.h)) + pad
    return { ...b, i, x, y, w: r - x, h: btm - y }
  })

  const routes = connections.map((c) => {
    const a = boxes.get(c.from)!
    const b = boxes.get(c.to)!
    const pts = routeConnection(c, a, b)
    return { c, pts, lp: labelPoint(pts, c) }
  })

  const all = [
    ...[...boxes.values()].flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y + b.h]] as Point[]),
    ...boundaryRects.flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y + b.h]] as Point[]),
    ...routes.flatMap((r) => r.pts),
  ]
  const minX = Math.min(...all.map((p) => p[0])) - MARGIN
  const minY = Math.min(...all.map((p) => p[1])) - MARGIN
  const maxX = Math.max(...all.map((p) => p[0])) + MARGIN
  const maxY = Math.max(...all.map((p) => p[1])) + MARGIN
  const vb = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`

  const boundarySvg = boundaryRects
    .map(
      (b) => `<g class="boundary ${b.kind}" data-wraps="${esc(b.wraps.join(' '))}">
  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.kind === 'region' ? 18 : 12}"/>
  <text x="${b.x + 14}" y="${b.y + 19}">${esc(b.label)}</text>
</g>`,
    )
    .join('\n')

  const edgeSvg = routes
    .map(({ c, pts, lp }, i) => {
      const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')
      const variant = c.variant ?? 'default'
      const label = c.label
        ? `<g class="edge-label" transform="translate(${lp[0]} ${lp[1]})"><rect x="${-(c.label.length * 3.7 + 9)}" y="-11" width="${c.label.length * 7.4 + 18}" height="22" rx="11"/><text y="4">${esc(c.label)}</text></g>`
        : ''
      return `<g class="edge ${variant}" data-edge="${i}" data-from="${esc(c.from)}" data-to="${esc(c.to)}">
  <path class="hit" d="${d}"/><path class="line" d="${d}" marker-end="url(#arrow-${variant})"/>${label}
</g>`
    })
    .join('\n')

  const nodeSvg = ir.components
    .map((c) => {
      const b = boxes.get(c.id)!
      const cx = b.x + b.w / 2
      const hasSub = !!c.sublabel
      const tag = c.tag
        ? `<g class="tag"><rect x="${cx - (c.tag.length * 3.4 + 8)}" y="${b.y + b.h - 10}" width="${c.tag.length * 6.8 + 16}" height="20" rx="10"/><text x="${cx}" y="${b.y + b.h + 4}">${esc(c.tag)}</text></g>`
        : ''
      return `<g class="node t-${c.type}" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(`${c.label}${c.sublabel ? ', ' + c.sublabel : ''}`)}">
  <rect class="body" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12"/>
  <rect class="stripe" x="${b.x}" y="${b.y + 12}" width="4" height="${b.h - 24}" rx="2"/>
  <text class="label" x="${cx}" y="${b.y + b.h / 2 + (hasSub ? -4 : 5)}">${esc(c.label)}</text>
  ${hasSub ? `<text class="sublabel" x="${cx}" y="${b.y + b.h / 2 + 16}">${esc(c.sublabel!)}</text>` : ''}
  ${tag}
</g>`
    })
    .join('\n')

  const usedTypes = [...new Set(ir.components.map((c) => c.type))]
  const legend = usedTypes
    .map((t) => `<span class="legend-item"><i class="sw t-${t}"></i>${TYPE_LABEL[t]}</span>`)
    .join('')

  const views = ir.meta.views ?? []
  const viewButtons = views
    .map((v, i) => `<button class="view" data-view="${i}" title="${esc(v.note ?? '')}">${i + 1}. ${esc(v.label)}</button>`)
    .join('')

  const cards = (ir.cards ?? [])
    .map(
      (c) =>
        `<section class="card"><h3><i class="dot d-${c.dot}"></i>${esc(c.title)}</h3><ul>${c.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul></section>`,
    )
    .join('')

  const data = {
    nodes: Object.fromEntries(
      ir.components.map((c) => [c.id, { label: c.label, sublabel: c.sublabel ?? '', tag: c.tag ?? '', type: TYPE_LABEL[c.type] }]),
    ),
    edges: connections.map((c) => ({ from: c.from, to: c.to, label: c.label ?? '' })),
    views,
    viewBox: [minX, minY, maxX - minX, maxY - minY],
    trace: ir.meta.animation === 'trace',
  }

  const arrowDefs = ['default', 'emphasis', 'security', 'dashed']
    .map(
      (v) =>
        `<marker id="arrow-${v}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrow ${v}"/></marker>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en" data-theme="${opts.theme ?? 'dark'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="generator" content="archify-system-map thin viewer (Archify IR v1)"/>
<title>${esc(ir.meta.title)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="titles">
    <div class="eyebrow">Archify · architecture</div>
    <h1>${esc(ir.meta.title)}</h1>
    ${ir.meta.subtitle ? `<p class="subtitle">${esc(ir.meta.subtitle)}</p>` : ''}
  </div>
  <div class="toolbar">
    <button id="trace" aria-pressed="${data.trace}">Trace</button>
    <button id="theme">Theme</button>
    <button id="fit">Fit</button>
    <button id="present">Present</button>
  </div>
</header>
${views.length ? `<nav class="views"><button class="view active" data-view="-1">Overview</button>${viewButtons}</nav>` : ''}
<main>
  <div class="stage">
    <svg id="map" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(ir.meta.title)}">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0 L0 0 0 24" class="gridline"/></pattern>
        ${arrowDefs}
      </defs>
      <rect class="bg" x="${minX - 2000}" y="${minY - 2000}" width="${maxX - minX + 4000}" height="${maxY - minY + 4000}" fill="url(#grid)"/>
      <g id="boundaries">${boundarySvg}</g>
      <g id="edges">${edgeSvg}</g>
      <g id="nodes">${nodeSvg}</g>
    </svg>
    <aside id="inspector" hidden></aside>
    <div id="note" hidden></div>
  </div>
  <div class="legend">${legend}<span class="hint">Click a node to focus · scroll to zoom · drag to pan · ←/→ step views</span></div>
  ${cards ? `<div class="cards">${cards}</div>` : ''}
</main>
<script>window.__ARCHIFY__=${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
<script>${RUNTIME}</script>
</body>
</html>`
}

const CSS = `
:root{--bg:#0b1020;--panel:#111831;--ink:#e6ebff;--muted:#8d97b8;--line:#5b6a99;--grid:rgba(148,163,255,.07);--node:#151d38;--edge-bg:#0b1020;--region:rgba(96,165,250,.05);--region-stroke:rgba(96,165,250,.45);--sg:rgba(251,113,133,.05);--sg-stroke:rgba(251,113,133,.55);
--frontend:#22d3ee;--backend:#34d399;--database:#a78bfa;--cloud:#fbbf24;--security:#fb7185;--messagebus:#fb923c;--external:#94a3b8;--emphasis:#38bdf8;--font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif;--mono:ui-monospace,"JetBrains Mono",SFMono-Regular,Menlo,monospace}
[data-theme=light]{--bg:#f7f8fc;--panel:#fff;--ink:#101528;--muted:#5d6784;--line:#8390b5;--grid:rgba(30,41,90,.06);--node:#fff;--edge-bg:#f7f8fc;--region:rgba(37,99,235,.04);--region-stroke:rgba(37,99,235,.4);--sg:rgba(225,29,72,.04);--sg-stroke:rgba(225,29,72,.5);
--frontend:#0891b2;--backend:#059669;--database:#7c3aed;--cloud:#d97706;--security:#e11d48;--messagebus:#ea580c;--external:#64748b;--emphasis:#0284c7}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--font)}
body{display:flex;flex-direction:column;min-height:100vh}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:18px 24px 10px;flex-wrap:wrap}
.eyebrow{font:600 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h1{margin:6px 0 0;font-size:22px;letter-spacing:-.01em}
.subtitle{margin:4px 0 0;color:var(--muted);font-size:13px}
.toolbar{display:flex;gap:6px}
button{font:500 12px var(--font);color:var(--ink);background:var(--panel);border:1px solid color-mix(in srgb,var(--line) 45%,transparent);border-radius:8px;padding:6px 10px;cursor:pointer}
button:hover{border-color:var(--emphasis)}
button[aria-pressed=true],.view.active{background:color-mix(in srgb,var(--emphasis) 18%,var(--panel));border-color:var(--emphasis)}
.views{display:flex;gap:6px;padding:0 24px 8px;flex-wrap:wrap}
main{flex:1;display:flex;flex-direction:column;padding:0 24px 20px;gap:10px;min-height:0}
.stage{position:relative;flex:1;min-height:340px;border:1px solid color-mix(in srgb,var(--line) 30%,transparent);border-radius:14px;overflow:hidden;background:var(--bg)}
svg{width:100%;height:100%;display:block;cursor:grab;touch-action:none}
svg.panning{cursor:grabbing}
.gridline{fill:none;stroke:var(--grid);stroke-width:1}
.boundary rect{fill:var(--region);stroke:var(--region-stroke);stroke-dasharray:6 5;stroke-width:1.2}
.boundary.security-group rect{fill:var(--sg);stroke:var(--sg-stroke)}
.boundary text{font:600 12.5px var(--mono);fill:var(--region-stroke);letter-spacing:.04em;paint-order:stroke;stroke:var(--bg);stroke-width:5px;stroke-linejoin:round}
.boundary.security-group text{fill:var(--sg-stroke)}
.edge .line{fill:none;stroke:var(--line);stroke-width:1.6;transition:opacity .2s,stroke .2s}
.edge .hit{fill:none;stroke:transparent;stroke-width:12}
.edge.emphasis .line{stroke:var(--emphasis);stroke-width:2.2}
.edge.security .line{stroke:var(--security);stroke-dasharray:2 4}
.edge.dashed .line{stroke-dasharray:6 5}
.arrow{fill:var(--line)}.arrow.emphasis{fill:var(--emphasis)}.arrow.security{fill:var(--security)}
.edge-label rect{fill:var(--edge-bg);stroke:color-mix(in srgb,var(--line) 40%,transparent)}
.edge-label text{font:500 12px var(--mono);fill:var(--muted);text-anchor:middle}
.trace .edge .line{stroke-dasharray:7 7;animation:flow 1.1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-14}}
.node{cursor:pointer;transition:opacity .2s}
.node .body{fill:var(--node);stroke:var(--c);stroke-width:1.4;filter:drop-shadow(0 6px 14px rgba(0,0,0,.18))}
.node:hover .body,.node:focus .body,.node.selected .body{stroke-width:2.6}
.node:focus{outline:none}
.node .stripe{fill:var(--c)}
.node .label{font:600 15px var(--font);fill:var(--ink);text-anchor:middle}
.node .sublabel{font:500 11.5px var(--mono);fill:var(--muted);text-anchor:middle}
.tag rect{fill:var(--bg);stroke:var(--c)}.tag text{font:600 10.5px var(--mono);fill:var(--c);text-anchor:middle}
${['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'].map((t) => `.t-${t}{--c:var(--${t})}`).join('')}
.dim .node:not(.on),.dim .edge:not(.on),.dim .boundary:not(.on){opacity:.14}
.dim .edge.on .line{stroke:var(--emphasis);stroke-width:2.4}
.legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--muted)}
.legend-item{display:inline-flex;align-items:center;gap:6px}
.sw{width:10px;height:10px;border-radius:3px;background:var(--c);display:inline-block}
.hint{margin-left:auto;font-family:var(--mono);font-size:11px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.card{background:var(--panel);border:1px solid color-mix(in srgb,var(--line) 30%,transparent);border-radius:12px;padding:10px 14px}
.card h3{margin:0 0 6px;font-size:13px;display:flex;align-items:center;gap:8px}
.card ul{margin:0;padding-left:18px;color:var(--muted);font-size:12px;line-height:1.55}
.dot{width:8px;height:8px;border-radius:99px;display:inline-block}
.d-cyan{background:#22d3ee}.d-emerald{background:#34d399}.d-violet{background:#a78bfa}.d-amber{background:#fbbf24}.d-rose{background:#fb7185}.d-orange{background:#fb923c}.d-slate{background:#94a3b8}
#inspector{position:absolute;top:12px;right:12px;width:230px;background:var(--panel);border:1px solid color-mix(in srgb,var(--line) 40%,transparent);border-radius:12px;padding:12px 14px;font-size:12px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
#inspector h4{margin:0;font-size:14px}#inspector .k{font:600 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:10px 0 4px}
#inspector ul{margin:0;padding-left:16px;color:var(--muted);line-height:1.5}
#note{position:absolute;left:12px;bottom:12px;max-width:60%;background:var(--panel);border-left:3px solid var(--emphasis);border-radius:8px;padding:8px 12px;font-size:12.5px}
body.presenting header,body.presenting .legend,body.presenting .cards{display:none}
body.presenting main{padding:0}body.presenting .stage{border:0;border-radius:0}
body.presenting .views{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2;background:var(--panel);padding:6px;border-radius:12px}
@media (max-width:640px){header,main,.views{padding-left:12px;padding-right:12px}.hint{display:none}#inspector{width:auto;left:12px}}
`

const RUNTIME = `(function(){
var D=window.__ARCHIFY__,svg=document.getElementById('map'),root=document.documentElement;
var insp=document.getElementById('inspector'),note=document.getElementById('note');
var vb=D.viewBox.slice(),home=D.viewBox.slice(),current=-1;
function setVB(){svg.setAttribute('viewBox',vb.join(' '))}
function nodes(){return svg.querySelectorAll('.node')}
function clear(){svg.classList.remove('dim');svg.querySelectorAll('.on,.selected').forEach(function(e){e.classList.remove('on','selected')});insp.hidden=true;note.hidden=true}
function light(ids){var set={};ids.forEach(function(i){set[i]=1});svg.classList.add('dim');
 nodes().forEach(function(n){if(set[n.dataset.id])n.classList.add('on')});
 svg.querySelectorAll('.edge').forEach(function(e){if(set[e.dataset.from]&&set[e.dataset.to])e.classList.add('on')});
 svg.querySelectorAll('.boundary').forEach(function(b){if(b.dataset.wraps.split(' ').some(function(w){return set[w]}))b.classList.add('on')})}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function focusNode(id){clear();var ids=[id],ins=[],outs=[];
 D.edges.forEach(function(e){if(e.from===id){ids.push(e.to);outs.push(D.nodes[e.to].label+(e.label?' — '+e.label:''))}if(e.to===id){ids.push(e.from);ins.push(D.nodes[e.from].label+(e.label?' — '+e.label:''))}});
 light(ids);var el=svg.querySelector('.node[data-id="'+id+'"]');if(el)el.classList.add('selected');
 var n=D.nodes[id];insp.innerHTML='<h4>'+esc(n.label)+'</h4><div style="color:var(--muted)">'+esc(n.type)+(n.sublabel?' · '+esc(n.sublabel):'')+'</div>'+(n.tag?'<div class="k">Tag</div>'+esc(n.tag):'')+
 '<div class="k">Inbound ('+ins.length+')</div><ul>'+(ins.map(function(s){return'<li>'+esc(s)+'</li>'}).join('')||'<li>none</li>')+'</ul>'+
 '<div class="k">Outbound ('+outs.length+')</div><ul>'+(outs.map(function(s){return'<li>'+esc(s)+'</li>'}).join('')||'<li>none</li>')+'</ul>';insp.hidden=false}
function showView(i){current=i;document.querySelectorAll('.view').forEach(function(b){b.classList.toggle('active',+b.dataset.view===i)});clear();
 if(i<0)return;var v=D.views[i];light(v.focus);if(v.note){note.textContent=v.note;note.hidden=false}}
nodes().forEach(function(n){n.addEventListener('click',function(ev){ev.stopPropagation();focusNode(n.dataset.id)});n.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();focusNode(n.dataset.id)}})});
document.querySelectorAll('.view').forEach(function(b){b.addEventListener('click',function(){showView(+b.dataset.view)})});
var tr=document.getElementById('trace');function setTrace(on){svg.classList.toggle('trace',on);tr.setAttribute('aria-pressed',on)}setTrace(D.trace);
tr.onclick=function(){setTrace(!svg.classList.contains('trace'))};
document.getElementById('theme').onclick=function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'};
document.getElementById('fit').onclick=function(){vb=home.slice();setVB()};
document.getElementById('present').onclick=function(){document.body.classList.toggle('presenting');var el=document.documentElement;
 if(document.body.classList.contains('presenting')){if(el.requestFullscreen)el.requestFullscreen().catch(function(){})}else if(document.fullscreenElement)document.exitFullscreen()};
document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement)document.body.classList.remove('presenting')});
document.addEventListener('keydown',function(ev){var n=D.views.length;if(ev.key==='Escape'){document.body.classList.remove('presenting');showView(-1)}
 if(!n)return;if(ev.key==='ArrowRight')showView(current+1>=n?-1:current+1);if(ev.key==='ArrowLeft')showView(current-1<-1?n-1:current-1)});
function pt(ev){var r=svg.getBoundingClientRect(),s=Math.max(vb[2]/r.width,vb[3]/r.height);return{s:s,x:vb[0]+(ev.clientX-r.left)*s-(r.width*s-vb[2])/2,y:vb[1]+(ev.clientY-r.top)*s-(r.height*s-vb[3])/2}}
svg.addEventListener('wheel',function(ev){ev.preventDefault();var p=pt(ev),k=ev.deltaY>0?1.1:1/1.1;var w=vb[2]*k;if(w<home[2]*.25||w>home[2]*3)return;
 vb=[p.x-(p.x-vb[0])*k,p.y-(p.y-vb[1])*k,vb[2]*k,vb[3]*k];setVB()},{passive:false});
var drag=null,moved=false;svg.addEventListener('pointerdown',function(ev){if(ev.target.closest('.node'))return;drag={x:ev.clientX,y:ev.clientY,vb:vb.slice(),s:pt(ev).s};moved=false;svg.classList.add('panning');svg.setPointerCapture(ev.pointerId)});
svg.addEventListener('pointermove',function(ev){if(!drag)return;var dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;vb=[drag.vb[0]-dx*drag.s,drag.vb[1]-dy*drag.s,vb[2],vb[3]];setVB()});
svg.addEventListener('pointerup',function(){if(drag&&!moved){showView(-1)}drag=null;svg.classList.remove('panning')});
window.addEventListener('message',function(ev){var m=ev.data||{};if(m.type==='archify:theme')root.dataset.theme=m.theme;if(m.type==='archify:view')showView(m.index);if(m.type==='archify:focus')focusNode(m.id)});
})();`
