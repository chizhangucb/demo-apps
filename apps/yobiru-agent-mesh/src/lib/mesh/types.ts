// tailmsg v1 shapes, as described in the Yobiru SPEC. Everything here is simulated.

export type WakeLevel = "none" | "batch" | "now";
export const WAKE_LEVELS: WakeLevel[] = ["none", "batch", "now"];

export type RequestState =
  | "sent"
  | "accepted"
  | "running"
  | "completed"
  | "failed"
  | "rejected"
  | "blocked"
  | "timeout";

export const FINAL_STATES: RequestState[] = ["completed", "failed", "rejected", "blocked", "timeout"];

export interface FetchItem {
  name: string;
  url: string;
  sha256: string;
  size: number;
  mime: string;
  expires: string;
}

export interface Envelope {
  v: 1;
  id: string;
  from: string;
  to: string;
  ts: string;
  kind: string;
  text?: string;
  reply_to?: string;
  wake?: WakeLevel;
  agent?: string;
  from_agent?: string;
  fetch?: FetchItem[];
  request?: { timeout_seconds: number; deadline: string };
  response?: { request_id: string; state: RequestState };
}

export interface Identity {
  /** Tailscale FQDN, for example home-mac.example-tail.ts.net */
  fqdn: string;
  user: string;
  tags: string[];
}

export interface Policy {
  mode: "tailnet" | "allowlist";
  allow: string[];
  deny: string[];
  /** Per sender wake cap, keyed by a rule (hostname, FQDN, tag:NAME, user:LOGIN). */
  wake_policy: Record<string, WakeLevel>;
  default_max: WakeLevel;
  /** Local time window "HH:MM-HH:MM" in which now becomes batch. */
  quiet_hours: string | null;
  /** Max effective now wakes per hour per sender and agent. */
  wake_rate: number;
  agents: Record<string, { wake_max: WakeLevel }>;
}

/** A simulated HTTP request arriving at a receiver's POST /msg. */
export interface Packet {
  sourceIp: string;
  contentType: string;
  body: string;
}

export interface AuthStep {
  name: string;
  ok: boolean;
  detail: string;
}

export interface WakeDecision {
  requested: WakeLevel;
  effective: WakeLevel;
  reason: string | null;
}

export interface InboxEntry {
  envelope: Envelope;
  /** The whois peer: the trusted identity of the sender. */
  peer: Identity;
  receivedAt: number;
  wake: WakeDecision;
  acked: boolean;
}

export interface ReceiveResult {
  status: number;
  error?: string;
  steps: AuthStep[];
  entry?: InboxEntry;
}
