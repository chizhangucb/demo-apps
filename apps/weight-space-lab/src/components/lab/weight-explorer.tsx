"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LoadingBlock, ErrorBox } from "./compare";
import { bitsFields, bitsHex, columnDetail, decodeTensor, totalChanged, touchedSlots, type DecodedTensor, type WeightEdit } from "@/lib/bf16";
import { fmtVal, nf } from "@/lib/fmt";
import { SRC } from "@/lib/sources";
import { cn } from "@/lib/utils";

// diverging map: negative -> indigo, zero -> near background, positive -> amber
const NEG = [124, 140, 245];
const POS = [242, 183, 82];
const MID = [30, 36, 48];

function colorFor(v: number, scale: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v / scale));
  const a = Math.sqrt(Math.abs(t));
  const c = t < 0 ? NEG : POS;
  return [MID[0] + (c[0] - MID[0]) * a, MID[1] + (c[1] - MID[1]) * a, MID[2] + (c[2] - MID[2]) * a];
}

function percentileAbs(d: DecodedTensor, p: number): number {
  const vals: number[] = [];
  for (let i = 0; i < d.grid.length; i++) if (d.present[i]) vals.push(Math.abs(d.grid[i]));
  vals.sort((a, b) => a - b);
  return vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] || 1;
}

type Hover = { row: number; col: number; pos: number } | null;

export function WeightExplorer() {
  const [edit, setEdit] = useState<WeightEdit | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/weight-edit.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setEdit)
      .catch((e) => setErr(String(e?.message ?? e)));
  }, []);

  const decoded = useMemo(() => (edit ? edit.manifest.map(decodeTensor) : null), [edit]);

  if (err) return <ErrorBox title="Could not load weight-edit.json" msg={err} />;
  if (!edit || !decoded) return <LoadingBlock label="loading weight-edit.json (1.8 MB sparse diff)" />;

  const changed = totalChanged(edit.manifest);
  const touched = touchedSlots(edit.manifest);

  return (
    <div className="flex flex-col gap-4">
      <div className="lab-panel grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Only two tensors changed</h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            The edit touches the MLP output projection (<code className="font-mono text-foreground">down_proj</code>) in layers 15 and 19 of Qwen3.5-0.8B and nothing else: no embeddings, no output head, no final norm. Each tensor is 1024 x 3584 and 64 of its 3,584 columns were rewritten. Below are the real edited values from the published sparse diff, decoded bit for bit. The diff stores only edited values, so base weights are not shown and are not invented.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Readout big={nf.format(changed)} label="changed bfloat16 entries" sub="idx/val pairs in edit.npz whose bits differ from base" accent="var(--edited)" />
          <Readout big={nf.format(touched)} label="slots touched by the author" sub="64 columns x 1024 rows x 2 layers" accent="var(--base)" />
          <div className="col-span-2 rounded-md border border-border bg-background/40 p-3 text-[12px] leading-relaxed text-muted-foreground">
            The gap is {nf.format(touched - changed)} slots ({decoded.map((d) => `layer ${d.layer}: ${nf.format(d.columns.length * d.shape[0] - d.changedEntries)}`).join(", ")}). Per the manifest, entries whose edited value rounds back to the identical bfloat16 bits are not counted as changed, so they are absent from the diff. They render as hatched cells.
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {decoded.map((d) => (
          <TensorCard key={d.tensor} d={d} />
        ))}
      </div>
    </div>
  );
}

