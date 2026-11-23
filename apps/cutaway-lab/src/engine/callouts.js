// Part callouts over the viewport: a pool of small DOM cards (a dot on the part, its name and note), placed on
// projected anchor points each frame. Cards on the same side are pushed apart vertically so they never stack.
// Shared by the official and the Live runtimes.
const GAP = 36;

export function createCallouts(overlay) {
  const pool = [];
  const card = (i) => {
    if (pool[i]) return pool[i];
    const el = document.createElement('div');
    el.className = 'cut-callout';
    el.innerHTML = '<span class="cut-dot"></span><span class="cut-card"><b></b><i></i></span>';
    overlay.appendChild(el);
    pool[i] = el;
    return el;
  };
  /** items: [{x, y, name, sub}] in CSS px of the canvas; o: shared opacity; w/h: canvas size */
  const draw = (items, o, w, h) => {
    let n = 0;
    if (o > 0.02) {
      const vis = items.filter((it) => it.x >= 40 && it.x <= w - 40 && it.y >= 40 && it.y <= h - 40).map((it) => ({...it, side: it.x < w * 0.62 ? 'r' : 'l'}));
      for (const side of ['r', 'l']) {
        let prev = -Infinity;
        for (const it of vis.filter((v) => v.side === side).sort((a, b) => a.y - b.y)) {
          it.cy = Math.max(it.y, prev + GAP);
          prev = it.cy;
        }
      }
      for (const it of vis) {
        const el = card(n++);
        el.dataset.side = it.side;
        el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
        el.style.opacity = String(o);
        el.style.display = '';
        el.lastChild.style.marginTop = `${(it.cy - it.y).toFixed(1)}px`;
        const b = el.querySelector('b');
        const i = el.querySelector('i');
        if (b.textContent !== it.name) b.textContent = it.name;
        if (i.textContent !== it.sub) i.textContent = it.sub;
      }
    }
    for (let i = n; i < pool.length; i++) pool[i].style.display = 'none';
  };
  const dispose = () => pool.forEach((el) => el.remove());
  return {draw, dispose};
}
