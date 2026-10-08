"use client";

import { Ban, Paperclip, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { columnRunning, isTerminalEvent, newTurn, reducer, summarise, turnRunning, type Column } from "@/lib/runs";
import { cn } from "@/lib/utils";
import { API_BASE, readError, readSse, toDataUrl } from "@/lib/uhp/client";
import type { Harness, HarnessModel, SessionFile, UhpResponse } from "@/lib/uhp/types";
import { ACCENTS, Chip, StatusPill } from "./bits";
import { SessionColumn, type HarnessView } from "./session-column";

export interface HarnessStyleView {
  id: string;
  accent: string;
  blurb: string;
  tools: string[];
  reasoning: boolean;
  reportsUsage: boolean;
}

export interface TaskView {
  id: string;
  title: string;
  blurb: string;
  prompt: string;
  followUpPrompt: string;
  inputFile?: { filename: string; mimeType: string; content: string };
}

const STORAGE_KEY = "harness-router:columns:v1";
const MODEL_SUGGESTIONS = ["gpt-5.4", "claude-sonnet-4.6", "nousresearch/hermes-4-405b"];

async function fetchStored(id: string): Promise<UhpResponse | null> {
  const res = await fetch(`${API_BASE}/v1/responses/${id}`);
  return res.ok ? ((await res.json()) as UhpResponse) : null;
}

let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function Playground({ styles, tasks }: { styles: HarnessStyleView[]; tasks: TaskView[] }) {
  const [harnesses, setHarnesses] = useState<Harness[]>([]);
  const [models, setModels] = useState<Record<string, HarnessModel[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [prompt, setPrompt] = useState(tasks[0].prompt);
  const [attach, setAttach] = useState(true);
  const [model, setModel] = useState("");
  const [maxStep, setMaxStep] = useState("");
  const [sendTools, setSendTools] = useState(false);
  const [columns, dispatch] = useReducer(reducer, []);
  const controllers = useRef(new Map<string, AbortController>());
  const terminalWaiters = useRef(new Map<string, () => void>());
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const task = tasks.find((t) => t.id === taskId)!;
  const styleOf = useCallback((id: string) => styles.find((s) => s.id === id), [styles]);

  // Harness cards come from the protocol: GET /v1/harnesses and /v1/harnesses/{id}/models.
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/v1/harnesses`);
      const { harnesses: list } = (await res.json()) as { harnesses: Harness[] };
      setHarnesses(list);
      setSelected((s) => (s.length ? s : list.slice(0, 3).map((h) => h.id)));
      const entries = await Promise.all(
        list.map(async (h) => [h.id, ((await (await fetch(`${API_BASE}/v1/harnesses/${h.id}/models`)).json()) as { data: HarnessModel[] }).data] as const),
      );
      setModels(Object.fromEntries(entries));
    })().catch(() => toast.error("Could not load harnesses"));
  }, []);

  const view = useCallback(
    (id: string): HarnessView => {
      const h = harnesses.find((x) => x.id === id);
      return { id, name: h?.name ?? id, base: h?.base ?? "?", defaultModel: h?.defaultModel ?? "", accent: styleOf(id)?.accent ?? "sky" };
    },
    [harnesses, styleOf],
  );

  // ---- persistence: sessions survive reloads and serverless cold starts

  useEffect(() => {
    let saved: Column[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Column[];
    } catch {
      saved = [];
    }
    if (!saved.length) return;
    dispatch({ type: "reset", columns: saved });
    // Turns that were mid-stream on reload: ask the server for the stored response.
    for (const c of saved) {
      for (const t of c.turns) {
        if (!turnRunning(t) || !t.response) continue;
        void fetchStored(t.response.id).then((response) => response && dispatch({ type: "stored", column: c.key, turn: t.key, response }));
      }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      /* storage full or blocked: the session still works in memory */
    }
  }, [columns]);

  // ---- request body: identical for every harness except metadata.harness_id

  const buildBody = useCallback(
    (harnessId: string): Record<string, unknown> => {
      const input =
        attach && task.inputFile
          ? [
              {
                role: "user",
                content: [
                  { type: "input_text", text: prompt },
                  { type: "input_file", filename: task.inputFile.filename, file_data: toDataUrl(task.inputFile.mimeType, task.inputFile.content) },
                ],
              },
            ]
          : prompt;
      const body: Record<string, unknown> = { input };
      if (model.trim()) body.model = model.trim();
      body.metadata = { harness_id: harnessId, task_id: task.id };
      if (maxStep.trim() !== "") body.max_step = Number(maxStep);
      if (sendTools) body.tools = [];
      body.stream = true;
      return body;
    },
    [attach, task, prompt, model, maxStep, sendTools],
  );

  async function refreshFiles(col: string, response: UhpResponse) {
    const sid = response.metadata.session_id;
    const res = await fetch(`${API_BASE}/v1/sessions/${sid}/files?latest=${encodeURIComponent(response.id)}`);
    if (res.ok) dispatch({ type: "files", column: col, files: ((await res.json()) as { files: SessionFile[] }).files });
  }

  async function startTurn(col: string, promptText: string, body: Record<string, unknown>) {
    const turn = newTurn(uid("t"), promptText, body);
    dispatch({ type: "addTurn", column: col, turn });
    const ctrl = new AbortController();
    controllers.current.set(turn.key, ctrl);
    let last: UhpResponse | null = null;
    try {
      const res = await fetch(`${API_BASE}/v1/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "UHP-Version": "2026-10-04" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        dispatch({ type: "error", column: col, turn: turn.key, error: await readError(res) });
        return;
      }
      await readSse(res, (event) => {
        dispatch({ type: "event", column: col, turn: turn.key, event });
        if ("response" in event) last = event.response;
        if (isTerminalEvent(event)) terminalWaiters.current.get(turn.key)?.();
      });
      dispatch({ type: "streamClosed", column: col, turn: turn.key });
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error(`Stream error: ${(err as Error).message}`);
    } finally {
      controllers.current.delete(turn.key);
      terminalWaiters.current.delete(turn.key);
      const final = last as UhpResponse | null;
      if (final) void refreshFiles(col, final);
    }
  }

  async function run() {
    if (!selected.length) return toast.message("Pick at least one harness");
    const cols: Column[] = selected.map((harnessId) => ({ key: uid("c"), harnessId, turns: [], files: [] }));
    dispatch({ type: "reset", columns: cols });
    await Promise.all(cols.map((c) => startTurn(c.key, prompt, buildBody(c.harnessId))));
  }

  /** Cancel: POST /cancel, then wait up to 1s for the terminal event before trusting the cancel reply. */
  async function cancel(colKey: string) {
    const col = columnsRef.current.find((c) => c.key === colKey);
    const turn = col?.turns.at(-1);
    if (!col || !turn || !turnRunning(turn)) return;
    const id = turn.response?.id;
    if (!id) return controllers.current.get(turn.key)?.abort();
    dispatch({ type: "cancelRequested", column: colKey, turn: turn.key });
    const terminal = new Promise<boolean>((resolve) => {
      terminalWaiters.current.set(turn.key, () => resolve(true));
      setTimeout(() => resolve(false), 1000);
    });
    const res = await fetch(`${API_BASE}/v1/responses/${id}/cancel`, { method: "POST" });
    if (!res.ok) return toast.error("Cancel failed");
    const stored = (await res.json()) as UhpResponse;
    if (!(await terminal)) {
      controllers.current.get(turn.key)?.abort();
      dispatch({ type: "cancelFallback", column: colKey, turn: turn.key, response: stored });
      void refreshFiles(colKey, stored);
    }
  }

  function followUp(col: Column, text: string, harnessOverride?: string) {
    const prev = [...col.turns].reverse().find((t) => t.response)?.response;
    if (!prev) return;
    const body: Record<string, unknown> = {
      input: text,
      previous_response_id: prev.id,
      metadata: { harness_id: harnessOverride ?? col.harnessId },
      stream: true,
    };
    void startTurn(col.key, text, body);
  }

  const running = columns.some(columnRunning);
  const previewBody = useMemo(() => buildBody(selected[0] ?? harnesses[0]?.id ?? "chrn_…"), [buildBody, selected, harnesses]);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>1 · Harnesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {harnesses.map((h) => {
              const s = styleOf(h.id);
              const accent = ACCENTS[s?.accent ?? "sky"];
              const on = selected.includes(h.id);
              return (
                <label key={h.id} className={cn("flex cursor-pointer gap-2.5 rounded-lg border p-2 transition", on && cn("ring-1", accent.ring, accent.soft))}>
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => setSelected((cur) => (v ? [...cur, h.id] : cur.filter((x) => x !== h.id)).sort((a, b) => harnesses.findIndex((x) => x.id === a) - harnesses.findIndex((x) => x.id === b)))}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", accent.dot)} />
                      <span className="text-sm font-medium">{h.name}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">base: {h.base}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">default {h.defaultModel}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s?.tools.map((t) => <Chip key={t}>{t}</Chip>)}
                      <Chip className={s?.reasoning ? "" : "opacity-60"}>{s?.reasoning ? "reasoning" : "no reasoning"}</Chip>
                      <Chip className={s?.reportsUsage ? "" : "border-violet-500/40 text-violet-700 dark:text-violet-300"}>{s?.reportsUsage ? "usage" : "usage: null"}</Chip>
                    </div>
                    {models[h.id] && (
                      <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={models[h.id].map((m) => `${m.id}${m.available ? "" : " (unavailable)"}`).join(", ")}>
                        models: {models[h.id].map((m) => (m.available ? m.id : `${m.id}✕`)).join(", ")}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
            {!harnesses.length && <p className="text-xs text-muted-foreground">Loading GET /v1/harnesses…</p>}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>2 · Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="grid gap-1.5">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTaskId(t.id);
                    setPrompt(t.prompt);
                  }}
                  className={cn("rounded-lg border px-2.5 py-1.5 text-left text-sm transition hover:bg-muted", t.id === taskId && "border-foreground/40 bg-muted")}
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">{t.blurb}</div>
                </button>
              ))}
            </div>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="text-xs" aria-label="Task input" />
            {task.inputFile && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={attach} onCheckedChange={setAttach} size="sm" />
                <Paperclip className="size-3" /> attach <span className="font-mono">{task.inputFile.filename}</span> as input_file
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-muted-foreground">
                model override
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="harness default" list="model-suggestions" className="h-7 font-mono text-xs" />
                <datalist id="model-suggestions">
                  {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                max_step
                <Input value={maxStep} onChange={(e) => setMaxStep(e.target.value.replace(/\D/g, ""))} placeholder="none" inputMode="numeric" className="h-7 font-mono text-xs" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={sendTools} onCheckedChange={setSendTools} size="sm" /> send <span className="font-mono">tools: []</span> too (reserved, ignored)
            </label>
          </CardContent>
        </Card>

        <RequestPreview body={previewBody} harnessIds={selected} names={selected.map((id) => view(id).name)} />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={running || !selected.length}>
            <Play /> {selected.length > 1 ? `Compare on ${selected.length} harnesses` : "Run"}
          </Button>
          <Button variant="outline" disabled={!running} onClick={() => columns.filter(columnRunning).forEach((c) => void cancel(c.key))}>
            <Ban /> Cancel all
          </Button>
          <Button variant="ghost" disabled={running || !columns.length} onClick={() => dispatch({ type: "reset", columns: [] })}>
            <Trash2 /> Clear
          </Button>
          <span className="text-xs text-muted-foreground">
            {selected.length} × <span className="font-mono">POST /api/uhp/v1/responses</span>, same body, only <span className="font-mono">metadata.harness_id</span> differs
          </span>
        </div>

        {columns.length ? (
          <>
            <div className={cn("grid gap-3", columns.length === 1 ? "grid-cols-1" : columns.length === 2 ? "md:grid-cols-2" : columns.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 2xl:grid-cols-4")}>
              {columns.map((c) => {
                const others = harnesses.filter((h) => h.id !== c.harnessId);
                return (
                  <SessionColumn
                    key={c.key}
                    column={c}
                    harness={view(c.harnessId)}
                    otherHarness={view(others[0]?.id ?? c.harnessId)}
                    followUpPrompt={task.followUpPrompt}
                    onCancel={() => void cancel(c.key)}
                    onFollowUp={(text, h) => followUp(c, text, h)}
                  />
                );
              })}
            </div>
            <Differences columns={columns} view={view} />
          </>
        ) : (
          <Card className="items-center justify-center py-16 text-center text-sm text-muted-foreground">
            <p>Pick harnesses and a task, then press Run.</p>
            <p className="text-xs">Each harness gets the same Responses-compatible request and streams back its own session over SSE.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function RequestPreview({ body, harnessIds, names }: { body: Record<string, unknown>; harnessIds: string[]; names: string[] }) {
  // Shorten the inline file for display only; the request sends the full data URL.
  const shown = JSON.stringify(body, (k, v) => (k === "file_data" && typeof v === "string" && v.length > 48 ? `${v.slice(0, 44)}…` : v), 2);
  const lines = shown.split("\n");
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>3 · Request body</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 font-mono text-[10.5px] leading-[1.45]">
          {lines.map((line, i) => {
            const perHarness = /"harness_id"|"model":/.test(line);
            return (
              <div key={i} className={cn(perHarness && "-mx-2 bg-amber-300/30 px-2 font-semibold dark:bg-amber-500/20")}>
                {line}
              </div>
            );
          })}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          <span className="rounded bg-amber-300/40 px-1 dark:bg-amber-500/25">Highlighted</span> = the per-harness part. Everything else is byte-identical for{" "}
          {names.length ? names.join(", ") : "every harness"}.
        </p>
        {harnessIds.length > 1 && (
          <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
            {harnessIds.map((id, i) => (
              <li key={id} className="truncate">
                {names[i]}: &quot;harness_id&quot;: &quot;{id}&quot;
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Differences({ columns, view }: { columns: Column[]; view: (id: string) => HarnessView }) {
  const [, tick] = useState(0);
  const running = columns.some(columnRunning);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [running]);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Differences <Badge variant="secondary" className="font-normal">first turn of each session</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] text-muted-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-1 [&>th]:font-medium">
              <th>harness</th>
              <th>status</th>
              <th>model run</th>
              <th>reasoning</th>
              <th>steps</th>
              <th>tools used</th>
              <th>artifacts</th>
              <th>usage</th>
              <th>elapsed</th>
              <th>events</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => {
              const t = c.turns[0];
              const s = t && summarise(t);
              const h = view(c.harnessId);
              return (
                <tr key={c.key} className="border-t align-top [&>td]:px-2 [&>td]:py-1.5">
                  <td className="whitespace-nowrap font-medium">
                    <span className={cn("mr-1.5 inline-block size-2 rounded-full", ACCENTS[h.accent]?.dot)} />
                    {h.name}
                  </td>
                  {t?.error ? (
                    <td colSpan={9} className="text-red-700 dark:text-red-300">
                      HTTP {t.error.status} {t.error.envelope.error.code}: {t.error.envelope.error.message}
                    </td>
                  ) : s ? (
                    <>
                      <td><StatusPill status={s.status as UhpResponse["status"]} /></td>
                      <td className="font-mono">
                        {s.model}
                        {s.fallback && <span className="ml-1 text-amber-600">(fallback)</span>}
                      </td>
                      <td>{s.reasoning ? "yes" : "no"}</td>
                      <td className="font-mono">{s.steps}</td>
                      <td className="font-mono text-[11px]">{s.tools.join(", ") || "none"}</td>
                      <td className="font-mono">{s.artifacts}</td>
                      <td className={cn("font-mono", s.usage === "null" && "text-violet-700 dark:text-violet-300")}>{s.usage}</td>
                      <td className="font-mono">{s.elapsed}</td>
                      <td className="font-mono">{s.events}</td>
                    </>
                  ) : (
                    <td colSpan={9} className="text-muted-foreground">waiting…</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
