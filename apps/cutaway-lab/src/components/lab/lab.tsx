"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Upload, Sparkles, CircleAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { liveTimeline, validateSpec, type ModelSpec } from "@/lib/modelspec";
import type { PlayerStatus } from "@/lib/player";
import { actLabel, DEFAULT_PRESET, PRESET_ORDER, PRESETS, type PresetId } from "@/lib/presets";
import { SourcePanel } from "./source-panel";
import { Viewport, type Subject, type ViewportHandle } from "./viewport";

type LiveInfo = { checked: boolean; live: boolean; model: string };
type LiveResult = { spec: ModelSpec; warnings: string[]; model: string; ms: number; from: string };
type RunState = { state: "idle" } | { state: "running"; since: number } | { state: "error"; message: string };
type Ref = { kind: "preset"; id: PresetId } | { kind: "upload"; name: string; data: string; mediaType: string; url: string };

const MAX_UPLOAD = 2 * 1024 * 1024;
const CLIENT_TIMEOUT_MS = 65_000;

const fmt = (t: number) => `${t.toFixed(1)} s`;

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function Lab() {
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [status, setStatus] = useState<PlayerStatus>({ mode: "idle", act: null, phase: "rest", progress: 0, t: 0 });
  const [info, setInfo] = useState<LiveInfo>({ checked: false, live: false, model: "" });
  const [run, setRun] = useState<RunState>({ state: "idle" });
  const [ref, setRefImg] = useState<Ref>({ kind: "preset", id: DEFAULT_PRESET });
  const [engineError, setEngineError] = useState<string | null>(null);
  const vp = useRef<ViewportHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // ?nolive forces the unavailable path (for checking the fallback with a key configured)
    const forceOff = new URLSearchParams(window.location.search).has("nolive");
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setInfo({ checked: true, live: Boolean(j.live) && !forceOff, model: String(j.model ?? "") }))
      .catch(() => setInfo({ checked: true, live: false, model: "" }));
  }, []);

  const preset = PRESETS[presetId];
  const subject: Subject = useMemo(() => (live ? { kind: "live", spec: live.spec } : { kind: "preset", id: presetId }), [live, presetId]);
  const film = useMemo(() => (live ? liveTimeline(live.spec) : preset.timeline), [live, preset]);
  const parts = live ? live.spec.parts.map((p) => ({ id: p.id, label: p.label, note: p.note })) : preset.parts;
  const labelOf = useCallback(
    (act: string) => (live ? (live.spec.parts.find((p) => p.id === act)?.label ?? { exploded: "Teardown", assemble: "Reassembly", hero: "Release" }[act] ?? act) : actLabel(preset, act)),
    [live, preset],
  );

  const chip = (() => {
    if (status.mode === "idle") return "At rest";
    if (status.mode === "part" && status.act) {
      const l = labelOf(status.act);
      return status.phase === "opening" ? `${l} opening` : status.phase === "held" ? `${l} open` : `${l} closing`;
    }
    if (status.mode === "play") return status.act ? labelOf(status.act) : "Intro";
    return "";
  })();

  const pickPreset = (id: PresetId) => {
    setLive(null);
    setPresetId(id);
    setRefImg((r) => (r.kind === "preset" ? { kind: "preset", id } : r));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setRun({ state: "error", message: "Use a JPEG, PNG or WebP image." });
      return;
    }
    if (f.size > MAX_UPLOAD) {
      setRun({ state: "error", message: "That image is over 2 MB." });
      return;
    }
    setRefImg({ kind: "upload", name: f.name, data: await blobToBase64(f), mediaType: f.type, url: URL.createObjectURL(f) });
    setRun({ state: "idle" });
  };

  const generate = async () => {
    if (!info.live || run.state === "running") return;
    setRun({ state: "running", since: Date.now() });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
    try {
      let data: string;
      let mediaType: string;
      let from: string;
      if (ref.kind === "upload") {
        ({ data, mediaType } = ref);
        from = ref.name;
      } else {
        const b = await (await fetch(PRESETS[ref.id].thumb)).blob();
        data = await blobToBase64(b);
        mediaType = "image/jpeg";
        from = `${PRESETS[ref.id].name} reference still`;
      }
      const r = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: data, mediaType }), signal: ctl.signal });
      const j = await r.json().catch(() => ({ error: `Live failed (HTTP ${r.status}).` }));
      if (!r.ok || !j.spec) throw new Error(j.error || `Live failed (HTTP ${r.status}).`);
      // the runtime only ever builds a spec that passes the same gate as the server
      const v = validateSpec(j.spec);
      if (!v.ok) throw new Error(`The model spec failed validation: ${v.errors.slice(0, 3).join("; ")}.`);
      setLive({ ...j, spec: v.spec, from });
      setRun({ state: "idle" });
    } catch (e) {
      const msg = e instanceof DOMException && e.name === "AbortError" ? "Live timed out. Staying on the preset." : e instanceof Error ? e.message : String(e);
      setRun({ state: "error", message: msg });
    } finally {
      clearTimeout(timer);
    }
  };

  const playing = status.mode === "play";
  const name = live ? live.spec.name : preset.name;
  const code = live ? live.spec.code : preset.code;
  const kind = live ? live.spec.kind : preset.kind;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-6 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-[var(--cut-green)]" aria-hidden />
            <h1 className="text-[22px] font-extrabold tracking-tight text-neutral-900">Cutaway Lab</h1>
          </div>
          <p className="mt-1 max-w-xl text-[14px] text-neutral-500">
            Mechanical objects rebuilt entirely as three.js code, taking themselves apart on camera.
          </p>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">cutaway skill, in the browser</div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------ the studio */}
        <section className="relative self-start overflow-hidden rounded-[28px] border border-neutral-200 bg-[#fbfdfc] shadow-[0_1px_0_rgba(0,0,0,0.02),0_30px_60px_-40px_rgba(20,60,40,0.25)]">
          <div className="relative aspect-[4/5] w-full sm:aspect-[16/9]">
            <Viewport ref={vp} subject={subject} film={film} onStatus={setStatus} onError={setEngineError} />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="source-badge"
                    className={
                      live
                        ? "rounded-full bg-[var(--cut-green)] px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-white"
                        : "rounded-full border border-[var(--cut-green)] bg-white/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--cut-green-ink)]"
                    }
                  >
                    {live ? "LIVE" : "PRESET"}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-400">{live ? `one ${live.model} pass` : "official upstream object"}</span>
                </div>
                <h2 className="mt-2 text-[30px] font-extrabold leading-none tracking-tight text-neutral-900 sm:text-[44px]">
                  {name} <span className="text-[var(--cut-green)]">{code}</span>
                </h2>
                <p className="mt-1.5 text-[14px] font-medium text-neutral-500">{live ? `${kind}, taken apart` : preset.title}</p>
              </div>
              <div className="rounded-full border border-neutral-200 bg-white/85 px-3 py-1 font-mono text-[11px] text-neutral-600 backdrop-blur" data-testid="status-chip">
                {chip}
              </div>
            </div>

            {engineError && (
              <div className="absolute inset-x-4 top-1/2 rounded-xl border border-red-200 bg-white p-3 text-[13px] text-red-700">WebGL error: {engineError}</div>
            )}
          </div>
            <div className="border-t border-neutral-200 bg-white px-3 py-3 sm:px-5">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {parts.map((p) => {
                    const on = status.mode === "part" && status.act === p.id;
                    const film_ = playing && status.act === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={playing ? "Parts lock while the tour plays" : p.note}
                        disabled={playing}
                        onClick={() => vp.current?.clickPart(p.id)}
                        data-part={p.id}
                        className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                          on || film_
                            ? "border-[var(--cut-green)] bg-[var(--cut-green)] text-white"
                            : "border-neutral-200 bg-white text-neutral-800 hover:border-[var(--cut-green)] disabled:opacity-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <div className="ml-auto flex items-center gap-1.5">
                    {playing ? (
                      <Button size="sm" variant="outline" onClick={() => vp.current?.stop()} data-testid="stop">
                        <Square className="size-3.5" /> Stop
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-neutral-900 text-white hover:bg-neutral-800" onClick={() => vp.current?.play()} data-testid="play">
                        <Play className="size-3.5" /> Play tour
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="relative h-1.5 flex-1 rounded-full bg-neutral-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--cut-green)]" style={{ width: `${(playing ? status.progress : 0) * 100}%` }} />
                    {film.script.map((b) => (
                      <span key={`${b.act}${b.t}`} className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-400" style={{ left: `${(b.t / film.duration) * 100}%` }} />
                    ))}
                  </div>
                  <span className="w-[104px] shrink-0 text-right font-mono text-[11px] text-neutral-500">
                    {playing ? fmt(status.t) : "0.0 s"} / {fmt(film.duration)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-400">
                  {playing ? "Parts lock while the tour plays. Stop returns to rest." : "Click a part to open it, click it again to close. Play runs the full tour from timeline.json."}
                </p>
              </div>
            </div>
        </section>

        {/* ------------------------------------------------ the side column */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Official objects</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PRESET_ORDER.map((id) => {
                const p = PRESETS[id];
                const on = !live && id === presetId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickPreset(id)}
                    data-preset={id}
                    className={`group overflow-hidden rounded-xl border text-left transition ${on ? "border-[var(--cut-green)] ring-2 ring-[var(--cut-green)]/20" : "border-neutral-200 hover:border-neutral-300"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={`${p.name} ${p.code} reference still`} className="aspect-square w-full object-cover" />
                    <div className="px-2 py-1.5">
                      <div className="truncate text-[12px] font-bold text-neutral-900">{p.name}</div>
                      <div className="font-mono text-[10px] text-neutral-500">{p.code}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-neutral-400">Thumbnails are the first frame of each upstream film, shown as the reference still.</p>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4" data-testid="live-panel">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Live from a picture</h2>
              <span
                data-testid="live-availability"
                className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
                  !info.checked ? "bg-neutral-100 text-neutral-500" : info.live ? "bg-[var(--cut-green)]/10 text-[var(--cut-green-ink)]" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`size-1.5 rounded-full ${!info.checked ? "bg-neutral-400" : info.live ? "bg-[var(--cut-green)]" : "bg-amber-500"}`} />
                {!info.checked ? "CHECKING" : info.live ? "AVAILABLE" : "UNAVAILABLE"}
              </span>
            </div>
            {info.checked && !info.live && (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[12.5px] leading-snug text-amber-900">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Live is unavailable on this deployment: no Anthropic key is configured on the server. The official presets above keep working; nothing here is a Live result.</span>
              </div>
            )}
            <p className="mt-3 text-[12.5px] leading-snug text-neutral-600">
              One Claude {info.model ? <span className="font-mono text-[11.5px]">{info.model}</span> : "Sonnet"} pass reads the picture and returns a ModelSpec (named parts made of primitives, palette materials,
              anchors, explode offsets). A fixed runtime builds it. No model-written code runs.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {PRESET_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRefImg({ kind: "preset", id })}
                  className={`size-11 overflow-hidden rounded-lg border ${ref.kind === "preset" && ref.id === id ? "border-[var(--cut-green)] ring-2 ring-[var(--cut-green)]/20" : "border-neutral-200"}`}
                  title={`Use the ${PRESETS[id].name} still`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PRESETS[id].thumb} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {ref.kind === "upload" && (
                <span className="size-11 overflow-hidden rounded-lg border border-[var(--cut-green)] ring-2 ring-[var(--cut-green)]/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.url} alt="" className="h-full w-full object-cover" />
                </span>
              )}
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => fileInput.current?.click()}>
                <Upload className="size-3.5" /> Upload
              </Button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">{ref.kind === "upload" ? ref.name : `${PRESETS[ref.id].name} still`} (JPEG, PNG or WebP, up to 2 MB)</p>
            <Button className="mt-3 w-full bg-[var(--cut-green)] text-white hover:bg-[var(--cut-green-ink)]" disabled={!info.live || run.state === "running"} onClick={generate} data-testid="generate">
              <Sparkles className="size-4" />
              {run.state === "running" ? "Claude is rebuilding it..." : info.live ? "Generate Live model" : "Live unavailable"}
            </Button>
            {run.state === "error" && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50/70 p-3 text-[12.5px] text-red-800" data-testid="live-error">
                {run.message} The {live ? "previous Live model" : "preset"} stays on screen.
              </div>
            )}
            {live && (
              <div className="mt-4 border-t border-neutral-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-neutral-800">Checklist against {live.from}</div>
                  <button type="button" onClick={() => setLive(null)} className="flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-800">
                    <ArrowLeft className="size-3" /> Presets
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {live.spec.checklist.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-snug text-neutral-700">
                      <span
                        className={`mt-px w-[52px] shrink-0 rounded px-1 text-center font-mono text-[10px] font-semibold uppercase ${
                          c.grade === "yes" ? "bg-[var(--cut-green)]/12 text-[var(--cut-green-ink)]" : c.grade === "partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {c.grade}
                      </span>
                      {c.item}
                    </li>
                  ))}
                </ul>
                {live.spec.simplified && <p className="mt-2 text-[12px] italic text-neutral-500">Simplified: {live.spec.simplified}</p>}
                <p className="mt-2 font-mono text-[10.5px] text-neutral-400">
                  {live.model}, {(live.ms / 1000).toFixed(1)} s{live.warnings.length ? `, ${live.warnings.length} clamp warnings` : ""}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{live ? "Live tour" : "Film timeline"}</h2>
            <ol className="mt-2.5 space-y-1">
              {film.script.map((b) => {
                const on = playing && status.act === b.act;
                return (
                  <li key={`${b.act}${b.t}`} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[12.5px] ${on ? "bg-[var(--cut-green)]/10 font-semibold text-neutral-900" : "text-neutral-600"}`}>
                    <span>{labelOf(b.act)}</span>
                    <span className="font-mono text-[11px] text-neutral-400">{fmt(b.t)}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11px] text-neutral-400">
              {live ? "Generated beats, same rhythm as the official films." : `Beat times from sims/${presetId}-film/timeline.json, ${fmt(film.duration)} film.`}
            </p>
          </section>

          <SourcePanel />
        </aside>
      </div>
    </div>
  );
}
