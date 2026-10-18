"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TimedLine } from "@/lib/engine";
import { clock, signedUsd, usd } from "@/lib/format";

const GRID = "grid grid-cols-[62px_50px_74px_minmax(0,1fr)] items-center gap-2";

function Row({ line }: { line: TimedLine }) {
  const edge =
    line.kind === "order"
      ? "border-l-[#ff9a2e]"
      : line.kind === "fill"
        ? line.value! >= 0
          ? "border-l-[#39ff88]"
          : "border-l-[#ff3b5c]"
        : "border-l-transparent";
  const body = (
    <div
      className={`${GRID} log-row border-b border-white/[0.06] border-l-2 ${edge} px-2 py-[5px] font-mono text-[11px] leading-none`}
    >
      <span className="text-[#5d6575]">{clock(line.at)}</span>
      {line.kind === "sys" ? (
        <span className="text-[#4a5160] tracking-[0.2em]">····</span>
      ) : (
        <span className="w-fit border border-white/80 px-1 py-[2px] text-[9px] tracking-wider text-white">
          {line.kind === "fill" ? "FILL" : "ORDER"}
        </span>
      )}
      <span
        className={
          line.kind === "fill" ? (line.value! >= 0 ? "neon-green" : "neon-red") : "text-transparent select-none"
        }
      >
        {line.kind === "fill" ? signedUsd(line.value!) : "."}
      </span>
      <span className={`truncate whitespace-nowrap ${line.kind === "sys" ? "text-[#6b7383]" : "text-[#c9cfda]"}`}>
        {line.kind === "order" && <span className="mr-2 text-[#ff9a2e]">{usd(line.amount!)}</span>}
        {line.desc}
      </span>
    </div>
  );
  if (line.kind !== "fill") return body;
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help" />}>{body}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="rounded-none border border-white bg-[#05070b] px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-[#d6dbe4] shadow-[0_0_18px_rgba(0,0,0,0.8)]"
      >
        <div>
          contract resolving via 12 consensus nodes
          <br />
          pending settlement on 3 chains
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ActivityLog({ lines }: { lines: TimedLine[] }) {
  // Hovering holds the list still so a row stays under the cursor for its tooltip.
  const [held, setHeld] = useState<TimedLine[] | null>(null);
  const shown = held ?? lines;
  return (
    <div
      className="log-scroll h-full overflow-y-auto overflow-x-hidden"
      onMouseEnter={() => setHeld(lines)}
      onMouseLeave={() => setHeld(null)}
    >
      {lines.length === 0 && <div className="px-2 py-3 font-mono text-[11px] text-[#5d6575]">awaiting feed ...</div>}
      {shown.map((l) => (
        <Row key={l.id} line={l} />
      ))}
    </div>
  );
}
