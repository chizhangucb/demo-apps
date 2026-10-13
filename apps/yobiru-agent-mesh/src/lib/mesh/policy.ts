import type { Identity, Policy } from "./types";

export function shortName(fqdn: string): string {
  return fqdn.split(".")[0];
}

/** A rule is a hostname, an FQDN, tag:NAME or user:LOGIN. */
export function matchesRule(rule: string, peer: Identity): boolean {
  const r = rule.trim();
  if (!r) return false;
  if (r.startsWith("tag:")) return peer.tags.includes(r);
  if (r.startsWith("user:")) return peer.user === r.slice(5);
  return r === peer.fqdn || r === shortName(peer.fqdn);
}

export type PolicyResult = { ok: true; detail: string } | { ok: false; detail: string };

/** deny always wins; tailnet admits any authenticated peer; allowlist needs an allow match. */
export function evaluatePolicy(policy: Policy, peer: Identity): PolicyResult {
  const denied = policy.deny.find((r) => matchesRule(r, peer));
  if (denied) return { ok: false, detail: `policy denied: deny rule "${denied}"` };
  if (policy.mode === "tailnet") return { ok: true, detail: "tailnet mode admits any authenticated peer" };
  const allowed = policy.allow.find((r) => matchesRule(r, peer));
  if (allowed) return { ok: true, detail: `allowlist match "${allowed}"` };
  return { ok: false, detail: "policy denied: no allowlist match" };
}
