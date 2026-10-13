import { FINAL_STATES, type Envelope, type RequestState } from "./types";

export interface TrackedRequest {
  id: string;
  to: string;
  agent?: string;
  deadline: number;
  state: RequestState;
  history: { state: RequestState; at: number; note: string }[];
}

const ORDER: Partial<Record<RequestState, number>> = { sent: 0, accepted: 1, running: 2 };

/** Sender side request lifecycle: receipt, progress, one final state, deadline and timeout. */
export class RequestTracker {
  items = new Map<string, TrackedRequest>();

  create(env: Envelope, now: number, timeoutSeconds: number): TrackedRequest {
    const r: TrackedRequest = {
      id: env.id,
      to: env.to,
      agent: env.agent,
      deadline: now + timeoutSeconds * 1000,
      state: "sent",
      history: [{ state: "sent", at: now, note: `to ${env.agent ?? "?"} on ${env.to}` }],
    };
    this.items.set(r.id, r);
    return r;
  }

  /** Returns false when the transition is not allowed (final states are terminal, no going back). */
  update(id: string, state: RequestState, at: number, note = ""): boolean {
    const r = this.items.get(id);
    if (!r || isFinal(r.state)) return false;
    if (!isFinal(state) && (ORDER[state] ?? 0) < (ORDER[r.state] ?? 0)) return false;
    r.state = state;
    r.history.push({ state, at, note });
    return true;
  }

  /** Moves every open request past its deadline to timeout. Returns the ids that timed out. */
  checkTimeouts(now: number): string[] {
    const out: string[] = [];
    for (const r of this.items.values()) {
      if (!isFinal(r.state) && now > r.deadline) {
        this.update(r.id, "timeout", now, "deadline passed with no final response");
        out.push(r.id);
      }
    }
    return out;
  }
}

export function isFinal(state: RequestState): boolean {
  return FINAL_STATES.includes(state);
}
