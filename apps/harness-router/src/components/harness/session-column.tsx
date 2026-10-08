"use client";

import { Ban, CornerDownRight, Download, Eye, FileText, Send, Shuffle, TriangleAlert, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { columnRunning, type Column, type Turn } from "@/lib/runs";
import { cn } from "@/lib/utils";
import { isGapless } from "@/lib/uhp/reduce";
import type { OutputItem, UhpResponse } from "@/lib/uhp/types";
import { ACCENTS, Chip, shortId, StatusPill } from "./bits";

export interface HarnessView {
  id: string;
  name: string;
  base: string;
  defaultModel: string;
  accent: string;
}

interface Props {
  column: Column;
  harness: HarnessView;
  otherHarness: HarnessView;
  followUpPrompt: string;
  onCancel: () => void;
  onFollowUp: (text: string, harnessId?: string) => void;
}

export function SessionColumn({ column, harness, otherHarness, followUpPrompt, onCancel, onFollowUp }: Props) {
  const [tab, setTab] = useState("output");
  const [text, setText] = useState(followUpPrompt);
  const running = columnRunning(column);
  const last = column.turns.at(-1);
  const lastOk = [...column.turns].reverse().find((t) => t.response);
  const accent = ACCENTS[harness.accent] ?? ACCENTS.sky;
  const status = last?.error ? "error" : (last?.response?.status ?? "waiting");
  const allEvents = column.turns.reduce((n, t) => n + t.events.length, 0);
  const canFollowUp = !running && !!lastOk?.response && lastOk.response.status !== "in_progress";

  return (
    <Card className={cn("flex min-w-0 flex-col gap-0 overflow-hidden py-0 ring-1", accent.ring)}>
      <div className={cn("flex items-center gap-2 border-b px-3 py-2", accent.soft)}>
        <span className={cn("size-2.5 shrink-0 rounded-full", accent.dot)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{harness.name}</div>
          <div className="truncate font-mono text-[10.5px] text-muted-foreground">base: {harness.base}</div>
        </div>
        <StatusPill status={status} />
        <Button size="xs" variant="outline" disabled={!running} onClick={onCancel} aria-label={`Cancel ${harness.name}`}>
          <Ban /> Cancel
        </Button>
      </div>

      {lastOk?.response && <MetadataPanel response={lastOk.response} />}

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-3 mt-2 h-7 w-auto">
          <TabsTrigger value="output" className="text-xs">Output</TabsTrigger>
          <TabsTrigger value="raw" className="text-xs">Raw SSE ({allEvents})</TabsTrigger>
          <TabsTrigger value="files" className="text-xs">Files ({column.files.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="output">
          <FollowBottom deps={column.turns}>
            {column.turns.map((t, i) => (
              <TurnView key={t.key} turn={t} index={i} />
            ))}
          </FollowBottom>
        </TabsContent>
        <TabsContent value="raw" className="max-h-[520px] min-h-[220px] overflow-y-auto px-3 py-2">
          {column.turns.map((t, i) => (
            <RawEvents key={t.key} turn={t} index={i} />
          ))}
        </TabsContent>
        <TabsContent value="files" className="max-h-[520px] min-h-[220px] overflow-y-auto px-3 py-2">
          <FilesPanel column={column} />
        </TabsContent>
      </Tabs>

      <div className="space-y-1.5 border-t px-3 py-2">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canFollowUp && text.trim()) onFollowUp(text.trim());
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} className="h-7 text-xs" aria-label="Follow-up" />
          <Button type="submit" size="xs" disabled={!canFollowUp}>
            <Send /> Follow-up
          </Button>
        </form>
        <button
          type="button"
          disabled={!canFollowUp}
          onClick={() => onFollowUp(text.trim() || followUpPrompt, otherHarness.id)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Shuffle className="size-3" /> Continue this session on {otherHarness.name} instead (expect 409)
        </button>
      </div>
    </Card>
  );
}

/** Scrolls to the newest output as it streams in. */
function FollowBottom({ deps, children }: { deps: unknown; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [deps]);
  return (
    <div ref={ref} className="max-h-[520px] min-h-[220px] space-y-3 overflow-y-auto px-3 py-2">
      {children}
    </div>
  );
}

function MetadataPanel({ response: r }: { response: UhpResponse }) {
  const m = r.metadata;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-b px-3 py-2 font-mono text-[10.5px]">
      <dt className="text-muted-foreground">session</dt>
      <dd className="truncate" title={m.session_id}>{shortId(m.session_id, 14)}</dd>
      <dt className="text-muted-foreground">response</dt>
      <dd className="truncate" title={r.id}>{shortId(r.id, 14)}</dd>
      <dt className="text-muted-foreground">model</dt>
      <dd className="truncate">
        {r.model}
        {m.model_fallback && <span className="ml-1 rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300">fallback</span>}
      </dd>
      {m.model_fallback && (
        <>
          <dt className="text-muted-foreground">requested</dt>
          <dd className="whitespace-normal text-amber-700 dark:text-amber-300" title={m.model_fallback_reason}>
            {m.requested_model}: {m.model_fallback_reason}
          </dd>
        </>
      )}
      {m.ignored_fields && (
        <>
          <dt className="text-muted-foreground">ignored</dt>
          <dd>[{m.ignored_fields.map((f) => `"${f}"`).join(", ")}]</dd>
        </>
      )}
      <dt className="text-muted-foreground">usage</dt>
      <dd>
        {r.usage ? (
          `${r.usage.input_tokens} in / ${r.usage.output_tokens} out`
        ) : r.status === "in_progress" ? (
          <span className="text-muted-foreground">reported when the task ends</span>
        ) : (
          <span className="text-violet-700 dark:text-violet-300">null (not reported, never a fake 0)</span>
        )}
      </dd>
      {r.incomplete_details && (
        <>
          <dt className="text-muted-foreground">incomplete</dt>
          <dd className="text-amber-700 dark:text-amber-300">reason: {r.incomplete_details.reason}</dd>
        </>
      )}
    </dl>
  );
}

function TurnView({ turn, index }: { turn: Turn; index: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1.5 text-xs">
        <CornerDownRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <span className="font-medium">{index === 0 ? "Task" : `Follow-up ${index}`}:</span> {turn.prompt}
          {"previous_response_id" in turn.request && (
            <div className="truncate font-mono text-[10px] text-muted-foreground">previous_response_id: {shortId(String(turn.request.previous_response_id), 14)}</div>
          )}
        </div>
      </div>
      {turn.error && <ErrorCard turn={turn} />}
      {turn.response?.output.map((item) => (
        <ItemView key={item.id} item={item} />
      ))}
      {turn.response && turn.response.status !== "in_progress" && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusPill status={turn.response.status} />
          {turn.response.status === "cancelled" && <span>partial output kept; session stays continuable</span>}
          {turn.response.status === "incomplete" && <span>step budget hit (max_step), not completed</span>}
        </div>
      )}
      {turn.cancelNote && <p className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">{turn.cancelNote}</p>}
    </div>
  );
}

function ErrorCard({ turn }: { turn: Turn }) {
  const e = turn.error!;
  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-300">
        <TriangleAlert className="size-3.5" /> HTTP {e.status} · {e.envelope.error.code}
      </div>
      <p className="mt-1">{e.envelope.error.message}</p>
      <pre className="mt-1.5 overflow-x-auto rounded bg-background/70 p-1.5 font-mono text-[10px] leading-snug">{JSON.stringify(e.envelope, null, 2)}</pre>
    </div>
  );
}

function ItemView({ item }: { item: OutputItem }) {
  const live = item.status === "in_progress";
  const cut = item.status === "incomplete";
  switch (item.type) {
    case "reasoning":
      return (
        <div className="rounded-md border border-dashed px-2 py-1.5 text-xs italic text-muted-foreground">
          <div className="mb-0.5 not-italic font-mono text-[10px] uppercase tracking-wide">reasoning summary{cut && " · incomplete"}</div>
          {item.summary.map((s) => s.text).join("\n")}
          {live && <Caret />}
        </div>
      );
    case "function_call":
      return (
        <div className={cn("rounded-md border bg-muted/40 px-2 py-1.5", cut && "border-amber-500/50")}>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold">
            <Wrench className="size-3 text-muted-foreground" />
            {item.name}
            {live && <span className="text-[10px] font-normal text-blue-600">streaming args…</span>}
            {cut && <span className="text-[10px] font-normal text-amber-600">incomplete</span>}
          </div>
          <pre className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-all font-mono text-[10.5px] text-muted-foreground">{item.arguments}</pre>
        </div>
      );
    case "function_call_output":
      return (
        <pre className="-mt-1.5 ml-3 line-clamp-4 whitespace-pre-wrap break-all border-l-2 pl-2 font-mono text-[10.5px] text-muted-foreground">
          {item.output || (live ? "running…" : "(no output)")}
        </pre>
      );
    case "message":
      return (
        <div className="space-y-1.5 text-[13px] leading-relaxed">
          <div className="whitespace-pre-wrap">
            {item.content.map((c) => c.text).join("")}
            {live && <Caret />}
          </div>
          {cut && <div className="text-[11px] text-amber-600">message cut off by cancel</div>}
          <div className="flex flex-wrap gap-1">
            {item.content.flatMap((c) => c.annotations).map((a) => (
              <a key={a.file_id} href={a.download_url} download={a.filename} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10.5px] hover:bg-muted">
                <FileText className="size-3" /> {a.filename}
              </a>
            ))}
          </div>
        </div>
      );
    default:
      return <Chip>unknown item type</Chip>;
  }
}

