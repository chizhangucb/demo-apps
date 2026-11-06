"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Play, Radio, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OutputPane } from "./output-pane";
import { defaultIndex, recordingUrl, type Recording, type RecordingIndexRow } from "@/lib/data";
import { trimTrailing } from "@/lib/text";
import { nf } from "@/lib/fmt";
import { BASE_MODEL, EDITED_MODEL, SRC, SPACE_SAMPLING } from "@/lib/sources";
import { ENDPOINT, MAX_PROBLEM_CHARS, MAX_TOKENS, MIN_TOKENS, SPACE_ID, type LiveResponse } from "@/lib/live";
import { cn } from "@/lib/utils";

const CHARS_PER_SEC = 9000;

type Live = { phase: "idle" } | { phase: "pending"; started: number; problem: string } | { phase: "done"; res: LiveResponse; problem: string };

function short(id: string) {
  const m = id.match(/test\/(\w+)\/(\d+)\.json/);
  if (!m) return id;
  const abbr: Record<string, string> = { algebra: "ALG", intermediate_algebra: "IALG", precalculus: "PCALC", prealgebra: "PREALG", number_theory: "NT", geometry: "GEOM", counting_and_probability: "C&P" };
  return `${abbr[m[1]] ?? m[1]}-${m[2]}`;
}

