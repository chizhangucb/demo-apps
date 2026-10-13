import { byteLength, MAX_BODY_BYTES, validateEnvelope } from "./envelope";
import { evaluatePolicy } from "./policy";
import { computeWake, HOUR_MS } from "./wake";
import type { AuthStep, Identity, InboxEntry, Packet, Policy, ReceiveResult } from "./types";

export interface ReceiverState {
  identity: Identity;
  policy: Policy;
  agents: string[];
  utcOffsetHours: number;
  inbox: InboxEntry[];
  wakeLog: { sender: string; agent: string; at: number }[];
}

/** 100.64.0.0/10 or fd7a:115c:a1e0::/48 */
export function isTailnetAddress(ip: string): boolean {
  if (ip.toLowerCase().startsWith("fd7a:115c:a1e0:")) return true;
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 100 && p[1] >= 64 && p[1] <= 127;
}

export function localMinutes(now: number, utcOffsetHours: number): number {
  const d = new Date(now + utcOffsetHours * HOUR_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * POST /msg on a receiver. Order: content type, size, tailnet source, whois, envelope format,
 * local policy (deny wins), from equals whois identity, duplicate id, then store and compute wake.
 */
export function receive(
  rx: ReceiverState,
  packet: Packet,
  whois: (ip: string) => Identity | undefined,
  now: number,
): ReceiveResult {
  const steps: AuthStep[] = [];
  const fail = (status: number, name: string, detail: string): ReceiveResult => {
    steps.push({ name, ok: false, detail });
    return { status, error: detail, steps };
  };

  if (!/^application\/json\b/i.test(packet.contentType)) return fail(415, "content type", "not JSON");
  const size = byteLength(packet.body);
  if (size > MAX_BODY_BYTES) return fail(413, "size", `${size} bytes is over the 256 KiB cap`);

  if (!isTailnetAddress(packet.sourceIp)) return fail(403, "tailnet range", `${packet.sourceIp} is not a tailnet address`);
  steps.push({ name: "tailnet range", ok: true, detail: `${packet.sourceIp} in 100.64.0.0/10` });

  const peer = whois(packet.sourceIp);
  if (!peer) return fail(403, "whois", `tailscale whois ${packet.sourceIp}: unknown peer`);
  steps.push({ name: "whois", ok: true, detail: `${peer.fqdn} (${peer.user}${peer.tags.length ? ", " + peer.tags.join(", ") : ""})` });

  let parsed: unknown;
  try {
    parsed = JSON.parse(packet.body);
  } catch {
    return fail(400, "envelope", "body is not valid JSON");
  }
  const v = validateEnvelope(parsed);
  if (!v.ok) return fail(400, "envelope", v.error);
  const env = v.envelope;
  if (env.to !== rx.identity.fqdn) return fail(400, "envelope", `to ${env.to} is not this machine`);
  steps.push({ name: "envelope", ok: true, detail: `v1 ${env.kind}, ${size} bytes` });

  const pol = evaluatePolicy(rx.policy, peer);
  if (!pol.ok) return fail(403, "policy", pol.detail);
  steps.push({ name: "policy", ok: true, detail: pol.detail });

  if (env.from !== peer.fqdn) return fail(403, "from check", `from ${env.from} does not match whois ${peer.fqdn}`);
  steps.push({ name: "from check", ok: true, detail: "from matches whois identity" });

  if (rx.inbox.some((e) => e.envelope.id === env.id)) {
    steps.push({ name: "duplicate", ok: true, detail: `id ${env.id} already stored` });
    return { status: 200, steps };
  }

  const agent = env.agent ?? rx.agents[0];
  const recentNowWakes = rx.wakeLog.filter((w) => w.sender === peer.fqdn && w.agent === agent && now - w.at < HOUR_MS).length;
  const wake = computeWake(env.wake ?? "batch", {
    policy: rx.policy,
    peer,
    agent: env.agent,
    knownAgents: rx.agents,
    localMinutes: localMinutes(now, rx.utcOffsetHours),
    recentNowWakes,
  });
  if (wake.effective === "now") rx.wakeLog.push({ sender: peer.fqdn, agent, at: now });

  const entry: InboxEntry = { envelope: env, peer, receivedAt: now, wake, acked: false };
  rx.inbox.push(entry);
  steps.push({ name: "stored", ok: true, detail: "accepted into inbox (delivered, not processed)" });
  return { status: 202, steps, entry };
}
