import { describe, expect, test } from "bun:test";
import { MAX_BODY_BYTES, validateEnvelope } from "../src/lib/mesh/envelope";
import { fetchAndVerify, Outbox } from "../src/lib/mesh/files";
import { Mesh } from "../src/lib/mesh/mesh";
import { evaluatePolicy, matchesRule } from "../src/lib/mesh/policy";
import { isTailnetAddress } from "../src/lib/mesh/receiver";
import { RequestTracker } from "../src/lib/mesh/requests";
import { sha256Hex } from "../src/lib/mesh/sha256";
import type { Identity, Policy } from "../src/lib/mesh/types";
import { computeWake, inQuietHours, type WakeContext } from "../src/lib/mesh/wake";
import { DEFAULT_POLICIES, machineSpecs, PRESETS, type Policies } from "../src/lib/setup";
import { runStory } from "../src/lib/story";

const policies = (): Policies => structuredClone(DEFAULT_POLICIES);
const mesh = (p = policies()) => new Mesh(machineSpecs(p));
const cloudPeer: Identity = { fqdn: "cloud.example-tail.ts.net", user: "chi@github", tags: ["tag:cloud"] };
const base: Policy = {
  mode: "tailnet", allow: [], deny: [], wake_policy: {}, default_max: "batch",
  quiet_hours: null, wake_rate: 6, agents: {},
};
const valid = () => ({
  v: 1, id: "9f2c4e1ab07d33c5", from: "bot-box.example.ts.net", to: "dev-server.example.ts.net",
  ts: "2026-10-08T14:00:00Z", kind: "request", text: "Please review.", wake: "now", agent: "codex", from_agent: "grok",
  fetch: [{ name: "bugs.json", url: "http://bot-box.example.ts.net:7766/f/abc/bugs.json", sha256: "a".repeat(64), size: 1834, mime: "application/json", expires: "2026-10-09T14:00:00Z" }],
});

describe("envelope validation", () => {
  test("accepts the SPEC example", () => expect(validateEnvelope(valid()).ok).toBe(true));
  test("rejects unknown fields", () => {
    const r = validateEnvelope({ ...valid(), priority: "high" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unknown field");
  });
  test("rejects a bad wake value and v != 1", () => {
    expect(validateEnvelope({ ...valid(), wake: "asap" }).ok).toBe(false);
    expect(validateEnvelope({ ...valid(), v: 2 }).ok).toBe(false);
  });
  test("rejects a fetch URL not on the sender host", () => {
    const e = valid();
    e.fetch[0].url = "http://evil.example.ts.net:7766/f/abc/bugs.json";
    const r = validateEnvelope(e);
    expect(r.ok === false && r.error).toBe("fetch URL not on sender host");
  });
  test("receiver returns 413 over 256 KiB and 415 for non JSON", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const env = m.envelope(cloud, "home-mac", { kind: "text", text: "x".repeat(MAX_BODY_BYTES) });
    expect(m.send(cloud, env).status).toBe(413);
    const small = m.envelope(cloud, "home-mac", { kind: "text", text: "hi" });
    expect(m.send(cloud, small, { contentType: "text/plain" }).status).toBe(415);
  });
});

describe("auth pipeline", () => {
  test("tailnet range check", () => {
    expect(isTailnetAddress("100.64.0.1")).toBe(true);
    expect(isTailnetAddress("100.127.255.255")).toBe(true);
    expect(isTailnetAddress("100.128.0.1")).toBe(false);
    expect(isTailnetAddress("192.168.1.10")).toBe(false);
    expect(isTailnetAddress("fd7a:115c:a1e0::1")).toBe(true);
  });
  test("off tailnet source gets 403 before anything else", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const r = m.send(cloud, m.envelope(cloud, "home-mac", { kind: "text" }), { sourceIp: "203.0.113.9" });
    expect(r.status).toBe(403);
    expect(r.steps.map((s) => s.name)).toEqual(["tailnet range"]);
  });
  test("happy path runs every step in order and returns 202", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const r = m.send(cloud, m.envelope(cloud, "home-mac", { kind: "text", agent: "codex", from_agent: "grokbot" }));
    expect(r.status).toBe(202);
    expect(r.steps.map((s) => s.name)).toEqual(["tailnet range", "whois", "envelope", "policy", "from check", "stored"]);
  });
  test("duplicate id returns 200 and is stored once", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const env = m.envelope(cloud, "home-mac", { kind: "text" });
    expect(m.send(cloud, env).status).toBe(202);
    expect(m.send(cloud, env).status).toBe(200);
    expect(m.machine("home-mac").inbox.length).toBe(1);
  });
  test("spoofed from returns 403 even though the envelope is valid", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const env = m.envelope(cloud, "home-mac", { kind: "text" });
    env.from = "tokyo-server.example-tail.ts.net";
    const r = m.send(cloud, env);
    expect(r.status).toBe(403);
    expect(r.error).toContain("does not match whois");
  });
});