export function Compare() {
  const [index, setIndex] = useState<RecordingIndexRow[] | null>(null);
  const [indexErr, setIndexErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [recs, setRecs] = useState<Record<string, Recording>>({});
  const [recErrs, setRecErrs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(Infinity);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"recorded" | "live">("recorded");
  const [live, setLive] = useState<Live>({ phase: "idle" });
  const [liveProblem, setLiveProblem] = useState("");
  const [tokens, setTokens] = useState(MIN_TOKENS);
  const [now, setNow] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    fetch("/data/recordings/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((rows: RecordingIndexRow[]) => {
        const i = defaultIndex(rows);
        setIndex(rows);
        setSel(i);
        setLiveProblem(rows[i].problem.slice(0, MAX_PROBLEM_CHARS));
      })
      .catch((e) => setIndexErr(String(e?.message ?? e)));
  }, []);

  const row = index?.[sel];

  const file = row?.file;
  const rec = file ? recs[file] ?? null : null;
  const recErr = file ? recErrs[file] ?? null : null;

  useEffect(() => {
    if (!file || recs[file] || recErrs[file]) return;
    let cancelled = false;
    fetch(recordingUrl(file))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Recording) => !cancelled && setRecs((m) => ({ ...m, [file]: d })))
      .catch((e) => !cancelled && setRecErrs((m) => ({ ...m, [file]: String(e?.message ?? e) })));
    return () => {
      cancelled = true;
    };
  }, [file, recs, recErrs]);

  const texts = useMemo(() => {
    if (mode === "live" && live.phase === "done" && live.res.status === "ok") {
      return { base: live.res.base ?? "", edited: live.res.edited ?? "", rawBase: (live.res.base ?? "").length, rawEdited: (live.res.edited ?? "").length };
    }
    if (!rec) return null;
    const base = trimTrailing(rec.base);
    const edited = trimTrailing(rec.edited);
    return { base, edited, rawBase: rec.base.length, rawEdited: rec.edited.length };
  }, [rec, mode, live]);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!texts) return;
    stop();
    const maxLen = Math.max(texts.base.length, texts.edited.length);
    const t0 = performance.now();
    setRevealed(0);
    setPlaying(true);
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 40) {
        last = t;
        const n = Math.floor(((t - t0) / 1000) * CHARS_PER_SEC);
        setRevealed(n);
        if (n >= maxLen) {
          setRevealed(Infinity);
          setPlaying(false);
          raf.current = null;
          return;
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [texts, stop]);

  const switchMode = useCallback(
    (m: "recorded" | "live") => {
      stop();
      setRevealed(Infinity);
      setMode(m);
    },
    [stop],
  );

  const select = useCallback(
    (i: number) => {
      if (!index) return;
      const n = (i + index.length) % index.length;
      switchMode("recorded");
      setSel(n);
      setLiveProblem(index[n].problem.slice(0, MAX_PROBLEM_CHARS));
    },
    [index, switchMode],
  );

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (live.phase !== "pending") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [live.phase]);

  async function runLive() {
    const problem = liveProblem.trim();
    if (!problem) return;
    stop();
    setNow(Date.now());
    setLive({ phase: "pending", started: Date.now(), problem });
    let res: LiveResponse;
    try {
      const r = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problem, maxNewTokens: tokens }) });
      res = r.headers.get("content-type")?.includes("json")
        ? await r.json()
        : { status: "error", endpoint: ENDPOINT, space: SPACE_ID, tokenConfigured: false, message: `Proxy returned HTTP ${r.status}.` };
    } catch (e) {
      res = { status: "error", endpoint: ENDPOINT, space: SPACE_ID, tokenConfigured: false, message: `Network error: ${(e as Error).message}` };
    }
    setLive({ phase: "done", res, problem });
    switchMode(res.status === "ok" ? "live" : "recorded");
  }

  if (indexErr) return <ErrorBox title="Could not load recordings index" msg={indexErr} />;
  if (!index || !row) return <LoadingBlock label="loading recordings/index.json" />;

  const liveOk = mode === "live" && live.phase === "done" && live.res.status === "ok";
  const modeTag = liveOk ? "LIVE" : "RECORDED";
  const sourceBase = liveOk ? `Live: ${SPACE_ID} ${ENDPOINT}, sampled (${SPACE_SAMPLING.split(", max")[0]})` : `Recorded: verification run eval/ samples, ${row.id}, max 32,768 tokens`;

  return (
    <div className="flex flex-col gap-4">
      {/* pair picker */}
      <div className="lab-panel p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="lab-label">MATH-500 paired recordings <span className="text-foreground">{sel + 1}</span> / {index.length}</div>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="previous pair" onClick={() => select(sel - 1)}>
              <ChevronLeft />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="next pair" onClick={() => select(sel + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="thin-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="listbox" aria-label="select recorded pair">
          {index.map((r, i) => (
            <button
              key={r.id}
              role="option"
              aria-selected={i === sel}
              onClick={() => select(i)}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1.5 text-left font-mono transition-colors",
                i === sel ? "border-edited/70 bg-edited/10 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <div className="text-[11px] font-medium">{short(r.id)}</div>
              <div className="text-[10px] opacity-80">L{r.level}</div>
            </button>
          ))}
        </div>
      </div>

      {/* problem + controls */}
      <div className="lab-panel grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="lab-label">problem</span>
            {!liveOk && <span className="font-mono text-[11px] text-muted-foreground">{row.id}</span>}
            {!liveOk && <span className="font-mono text-[11px] text-muted-foreground">{row.subject} / level {row.level}</span>}
          </div>
          {liveOk && live.phase === "done" ? (
            <>
              <p className="mt-1.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{live.problem}</p>
              <div className="mt-2 font-mono text-[11px] text-edited">LIVE problem you submitted. No gold answer; switch to RECORDED for the MATH-500 pair.</div>
            </>
          ) : (
            <>
              <p className="mt-1.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{row.problem}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="lab-label">gold answer (MATH-500 reference, not a model score)</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{row.gold_answer}</code>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 lg:w-60">
          <div className="lab-label">playback of recorded text</div>
          {playing ? (
            <Button variant="outline" onClick={stop}>
              <Square /> Stop
            </Button>
          ) : (
            <Button onClick={play} disabled={!texts}>
              <Play /> Play generation
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { stop(); setRevealed(Infinity); }}>
            <RotateCcw /> Show full text
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Replays the saved text at {nf.format(CHARS_PER_SEC)} chars/s on both sides at once. This is playback, not a live run.
          </p>
        </div>
      </div>

      {/* split */}
      {recErr && mode === "recorded" ? (
        <ErrorBox title={`Could not load ${row.file}`} msg={recErr} />
      ) : !texts ? (
        <LoadingBlock label={`loading recordings/${row.file}`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 md:[&>section]:h-[640px] [&>section]:h-[520px]">
          <OutputPane side="base" model={BASE_MODEL} sourceLabel={sourceBase} text={texts.base} rawChars={texts.rawBase} revealed={revealed} playing={playing} modeTag={modeTag} />
          <OutputPane side="edited" model={EDITED_MODEL} sourceLabel={sourceBase} text={texts.edited} rawChars={texts.rawEdited} revealed={revealed} playing={playing} modeTag={modeTag} />
        </div>
      )}
      <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">
        Indicators describe output shape only: whether the text closes its thinking block, contains a \boxed{"{}"}, and how many lines (40+ chars) repeat an earlier line verbatim (highlighted amber). None of them is a correctness grade.
      </p>

      {/* live */}
      <div className="lab-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-edited" aria-hidden />
            <h3 className="font-heading text-[15px] font-semibold">Live compare, best effort</h3>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 font-mono text-[11px]" role="group" aria-label="output source">
            <button className={cn("rounded px-2 py-1", mode === "recorded" ? "bg-muted text-foreground" : "text-muted-foreground")} onClick={() => switchMode("recorded")}>
              RECORDED
            </button>
            <button
              className={cn("rounded px-2 py-1", mode === "live" ? "bg-muted text-foreground" : "text-muted-foreground", !(live.phase === "done" && live.res.status === "ok") && "cursor-not-allowed opacity-40")}
              disabled={!(live.phase === "done" && live.res.status === "ok")}
              onClick={() => switchMode("live")}
            >
              LIVE
            </button>
          </div>
        </div>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
          Sends one problem through this app&apos;s server proxy to the public third-party Space{" "}
          <a className="text-foreground underline decoration-border underline-offset-2" href={SRC.space} target="_blank" rel="noreferrer">{SPACE_ID}</a>{" "}
          (endpoint <code className="font-mono text-foreground">{ENDPOINT}</code>, <a className="underline decoration-border underline-offset-2" href={SRC.spaceSource} target="_blank" rel="noreferrer">app.py</a>). It runs both models there with {SPACE_SAMPLING}. The Space asks ZeroGPU for 450 s per call, which is more than the anonymous allowance, so expect a quota message; the recordings above stay available either way. One call per minute, {nf.format(MAX_PROBLEM_CHARS)} char limit, tokens capped at {nf.format(MAX_TOKENS)}.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px]">
          <Textarea value={liveProblem} onChange={(e) => setLiveProblem(e.target.value.slice(0, MAX_PROBLEM_CHARS))} rows={3} className="font-mono text-[12.5px]" aria-label="live problem" />
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              max_new_tokens <span className="text-foreground tabular-nums">{nf.format(tokens)}</span>
            </label>
            <input type="range" min={MIN_TOKENS} max={MAX_TOKENS} step={256} value={tokens} onChange={(e) => setTokens(Number(e.target.value))} className="accent-[var(--edited)]" aria-label="max new tokens" />
            <Button onClick={runLive} disabled={live.phase === "pending" || !liveProblem.trim()}>
              {live.phase === "pending" ? <Loader2 className="animate-spin" /> : <Radio />} {live.phase === "pending" ? "Waiting for Space" : "Run live on Space"}
            </Button>
          </div>
        </div>
        <LiveStatusLine live={live} now={now} onRecorded={() => switchMode("recorded")} />
      </div>
    </div>
  );
}

function LiveStatusLine({ live, now, onRecorded }: { live: Live; now: number; onRecorded: () => void }) {
  if (live.phase === "idle") return <div className="mt-3 font-mono text-[11px] text-muted-foreground">status: idle. Showing recorded verification outputs.</div>;
  if (live.phase === "pending")
    return (
      <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-edited">
        <Loader2 className="size-3.5 animate-spin" /> pending: POST /api/live → {SPACE_ID} {ENDPOINT} · {Math.max(0, Math.round((now - live.started) / 1000))}s elapsed. Panes still show RECORDED text.
      </div>
    );
  const r = live.res;
  if (r.status === "ok")
    return (
      <div className="mt-3 font-mono text-[11px] text-edited">
        live ok in {((r.elapsedMs ?? 0) / 1000).toFixed(1)}s from {r.space} {r.endpoint}. Panes now show LIVE sampled output for your problem; switch to RECORDED any time.
      </div>
    );
  return (
    <div role="alert" className="mt-3 rounded-md border border-base/40 bg-base/[0.07] p-3">
      <div className="font-mono text-[11px] tracking-wide text-base uppercase">
        {r.status === "unavailable" ? "live generation unavailable (Space quota or rate limit)" : r.status === "rejected" ? "not sent" : "live call failed"}
        {r.elapsedMs != null && ` · ${(r.elapsedMs / 1000).toFixed(1)}s`} · {r.endpoint} · HF_TOKEN {r.tokenConfigured ? "configured" : "not set"}
      </div>
      {r.message && <p className="mt-1.5 font-mono text-[12px] leading-relaxed break-words text-foreground/90">{r.message}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRecorded}>Keep using recordings</Button>
        <span className="text-[11px] text-muted-foreground">Nothing was substituted: the panes show the recorded verification outputs, labelled RECORDED.</span>
      </div>
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="lab-panel flex h-40 items-center justify-center gap-2 font-mono text-[12px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ title, msg }: { title: string; msg: string }) {
  return (
    <div role="alert" className="lab-panel border-destructive/40 p-4 font-mono text-[12px]">
      <div className="text-destructive">{title}</div>
      <div className="mt-1 text-muted-foreground">{msg}</div>
    </div>
  );
}
