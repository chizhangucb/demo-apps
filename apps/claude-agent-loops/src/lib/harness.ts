import type { CriterionResult, LoopType, StopReason } from "@/lib/types";
import { isVerified } from "@/lib/verify";

export const LOOP_TYPES: { id: LoopType; label: string; stopsWhen: string; summary: string }[] = [
  {
    id: "turn",
    label: "Turn",
    stopsWhen: "the agent ends its turn",
    summary: "Classic agent loop: act, look at the result, keep going until the model says it's done.",
  },
  {
    id: "goal",
    label: "Goal",
    stopsWhen: "the verifier passes every criterion",
    summary: "Keep iterating against explicit verification criteria; the agent's own “done” is not enough.",
  },
  {
    id: "time",
    label: "Time",
    stopsWhen: "the check passes (re-runs every interval)",
    summary: "Wake on a fixed interval, re-check the world, sleep again — polling until the condition holds.",
  },
  {
    id: "proactive",
    label: "Proactive",
    stopsWhen: "the triggered work verifies, or the watch window closes",
    summary: "Idle on an event stream and only act when a trigger fires.",
  },
];

export const STOP_LABEL: Record<StopReason, string> = {
  verified: "Verified",
  "agent-done": "Agent ended turn",
  "turn-limit": "Turn limit",
  budget: "Budget spent",
  "script-exhausted": "Out of scripted steps",
  "window-closed": "Watch window closed",
  cancelled: "Cancelled",
  error: "Error",
};

export interface DecideInput {
  loopType: LoopType;
  results: CriterionResult[];
  agentDone: boolean;
  turn: number;
  maxTurns: number;
  tokensUsed: number;
  budget: number;
  moreSteps: boolean;
  intervalSec: number;
}

export type Decision = { action: "continue" | "stop"; reason: string; stop?: StopReason };

/** The only place loop types differ: after Evaluate, Continue or Stop? */
export function decide(d: DecideInput): Decision {
  const verified = isVerified(d.results);
  const failing = d.results.filter((r) => r.status === "fail").length;

  if (d.loopType === "turn") {
    if (d.agentDone)
      return {
        action: "stop",
        stop: "agent-done",
        reason: verified
          ? "Agent ended its turn — and the checks happen to pass."
          : `Agent ended its turn with ${failing} check${failing === 1 ? "" : "s"} still failing. A turn loop trusts the model.`,
      };
  } else if (verified) {
    return { action: "stop", stop: "verified", reason: "All verification criteria pass." };
  }

  if (d.tokensUsed >= d.budget)
    return { action: "stop", stop: "budget", reason: `Spent ${d.tokensUsed.toLocaleString()} of ${d.budget.toLocaleString()} tokens.` };
  if (d.turn >= d.maxTurns) return { action: "stop", stop: "turn-limit", reason: `Hit the ${d.maxTurns}-turn cap.` };
  if (!d.moreSteps)
    return d.loopType === "proactive"
      ? { action: "stop", stop: "window-closed", reason: "No more events in the watch window." }
      : { action: "stop", stop: "script-exhausted", reason: "The scripted agent has no further attempts." };

  switch (d.loopType) {
    case "turn":
      return { action: "continue", reason: "Agent has more to do — next turn." };
    case "goal":
      return { action: "continue", reason: `${failing} criteri${failing === 1 ? "on" : "a"} failing — feed the verifier notes back and retry.` };
    case "time":
      return { action: "continue", reason: `Not there yet — sleep ${d.intervalSec}s, then check again.` };
    case "proactive":
      return { action: "continue", reason: "Not resolved — go back to watching for the next trigger." };
  }
}

export function feedbackFrom(results: CriterionResult[]): string {
  const bad = results.filter((r) => r.status === "fail");
  return bad.length ? bad.map((r) => `✗ ${r.criterion}: ${r.note}`).join("\n") : "All checks passed.";
}