describe("policy", () => {
  test("rule kinds: hostname, FQDN, tag, user", () => {
    expect(matchesRule("cloud", cloudPeer)).toBe(true);
    expect(matchesRule("cloud.example-tail.ts.net", cloudPeer)).toBe(true);
    expect(matchesRule("tag:cloud", cloudPeer)).toBe(true);
    expect(matchesRule("user:chi@github", cloudPeer)).toBe(true);
    expect(matchesRule("tag:ci", cloudPeer)).toBe(false);
  });
  test("tailnet admits any peer, allowlist needs a match", () => {
    expect(evaluatePolicy(base, cloudPeer).ok).toBe(true);
    expect(evaluatePolicy({ ...base, mode: "allowlist" }, cloudPeer).ok).toBe(false);
    expect(evaluatePolicy({ ...base, mode: "allowlist", allow: ["tag:cloud"] }, cloudPeer).ok).toBe(true);
  });
  test("deny wins over allow and over tailnet mode", () => {
    expect(evaluatePolicy({ ...base, deny: ["cloud"] }, cloudPeer).ok).toBe(false);
    expect(evaluatePolicy({ ...base, mode: "allowlist", allow: ["cloud"], deny: ["user:chi@github"] }, cloudPeer).ok).toBe(false);
  });
  test("receiver returns 403 for a deny rule", () => {
    const p = policies();
    p["home-mac"].deny = ["cloud"];
    const m = mesh(p);
    const cloud = m.machine("cloud");
    const r = m.send(cloud, m.envelope(cloud, "home-mac", { kind: "text" }));
    expect(r.status).toBe(403);
    expect(r.error).toContain("deny rule");
  });
});

describe("wake", () => {
  const ctx = (over: Partial<WakeContext> = {}): WakeContext => ({
    policy: { ...base, wake_policy: { cloud: "now" } }, peer: cloudPeer, agent: "codex", knownAgents: ["codex"],
    localMinutes: 12 * 60, recentNowWakes: 0, ...over,
  });
  test("granted now stays now", () => expect(computeWake("now", ctx())).toEqual({ requested: "now", effective: "now", reason: null }));
  test("default_max caps senders without a wake_policy entry", () => {
    expect(computeWake("now", ctx({ policy: base }))).toEqual({ requested: "now", effective: "batch", reason: "default_max" });
  });
  test("quiet hours turn now into batch with a reason", () => {
    const d = computeWake("now", ctx({ policy: { ...base, wake_policy: { cloud: "now" }, quiet_hours: "22:00-07:00" }, localMinutes: 23 * 60 }));
    expect(d).toEqual({ requested: "now", effective: "batch", reason: "quiet hours" });
    expect(inQuietHours("22:00-07:00", 6 * 60)).toBe(true);
    expect(inQuietHours("22:00-07:00", 8 * 60)).toBe(false);
  });
  test("rate limit turns extra now into batch", () => {
    expect(computeWake("now", ctx({ recentNowWakes: 6 })).reason).toBe("wake rate limit");
  });
  test("per-agent wake_max and missing agent downgrade", () => {
    const p = { ...base, wake_policy: { cloud: "now" as const }, agents: { codex: { wake_max: "none" as const } } };
    expect(computeWake("now", ctx({ policy: p })).effective).toBe("none");
    expect(computeWake("now", ctx({ agent: "ghost" }))).toEqual({ requested: "now", effective: "batch", reason: "unknown agent ghost" });
  });
  test("never upgrades", () => expect(computeWake("none", ctx()).effective).toBe("none"));
  test("receiver counts its own now wakes for the rate limit", () => {
    const p = policies();
    p["home-mac"].wake_rate = 1;
    const m = mesh(p);
    const cloud = m.machine("cloud");
    const send = () => m.send(cloud, m.envelope(cloud, "home-mac", { kind: "text", wake: "now", agent: "codex" })).entry!.wake;
    expect(send().effective).toBe("now");
    expect(send()).toEqual({ requested: "now", effective: "batch", reason: "wake rate limit" });
  });
});

