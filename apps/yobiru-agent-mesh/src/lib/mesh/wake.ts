import { matchesRule } from "./policy";
import type { Identity, Policy, WakeDecision, WakeLevel } from "./types";

const RANK: Record<WakeLevel, number> = { none: 0, batch: 1, now: 2 };
const minLevel = (a: WakeLevel, b: WakeLevel) => (RANK[a] <= RANK[b] ? a : b);

export const HOUR_MS = 3_600_000;

/** Is local time (minutes since midnight) inside "HH:MM-HH:MM"? Windows may wrap midnight. */
export function inQuietHours(window: string | null, localMinutes: number): boolean {
  if (!window) return false;
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(window.trim());
  if (!m) return false;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (start === end) return false;
  return start < end ? localMinutes >= start && localMinutes < end : localMinutes >= start || localMinutes < end;
}

export interface WakeContext {
  policy: Policy;
  peer: Identity;
  agent: string | undefined;
  knownAgents: string[];
  /** Receiver local time in minutes since midnight. */
  localMinutes: number;
  /** Effective now wakes this receiver already granted to this sender and agent in the last hour. */
  recentNowWakes: number;
}

/** The receiver only ever downgrades the requested wake level. */
export function computeWake(requested: WakeLevel, ctx: WakeContext): WakeDecision {
  let effective = requested;
  const reasons: string[] = [];
  const lower = (to: WakeLevel, reason: string) => {
    const next = minLevel(effective, to);
    if (next !== effective) {
      effective = next;
      reasons.push(reason);
    }
  };

  const capRule = Object.keys(ctx.policy.wake_policy).find((r) => matchesRule(r, ctx.peer));
  if (capRule) lower(ctx.policy.wake_policy[capRule], `wake_policy cap for ${capRule}`);
  else lower(ctx.policy.default_max, "default_max");

  if (effective === "now" && inQuietHours(ctx.policy.quiet_hours, ctx.localMinutes)) lower("batch", "quiet hours");
  if (effective === "now" && ctx.recentNowWakes >= ctx.policy.wake_rate) lower("batch", "wake rate limit");

  if (ctx.agent && !ctx.knownAgents.includes(ctx.agent)) lower("batch", `unknown agent ${ctx.agent}`);
  else if (ctx.agent && ctx.policy.agents[ctx.agent]) lower(ctx.policy.agents[ctx.agent].wake_max, `wake_max for ${ctx.agent}`);

  return { requested, effective, reason: reasons.length ? reasons.join("; ") : null };
}