const Caret = () => <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground/60 align-middle" />;

function RawEvents({ turn, index }: { turn: Turn; index: number }) {
  const [open, setOpen] = useState<number | null>(null);
  if (turn.error) return <p className="py-1 text-[11px] text-muted-foreground">Turn {index + 1}: HTTP {turn.error.status}, no stream.</p>;
  const gapless = isGapless(turn.events);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-2 text-[11px]">
        <span className="font-medium">Turn {index + 1}</span>
        <span className="text-muted-foreground">{turn.events.length} events</span>
        <Badge variant={gapless ? "secondary" : "destructive"} className="h-4 text-[10px]">
          {gapless ? "✓ no gaps in sequence_number" : "gap detected"}
        </Badge>
      </div>
      <ol className="space-y-px font-mono text-[10.5px]">
        {turn.events.map((e) => (
          <li key={e.sequence_number}>
            <button type="button" onClick={() => setOpen(open === e.sequence_number ? null : e.sequence_number)} className="flex w-full gap-2 rounded px-1 text-left hover:bg-muted">
              <span className="w-7 shrink-0 text-right text-muted-foreground">{e.sequence_number}</span>
              <span className={cn("truncate", e.type.startsWith("response.output_text") && "text-blue-600 dark:text-blue-400", e.type.includes("function_call") && "text-orange-600 dark:text-orange-400", (e.type === "response.failed" || e.type === "error") && "text-red-600")}>
                {e.type}
              </span>
            </button>
            {open === e.sequence_number && (
              <pre className="my-1 overflow-x-auto rounded bg-muted p-1.5 text-[10px] leading-snug">{JSON.stringify(e, null, 2)}</pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FilesPanel({ column }: { column: Column }) {
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const urls = new Map(
    column.turns.flatMap((t) => t.response?.output ?? []).flatMap((o) => (o.type === "message" ? o.content.flatMap((c) => c.annotations) : [])).map((a) => [a.file_id, a.download_url]),
  );
  const sessionId = column.turns.find((t) => t.response)?.response?.metadata.session_id;
  if (!column.files.length) return <p className="py-2 text-xs text-muted-foreground">No artifacts yet. Files appear when a turn completes.</p>;
  return (
    <div className="space-y-2">
      <p className="truncate font-mono text-[10px] text-muted-foreground">GET /v1/sessions/{sessionId ? shortId(sessionId, 12) : "…"}/files</p>
      <ul className="space-y-1">
        {column.files.map((f) => {
          const url = urls.get(f.id) ?? `/api/uhp/v1/containers/${f.container_id}/files/${f.id}/content`;
          return (
            <li key={f.id} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono">{f.filename}</span>
              <span className="text-[10px] text-muted-foreground">{f.bytes} B</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Preview ${f.filename}`}
                onClick={async () => setPreview({ name: f.filename, text: await (await fetch(url)).text() })}
              >
                <Eye />
              </Button>
              <a href={url} download={f.filename} aria-label={`Download ${f.filename}`} className="inline-flex size-6 items-center justify-center rounded hover:bg-muted">
                <Download className="size-3.5" />
              </a>
            </li>
          );
        })}
      </ul>
      {preview && (
        <div className="rounded border">
          <div className="border-b bg-muted/50 px-2 py-1 font-mono text-[10.5px]">{preview.name} · served with X-Content-Type-Options: nosniff</div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-2 font-mono text-[10.5px]">{preview.text}</pre>
        </div>
      )}
    </div>
  );
}
