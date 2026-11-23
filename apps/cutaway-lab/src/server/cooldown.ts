import "server-only";

/** A conservative per-IP cooldown for the Live route (in memory, per server instance). */
export const COOLDOWN_MS = 30_000;
const last = new Map<string, number>();

export function checkCooldown(ip: string, now = Date.now()): number {
  const prev = last.get(ip);
  if (prev !== undefined && now - prev < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
  last.set(ip, now);
  if (last.size > 5000) for (const [k, t] of last) if (now - t > COOLDOWN_MS) last.delete(k);
  return 0;
}
