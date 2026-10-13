"use client";

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FINAL_STATES, type RequestState } from "@/lib/mesh/types";
import type { PacketView, View } from "@/lib/view";
import { cn } from "@/lib/utils";

const clock = (t: number) => new Date(t).toISOString().slice(11, 19);

function StatusChip({ status }: { status: number }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-xs font-semibold",
        status >= 400 ? "bg-red-600 text-white" : "bg-green-600 text-white",
      )}
    >
      {status}
    </span>
  );
}

export function AuthPanel({ packet }: { packet?: PacketView }) {
  const order = ["tailnet range", "whois", "envelope", "policy", "from check", "stored"];
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Receiver auth {packet && <span className="font-mono font-normal text-muted-foreground">on {packet.to}</span>}</span>
          {packet && <StatusChip status={packet.status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5 px-3 text-xs">
        {!packet && <div className="text-muted-foreground">Run the story to see POST /msg checks.</div>}
        {packet &&
          order.map((name) => {
            const s = packet.steps.find((x) => x.name === name);
            const failed = packet.steps.find((x) => !x.ok);
            const icon = s ? (s.ok ? <CheckCircle2 className="size-4 text-green-600" /> : <XCircle className="size-4 text-red-600" />) : <CircleDashed className="size-4 text-muted-foreground/50" />;
            return (
              <div key={name} className={cn("flex items-start gap-2", !s && "opacity-50")}>
                {icon}
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-muted-foreground">{s ? s.detail : failed ? "not reached" : ""}</div>
                </div>
              </div>
            );
          })}
        {packet && packet.steps.some((s) => !s.ok && !order.includes(s.name)) && (
          <div className="text-red-600">{packet.error}</div>
        )}
        {packet?.wake && (
          <div className="mt-1 rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
            wake {JSON.stringify(packet.wake)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EnvelopePanel({ packets, selected, onSelect }: { packets: PacketView[]; selected?: PacketView; onSelect: (i: number) => void }) {
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">Envelope inspector</CardTitle>
        <div className="flex flex-wrap gap-1">
          {packets.map((p) => (
            <Button
              key={p.index}
              size="xs"
              variant={selected?.index === p.index ? "default" : "outline"}
              className={cn(p.status >= 400 && selected?.index !== p.index && "border-red-500 text-red-600")}
              onClick={() => onSelect(p.index)}
            >
              {p.from} to {p.to} {p.status}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 text-[11px] leading-snug">
          {selected ? JSON.stringify(selected.envelope, null, 2) : "No message yet."}
        </pre>
      </CardContent>
    </Card>
  );
}

export function FilePanel({ view, tamper, onTamper }: { view: View; tamper: boolean; onTamper: (v: boolean) => void }) {
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>File transfer (real SHA-256)</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="tamper" className="text-xs">Tamper bugs.json</Label>
            <Switch id="tamper" checked={tamper} onCheckedChange={onTamper} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-3 text-xs">
        {view.files.length === 0 && (
          <div className="text-muted-foreground">
            Files are copied into an outbox token dir and served at GET /f/&lt;token&gt;/&lt;name&gt; only to the to machine, for 24h.
          </div>
        )}
        {view.files.map((f) => (
          <div key={f.item.name} className={cn("grid gap-1.5 rounded-md border p-2", f.fetched && !f.ok && "border-red-500 bg-red-50 dark:bg-red-950/40")}>
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{f.item.name}</span>
              <span className="text-muted-foreground">
                {f.owner} to {f.fetcher}
                {f.tampered && <Badge className="ml-2 bg-amber-500 text-white">tampered on sender</Badge>}
              </span>
            </div>
            <div className="break-all font-mono text-[11px] text-muted-foreground">{f.item.url}</div>
            <div className="text-[11px] text-muted-foreground">expires {f.item.expires} | size {f.item.size} bytes</div>
            <div className="grid grid-cols-[72px_1fr] gap-x-2 font-mono text-[11px]">
              <span className="text-muted-foreground">expected</span>
              <span className="break-all">{f.item.sha256}</span>
              <span className="text-muted-foreground">computed</span>
              <span className={cn("break-all", f.fetched && (f.ok ? "text-green-700 dark:text-green-400" : "text-red-600"))}>
                {f.computed ?? (f.fetched ? "n/a" : "not fetched yet")}
              </span>
            </div>
            <Progress value={f.fetched ? 100 : 0} className={cn(f.fetched && !f.ok && "[&_[data-slot=progress-indicator]]:bg-red-600")} />
            {f.fetched && (
              <div className={cn("font-medium", f.ok ? "text-green-700 dark:text-green-400" : "text-red-600")}>
                {f.ok ? "SHA-256 match: .part renamed into inbox" : `Check failed: ${f.error}. .part deleted.`}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const STATE_COLOR: Partial<Record<RequestState, string>> = {
  completed: "bg-green-600 text-white",
  failed: "bg-red-600 text-white",
  rejected: "bg-red-600 text-white",
  blocked: "bg-red-600 text-white",
  timeout: "bg-amber-600 text-white",
  running: "bg-blue-600 text-white",
};

export function LifecyclePanel({ view }: { view: View }) {
  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">Request lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-3 text-xs">
        {view.requests.length === 0 && <div className="text-muted-foreground">No tracked requests yet.</div>}
        {view.requests.map((r) => {
          const left = Math.round((r.deadline - view.now) / 1000);
          return (
            <div key={r.id} className="grid gap-1 rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.label}</span>
                <Badge className={STATE_COLOR[r.state] ?? ""} variant={STATE_COLOR[r.state] ? "default" : "secondary"}>
                  {r.state}
                </Badge>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                id {r.id} | on {r.owner} | {FINAL_STATES.includes(r.state) ? "closed" : left > 0 ? `deadline in ${Math.floor(left / 60)}m ${left % 60}s` : "deadline passed"}
              </div>
              <ol className="grid gap-0.5 border-l pl-2">
                {r.history.map((h, i) => (
                  <li key={i} className="text-[11px]">
                    <span className="font-mono text-muted-foreground">{clock(h.at)}</span> <b>{h.state}</b> {h.note}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