function Readout({ big, label, sub, accent }: { big: string; label: string; sub: string; accent: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="font-heading text-2xl font-semibold tabular-nums" style={{ color: accent }}>{big}</div>
      <div className="mt-0.5 text-[12px] text-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function TensorCard({ d }: { d: DecodedTensor }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scale = useMemo(() => percentileAbs(d, 0.99), [d]);
  const [hover, setHover] = useState<Hover>(null);
  const [selCol, setSelCol] = useState(d.columns[0]);
  const w = d.columns.length;
  const [rows, cols] = d.shape;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !scale) return;
    c.width = w;
    c.height = rows;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(w, rows);
    for (let r = 0; r < rows; r++) {
      for (let p = 0; p < w; p++) {
        const k = r * w + p;
        const o = k * 4;
        if (!d.present[k]) {
          const hatch = (r + p * 3) % 6 < 2;
          img.data[o] = hatch ? 70 : 22;
          img.data[o + 1] = hatch ? 76 : 26;
          img.data[o + 2] = hatch ? 92 : 34;
        } else {
          const [R, G, B] = colorFor(d.grid[k], scale);
          img.data[o] = R;
          img.data[o + 1] = G;
          img.data[o + 2] = B;
        }
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [d, scale, w, rows]);

  const selPos = d.colPos.get(selCol) ?? 0;
  const detail = useMemo(() => columnDetail(d, selCol), [d, selCol]);

  function locate(e: React.MouseEvent<HTMLDivElement>): Hover {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * w)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * rows)));
    return { row, col: d.columns[pos], pos };
  }

  const hk = hover ? hover.row * w + hover.pos : -1;
  const hoverPresent = hover ? d.present[hk] === 1 : false;
  const m = d.manifest;

  return (
    <section className="lab-panel flex min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="lab-label">tensor</div>
          <div className="font-heading text-lg font-semibold">Layer {d.layer} <span className="text-muted-foreground">· mlp.down_proj</span></div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{d.tensor}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-right font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
          <Stat k="shape" v={`${rows} x ${cols}`} />
          <Stat k="changed" v={nf.format(d.changedEntries)} />
          <Stat k="columns" v={String(m.changed_columns)} />
          <Stat k="rows hit" v={nf.format(d.changedRows)} />
        </div>
      </div>

      {/* column position strip across the full 3584 width */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>col 0</span>
          <span>positions of the 64 edited columns in the full {nf.format(cols)}-wide tensor</span>
          <span>{nf.format(cols - 1)}</span>
        </div>
        <div className="relative h-5 rounded-sm border border-border bg-background/60">
          {d.columns.map((c) => (
            <button
              key={c}
              aria-label={`column ${c}`}
              onClick={() => setSelCol(c)}
              className={cn("absolute top-0 h-full w-[3px] -translate-x-1/2", c === selCol ? "bg-edited" : hover?.col === c ? "bg-foreground" : "bg-foreground/45 hover:bg-foreground")}
              style={{ left: `${(c / (cols - 1)) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* heatmap */}
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        <div className="flex flex-col justify-between py-0.5 text-right font-mono text-[10px] text-muted-foreground">
          <span>row 0</span>
          <span>512</span>
          <span>1023</span>
        </div>
        <div>
          <div
            className="relative h-[340px] cursor-crosshair overflow-hidden rounded-sm border border-border sm:h-[420px]"
            onMouseMove={(e) => setHover(locate(e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const h = locate(e);
              if (h) setSelCol(h.col);
            }}
          >
            <canvas ref={canvas} className="pixelated absolute inset-0 h-full w-full" aria-label={`heatmap of layer ${d.layer} edited values, 1024 rows by 64 edited columns`} />
            <div className="pointer-events-none absolute top-0 h-full border-x border-edited/90" style={{ left: `${(selPos / w) * 100}%`, width: `${100 / w}%` }} />
            {hover && <div className="pointer-events-none absolute left-0 w-full border-t border-foreground/40" style={{ top: `${(hover.row / rows) * 100}%` }} />}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>col {d.columns[0]}</span>
            <span>64 edited columns, compacted, in ascending order</span>
            <span>col {d.columns[w - 1]}</span>
          </div>
        </div>
      </div>

      {/* readout + legend */}
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="min-h-[38px] rounded-md border border-border bg-background/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          {hover ? (
            <>
              row <b className="text-foreground">{hover.row}</b> · col <b className="text-foreground">{hover.col}</b> · flat idx <b className="text-foreground">{nf.format(hover.row * cols + hover.col)}</b>
              <br />
              {hoverPresent ? (
                <>bits <b className="text-foreground">{bitsHex(d.gridBits[hk])}</b> → <b className="text-foreground">{fmtVal(d.grid[hk])}</b></>
              ) : (
                <>not in diff: edited bits equal base bits (base value not published here)</>
              )}
            </>
          ) : (
            <>hover the heatmap for a cell readout, click to inspect a column</>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>-{fmtVal(scale)}</span>
          <div className="h-2.5 w-28 rounded-sm" style={{ background: `linear-gradient(90deg, rgb(${NEG}), rgb(${MID}), rgb(${POS}))` }} />
          <span>+{fmtVal(scale)}</span>
          <span className="hidden sm:inline">(99th pct |w|, clipped)</span>
        </div>
      </div>

      {detail && <ColumnPanel d={d} detail={detail} />}

      <Collapsible className="mt-3 rounded-md border border-border">
        <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] text-muted-foreground hover:text-foreground">
          source details: manifest fields, checksums, all 64 columns
          <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border px-3 py-2 font-mono text-[11px]">
            <dt className="text-muted-foreground">tensor</dt><dd className="break-all">{m.tensor}</dd>
            <dt className="text-muted-foreground">shape</dt><dd>[{m.shape.join(", ")}]</dd>
            <dt className="text-muted-foreground">changed_entries</dt><dd>{nf.format(m.changed_entries)}</dd>
            <dt className="text-muted-foreground">changed_columns</dt><dd>{m.changed_columns}</dd>
            <dt className="text-muted-foreground">changed rows</dt><dd>{nf.format(d.changedRows)} (computed from idx)</dd>
            <dt className="text-muted-foreground">relative_change</dt><dd>{m.relative_change}</dd>
            <dt className="text-muted-foreground">max |edited w|</dt><dd>{fmtVal(d.maxAbs)} (computed from decoded val)</dd>
            <dt className="text-muted-foreground">base_sha256</dt><dd className="break-all">{m.base_sha256}</dd>
            <dt className="text-muted-foreground">edited_sha256</dt><dd className="break-all">{m.edited_sha256}</dd>
            <dt className="text-muted-foreground">columns</dt><dd className="break-words">{m.columns.join(", ")}</dd>
          </dl>
          <div className="flex flex-wrap gap-3 border-t border-border px-3 py-2 font-mono text-[11px]">
            <ExtLink href={SRC.editNpz}>edit.npz</ExtLink>
            <ExtLink href={SRC.editManifest}>manifest.json</ExtLink>
            <ExtLink href={SRC.editDir}>exp8_math/runs/p50c/edit</ExtLink>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function ColumnPanel({ d, detail }: { d: DecodedTensor; detail: NonNullable<ReturnType<typeof columnDetail>> }) {
  const spark = useRef<HTMLCanvasElement>(null);
  const rows = d.shape[0];
  useEffect(() => {
    const c = spark.current;
    if (!c) return;
    const W = 600, H = 80;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const lim = Math.max(Math.abs(detail.min), Math.abs(detail.max)) || 1;
    ctx.strokeStyle = "rgba(200,210,230,0.18)";
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    for (const e of detail.entries) {
      const x = (e.row / (rows - 1)) * W;
      const y = H / 2 - (e.value / lim) * (H / 2 - 3);
      ctx.fillStyle = e.value < 0 ? `rgb(${NEG})` : `rgb(${POS})`;
      ctx.fillRect(x, Math.min(y, H / 2), 1, Math.max(1, Math.abs(y - H / 2)));
    }
  }, [detail, rows]);

  return (
    <div className="mt-3 rounded-md border border-edited/30 bg-edited/[0.04] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[12px]">
          <span className="lab-label mr-2">column</span>
          <b className="text-edited">{detail.col}</b>
          <span className="text-muted-foreground"> · {nf.format(detail.entries.length)} of {nf.format(rows)} rows changed</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          min {fmtVal(detail.min)} · max {fmtVal(detail.max)} · mean |w| {fmtVal(detail.meanAbs)}
        </div>
      </div>
      <canvas ref={spark} className="mt-2 h-16 w-full" aria-label={`edited values down column ${detail.col}`} />
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>row 0</span><span>edited value by row</span><span>row {rows - 1}</span></div>
      <div className="thin-scroll mt-2 max-h-56 overflow-auto rounded border border-border">
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left font-normal">row</th>
              <th className="px-2 py-1 text-left font-normal">flat idx</th>
              <th className="px-2 py-1 text-left font-normal">raw bits (uint16)</th>
              <th className="hidden px-2 py-1 text-left font-normal sm:table-cell">s | exponent | mantissa</th>
              <th className="px-2 py-1 text-right font-normal">decoded (bits &lt;&lt; 16)</th>
            </tr>
          </thead>
          <tbody>
            {detail.entries.map((e) => {
              const f = bitsFields(e.bits);
              return (
                <tr key={e.row} className="border-t border-border/60">
                  <td className="px-2 py-0.5">{e.row}</td>
                  <td className="px-2 py-0.5 text-muted-foreground">{e.idx}</td>
                  <td className="px-2 py-0.5">{e.bits} <span className="text-muted-foreground">{bitsHex(e.bits)}</span></td>
                  <td className="hidden px-2 py-0.5 text-muted-foreground sm:table-cell">
                    <span className={f.sign === "1" ? "text-neg" : "text-pos"}>{f.sign}</span> {f.exponent} {f.mantissa}
                  </td>
                  <td className={cn("px-2 py-0.5 text-right", e.value < 0 ? "text-neg" : "text-pos")}>{fmtVal(e.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Rows missing from this list kept their exact base bits. The diff carries no base values, so no before/after delta is shown.</p>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider uppercase">{k}</div>
      <div className="text-foreground">{v}</div>
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">
      {children}
      <ExternalLink className="size-3 opacity-60" aria-hidden />
    </a>
  );
}
