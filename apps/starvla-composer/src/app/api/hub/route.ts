import { HUB_BASE, type HubListResult, type HubResult, isOfficialRepo, parseHubList, parseHubModel } from "@/lib/hub";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const fail = (reason: string, status = 200) =>
  Response.json({ ok: false, live: false, fetchedAt: new Date().toISOString(), reason } satisfies HubResult, {
    status,
    headers: { "cache-control": "no-store" },
  });

async function hubFetch(path: string): Promise<unknown> {
  const res = await fetch(`${HUB_BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Hugging Face Hub returned HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /api/hub?repo=StarVLA/<name>  one official model card from the public Hub API
 * GET /api/hub?list=1               the live StarVLA author list, diffed against the vendored snapshot
 * Add &simulate=offline to exercise the unavailable path on purpose.
 * No API key, no secrets, single attempt, 8 s timeout.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return fail("Too many lookups from this address. Wait a minute and retry.", 429);

  if (url.searchParams.get("simulate") === "offline") {
    return fail("Simulated offline: the live lookup was skipped on purpose.");
  }

  const fetchedAt = new Date().toISOString();
  try {
    if (url.searchParams.get("list")) {
      const parsed = parseHubList(await hubFetch("/models?author=StarVLA&limit=200"));
      if (!parsed) return fail("Unexpected payload from the Hub list endpoint.");
      return Response.json(
        { ok: true, live: true, fetchedAt, count: parsed.ids.length, ...parsed } satisfies HubListResult,
        { headers: { "cache-control": "no-store" } },
      );
    }
    const repo = url.searchParams.get("repo") ?? "";
    if (!isOfficialRepo(repo)) return fail("Only the vendored official StarVLA repo ids can be looked up.", 400);
    const model = parseHubModel(await hubFetch(`/models/${repo}`));
    if (!model) return fail("Unexpected payload from the Hub model endpoint.");
    return Response.json({ ok: true, live: true, fetchedAt, model } satisfies HubResult, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return fail(timedOut ? `Hub did not answer within ${TIMEOUT_MS / 1000} s.` : err instanceof Error ? err.message : "Network error.");
  }
}
