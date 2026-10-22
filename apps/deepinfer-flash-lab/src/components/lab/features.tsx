import { Server } from "lucide-react";
import { cn } from "cn";
import { FEATURES } from "../../../data/benchmarks";
import { Panel, Src } from "./bits";

export function FeatureMap({ className }: { className?: string }) {
  return (
    <Panel channel="CH.07" title="Feature map" className={className} right={<Src k="readme" label="README feature list" />}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5 border border-border bg-[#03070a] p-2.5">
            <div className="font-mono text-[11.5px] font-semibold text-foreground">{f.name}</div>
            <div className="flex-1 text-[11.5px] leading-snug text-muted-foreground">{f.line}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase",
                  f.status === "shown here" && "border-pass/50 bg-pass/10 text-pass",
                  f.status === "simulated here" && "border-sim/50 bg-sim/10 text-sim",
                  f.status === "upstream only" && "border-border text-muted-foreground",
                )}
              >
                {f.status}
              </span>
              {f.note && <span className="font-mono text-[9.5px] text-muted-foreground">{f.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function HardwareNote({ className }: { className?: string }) {
  return (
    <Panel channel="CH.08" title="Hardware note" className={className}>
      <div className="flex gap-3">
        <Server className="mt-0.5 size-5 shrink-0 text-amber-glow" />
        <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <p>
            DeepInfer needs <span className="text-foreground">NVIDIA SM100 GPUs</span> or <span className="text-foreground">Huawei Ascend 950 NPUs</span>{" "}
            on Linux with Python 3.12 and CUDA 13 or CANN 9.2 <Src k="readme" />. It is <span className="text-amber-glow">not running here</span>.
          </p>
          <p>
            This page talks to the hosted DeepSeek API (model <code className="text-cyan-glow">deepseek-flash</code>), which serves the same
            DeepSeek-V4.1-Flash-1017 checkpoint DeepInfer loads by default <Src k="api" />. Without a key it replays recorded samples, labelled SAMPLE.
          </p>
          <p>Not in this DeepInfer release: a KV cache system, VE/Prefill/Decode disaggregation, load balancing across data-parallel replicas.</p>
        </div>
      </div>
    </Panel>
  );
}
