import { PERMISSIONS, type DotId, type Permission, type Permissions } from "./types";

/** Which saved permission a simulated tool needs. Unknown tools need a permission nobody has. */
export function permissionFor(tool: string): Permission | null {
  const ns = tool.split(".")[0];
  if (ns === "browser") return "browser";
  if (ns === "files") return "files";
  if (ns === "shell") return "shell";
  if (ns === "research") return "research";
  if (tool === "page.save") return "savePage";
  return null;
}

export type GateResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Server-side gate, run on every tool call. Mirrors upstream OpenDots:
 * capabilities are per Dot, start disabled, never fall back to the host,
 * and file paths must stay inside the Dot's own workspace.
 */
export function checkTool(
  dot: DotId,
  tool: string,
  args: Record<string, unknown>,
  perms: Permissions,
): GateResult {
  const needed = permissionFor(tool);
  if (!needed) return { allowed: false, reason: `unknown tool ${tool}` };
  if (!perms[dot][needed]) return { allowed: false, reason: `${needed === "savePage" ? "save page" : needed} permission disabled` };
  if (needed === "files") {
    const path = String(args.path ?? "");
    const parts = path.split(/[\\/]/);
    if (!path || path.startsWith("/") || /^[a-zA-Z]:/.test(path) || parts.includes("..")) {
      return { allowed: false, reason: `path outside ${dot} workspace` };
    }
  }
  return { allowed: true };
}

/** Coerce untrusted client input: anything not explicitly `true` is off. */
export function normalizePermissions(input: unknown): Permissions {
  const src = (input ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const one = (dot: DotId) =>
    Object.fromEntries(PERMISSIONS.map((p) => [p, src[dot]?.[p] === true])) as Permissions[DotId];
  return { researcher: one("researcher"), writer: one("writer") };
}