describe("files", () => {
  const bytes = new TextEncoder().encode('{"hello":"world"}');
  test("SHA-256 is real", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  test("grant, fetch and verify renames .part on match", async () => {
    const out = new Outbox("cloud.t.net");
    const item = await out.grant("tok", "a.json", "application/json", bytes, "home.t.net", 0);
    const disk = new Map<string, Uint8Array>();
    const r = await fetchAndVerify(item, out, "home.t.net", 1000, disk);
    expect(r.ok).toBe(true);
    expect([...disk.keys()]).toEqual(["a.json"]);
  });
  test("only the to machine may fetch, and grants expire", async () => {
    const out = new Outbox("cloud.t.net");
    await out.grant("tok", "a.json", "application/json", bytes, "home.t.net", 0);
    expect(out.serve("/f/tok/a.json", "tokyo.t.net", 0).status).toBe(403);
    expect(out.serve("/f/tok/a.json", "home.t.net", 25 * 3_600_000).status).toBe(410);
    expect(out.serve("/f/nope/a.json", "home.t.net", 0).status).toBe(404);
  });
  test("tamper makes the SHA-256 check fail and deletes .part", async () => {
    const out = new Outbox("cloud.t.net");
    const item = await out.grant("tok", "a.json", "application/json", bytes, "home.t.net", 0);
    out.tamper("tok");
    const disk = new Map<string, Uint8Array>();
    const r = await fetchAndVerify(item, out, "home.t.net", 1000, disk);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("sha256 mismatch");
    expect(disk.size).toBe(0);
  });
});

describe("requests and reply routing", () => {
  test("lifecycle moves forward and final states are terminal", () => {
    const t = new RequestTracker();
    t.create({ v: 1, id: "r1", from: "a", to: "b", ts: "", kind: "request" }, 0, 60);
    expect(t.update("r1", "accepted", 1)).toBe(true);
    expect(t.update("r1", "running", 2)).toBe(true);
    expect(t.update("r1", "accepted", 3)).toBe(false);
    expect(t.update("r1", "completed", 4)).toBe(true);
    expect(t.update("r1", "failed", 5)).toBe(false);
    expect(t.items.get("r1")!.history.map((h) => h.state)).toEqual(["sent", "accepted", "running", "completed"]);
  });
  test("open requests time out after the deadline", () => {
    const t = new RequestTracker();
    t.create({ v: 1, id: "r1", from: "a", to: "b", ts: "", kind: "request" }, 0, 60);
    expect(t.checkTimeouts(30_000)).toEqual([]);
    expect(t.checkTimeouts(61_000)).toEqual(["r1"]);
    expect(t.items.get("r1")!.state).toBe("timeout");
  });
  test("respond routes to the whois peer and the asking agent", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const home = m.machine("home-mac");
    const req = m.envelope(cloud, "home-mac", { kind: "request", agent: "codex", from_agent: "grokbot" });
    const entry = m.send(cloud, req).entry!;
    const reply = m.respond(home, entry, "done", "completed");
    expect(reply).toMatchObject({
      to: cloud.identity.fqdn, agent: "grokbot", from_agent: "codex", reply_to: req.id,
      response: { request_id: req.id, state: "completed" },
    });
    expect(m.send(home, reply).status).toBe(202);
  });
  test("ack is local only", () => {
    const m = mesh();
    const cloud = m.machine("cloud");
    const home = m.machine("home-mac");
    const env = m.envelope(cloud, "home-mac", { kind: "text" });
    m.send(cloud, env);
    const before = cloud.inbox.length;
    expect(m.ack(home, env.id)).toBe(true);
    expect(cloud.inbox.length).toBe(before);
  });
});

describe("story presets", () => {
  const run = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    return runStory({ policies: p.policies(DEFAULT_POLICIES), tamper: p.tamper, spoof: p.spoof });
  };
  const last = <T>(xs: T[]) => xs[xs.length - 1];
  const finalState = (events: Awaited<ReturnType<typeof runStory>>) =>
    last(events.filter((e) => e.type === "request" && e.owner === "cloud")) as { state: string } | undefined;

  test("main story completes along the reply path", async () => {
    const ev = await run("main");
    const done = last(ev);
    expect(done).toMatchObject({ type: "done", ok: true, route: ["tokyo-server", "home-mac", "cloud"] });
    expect(finalState(ev)?.state).toBe("completed");
    const hops = ev.filter((e) => e.type === "packet").map((e) => (e.type === "packet" ? `${e.from}>${e.to}:${e.status}` : ""));
    expect(hops).toEqual([
      "cloud>home-mac:202", "home-mac>cloud:202", "home-mac>tokyo-server:202",
      "tokyo-server>home-mac:202", "tokyo-server>home-mac:202", "home-mac>cloud:202",
    ]);
    expect(ev.some((e) => e.type === "file" && e.stage === "fetch" && e.ok)).toBe(true);
  });
  test("deny: 403 and failed", async () => {
    const ev = await run("deny");
    expect(ev.find((e) => e.type === "packet")).toMatchObject({ status: 403 });
    expect(finalState(ev)?.state).toBe("failed");
  });
  test("allowlist miss: second hop 403 and blocked", async () => {
    const ev = await run("allowlist");
    expect(ev.some((e) => e.type === "packet" && e.to === "tokyo-server" && e.status === 403)).toBe(true);
    expect(finalState(ev)?.state).toBe("blocked");
  });
  test("spoof: 403 from check", async () => {
    const ev = await run("spoof");
    const pk = ev.find((e) => e.type === "packet");
    expect(pk).toMatchObject({ status: 403 });
    expect(pk?.type === "packet" && pk.error).toContain("does not match whois");
  });
  test("quiet hours: wake downgraded, request times out", async () => {
    const ev = await run("quiet");
    expect(ev.some((e) => e.type === "wake" && e.host === "tokyo-server" && e.decision.reason === "quiet hours")).toBe(true);
    expect(ev.some((e) => e.type === "request" && e.state === "timeout")).toBe(true);
    expect(finalState(ev)?.state).toBe("failed");
  });
  test("tamper: sha mismatch and failed", async () => {
    const ev = await run("tamper");
    const f = ev.find((e) => e.type === "file" && e.stage === "fetch");
    expect(f).toMatchObject({ ok: false });
    expect(finalState(ev)?.state).toBe("failed");
  });
});
