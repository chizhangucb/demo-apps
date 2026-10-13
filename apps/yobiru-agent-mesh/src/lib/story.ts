import bugs from "../../data/bugs.json";
import repro from "../../data/repro.json";
import scripted from "../../data/scripted.json";
import { fetchAndVerify } from "./mesh/files";
import { Mesh, type Machine, type SendOptions } from "./mesh/mesh";
import type { AuthStep, Envelope, FetchItem, InboxEntry, RequestState, WakeDecision } from "./mesh/types";
import { AGENT, machineSpecs, type Host, type Policies } from "./setup";

export type Tone = "info" | "ok" | "warn" | "err";

export type StoryEvent = { t: number } & (
  | { type: "phase"; title: string }
  | { type: "cli"; host: Host; cmd: string }
  | { type: "log"; host: Host; line: string; tone: Tone }
  | {
      type: "packet";
      from: Host;
      to: Host;
      label: string;
      status: number;
      error?: string;
      reply: boolean;
      envelope: Envelope;
      steps: AuthStep[];
    }
  | { type: "wake"; host: Host; agent: string; decision: WakeDecision }
  | { type: "agent"; host: Host; state: "awake" | "asleep" }
  | { type: "inbox"; host: Host; id: string; kind: string; from: string; wake: string }
  | {
      type: "file";
      stage: "grant" | "tamper" | "fetch";
      owner: Host;
      fetcher: Host;
      item: FetchItem;
      computed?: string;
      ok?: boolean;
      steps?: string[];
      error?: string;
    }
  | { type: "request"; owner: Host; id: string; label: string; state: RequestState; note: string; deadline: number }
  | { type: "done"; ok: boolean; text: string; route?: Host[] }
);

export type TextSlot = "running" | "repro_reply" | "summary";
export type TextSource = (slot: TextSlot, fallback: string) => Promise<{ text: string; live: boolean }>;

export interface StoryOptions {
  policies: Policies;
  tamper: boolean;
  spoof: boolean;
  texts?: TextSource;
}

const scriptedTexts: TextSource = async (_slot, fallback) => ({ text: fallback, live: false });
const enc = new TextEncoder();
const q = (s: string) => `"${s.length > 48 ? s.slice(0, 45) + "..." : s}"`;

/** Runs the whole scripted story against a fresh simulated mesh and returns the event list. */
export async function runStory(opts: StoryOptions): Promise<StoryEvent[]> {
  const mesh = new Mesh(machineSpecs(opts.policies));
  const texts = opts.texts ?? scriptedTexts;
  const events: StoryEvent[] = [];
  const emit = (e: DistributiveOmit<StoryEvent, "t">) => events.push({ ...e, t: mesh.now } as StoryEvent);
  const tick = (sec = 4) => mesh.advance(sec * 1000);
  const host = (m: Machine) => m.host as Host;
  const cloud = mesh.machine("cloud");
  const home = mesh.machine("home-mac");
  const tokyo = mesh.machine("tokyo-server");
  const labels = new Map<string, string>();

  const track = (owner: Machine, id: string) => {
    const r = owner.requests.items.get(id)!;
    const last = r.history[r.history.length - 1];
    emit({ type: "request", owner: host(owner), id, label: labels.get(id) ?? id, state: r.state, note: last.note, deadline: r.deadline });
  };
  const setState = (owner: Machine, id: string, state: RequestState, note: string) => {
    if (owner.requests.update(id, state, mesh.now, note)) track(owner, id);
  };

  const deliver = (from: Machine, env: Envelope, label: string, reply: boolean, sendOpts?: SendOptions) => {
    tick(2);
    const res = mesh.send(from, env, sendOpts);
    const to = mesh.machine(env.to);
    emit({ type: "packet", from: host(from), to: host(to), label, status: res.status, error: res.error, reply, envelope: env, steps: res.steps });
    if (res.status >= 400) {
      emit({ type: "log", host: host(to), line: `POST /msg from ${res.packet.sourceIp} -> ${res.status} ${res.error}`, tone: "err" });
      emit({ type: "log", host: host(from), line: `send refused: ${res.status} ${res.error}`, tone: "err" });
      return res;
    }
    emit({ type: "log", host: host(to), line: `POST /msg from ${from.identity.fqdn} -> ${res.status} accepted`, tone: "ok" });
    if (res.entry) {
      const agent = env.agent ?? to.agents[0];
      emit({ type: "inbox", host: host(to), id: env.id, kind: env.kind, from: `${env.from_agent ?? "?"}@${from.host}`, wake: res.entry.wake.effective });
      emit({ type: "wake", host: host(to), agent, decision: res.entry.wake });
      const d = res.entry.wake;
      if (d.effective === "now") {
        emit({ type: "log", host: host(to), line: `wake ${d.requested} -> ${d.effective}: wake adapter woke ${agent}`, tone: "ok" });
        emit({ type: "agent", host: host(to), state: "awake" });
      } else {
        emit({
          type: "log",
          host: host(to),
          line: `wake ${d.requested} -> ${d.effective}${d.reason ? ` (${d.reason})` : ""}: ${agent} stays asleep, message waits in inbox`,
          tone: d.requested === d.effective ? "info" : "warn",
        });
      }
    }
    return res;
  };

  const finish = (ok: boolean, text: string, route?: Host[]) => {
    emit({ type: "done", ok, text, route });
    return events;
  };

  /** Moves the clock just past one request's deadline; anything else past its own deadline times out too. */
  const timeoutAt = (owner: Machine, id: string, why: string) => {
    mesh.now = Math.max(mesh.now, owner.requests.items.get(id)!.deadline + 1000);
    emit({ type: "phase", title: `Clock moves past the deadline (${why})` });
    for (const m of mesh.machines.values()) for (const rid of m.requests.checkTimeouts(mesh.now)) track(m, rid);
  };

  const respond = (by: Machine, entry: InboxEntry, text: string, state: RequestState, extra: Partial<Envelope> = {}, file?: string) => {
    const env = mesh.respond(by, entry, text, state, extra, state === "running" ? "batch" : "now");
    emit({
      type: "cli",
      host: host(by),
      cmd: `yobiru request respond ${entry.envelope.id} ${q(text)} --state ${state}${file ? ` --file ./${file}` : ""}`,
    });
    return env;
  };

  // Hop 1: grokbot@cloud -> home-mac/codex, tracked request with bugs.json attached.
  emit({ type: "phase", title: "grokbot@cloud sends three bug reports to home-mac/codex" });
  const bugBytes = enc.encode(JSON.stringify(bugs, null, 2));
  const bugToken = `t${mesh.nextId()}`;
  const bugItem = await cloud.outbox.grant(bugToken, "bugs.json", "application/json", bugBytes, home.identity.fqdn, mesh.now);
  emit({ type: "file", stage: "grant", owner: "cloud", fetcher: "home-mac", item: bugItem });
  emit({ type: "log", host: "cloud", line: `outbox: bugs.json (${bugItem.size} bytes) served only to home-mac, expires in 24h`, tone: "info" });

  const env1 = mesh.envelope(cloud, "home-mac", {
    kind: "request",
    text: scripted.request,
    wake: "now",
    agent: "codex",
    from_agent: "grokbot",
    fetch: [bugItem],
    request: { timeout_seconds: 900, deadline: new Date(mesh.now + 900_000).toISOString() },
  });
  if (opts.spoof) {
    // Claim to be tokyo-server. The envelope is well formed; only whois can catch it.
    env1.from = tokyo.identity.fqdn;
    env1.fetch = [{ ...bugItem, url: bugItem.url.replace(cloud.identity.fqdn, tokyo.identity.fqdn) }];
    emit({ type: "log", host: "cloud", line: `spoof: envelope from set to ${tokyo.identity.fqdn}`, tone: "warn" });
  }
  labels.set(env1.id, "grokbot: triage bugs.json");
  emit({
    type: "cli",
    host: "cloud",
    cmd: `yobiru request send home-mac/codex '{"bundle":"${bugs.bundle}","bugs":3}' --timeout-seconds 900 --wake now --file ./bugs.json`,
  });
  cloud.requests.create(env1, mesh.now, 900);
  track(cloud, env1.id);

  const res1 = deliver(cloud, env1, opts.spoof ? "spoofed request" : "request + bugs.json", false);
  if (res1.status !== 202 || !res1.entry) {
    setState(cloud, env1.id, "failed", `send refused: ${res1.status} ${res1.error}`);
    return finish(false, `home-mac refused the message: ${res1.status} ${res1.error}.`);
  }
  setState(cloud, env1.id, "accepted", "202 receipt: in inbox, not processed yet");
  const entry1 = res1.entry;

  if (opts.tamper) {
    cloud.outbox.tamper(bugToken);
    emit({ type: "file", stage: "tamper", owner: "cloud", fetcher: "home-mac", item: bugItem });
    emit({ type: "log", host: "cloud", line: "Tamper: bytes of the served bugs.json changed after the envelope was sent", tone: "warn" });
  }

  if (entry1.wake.effective !== "now") {
    timeoutAt(cloud, env1.id, `codex was not woken: ${entry1.wake.reason ?? "batch"}`);
    return finish(false, "codex stayed asleep, so the request sat in the inbox until it timed out.");
  }

  // codex reads the inbox and fetches the file.
  tick();
  emit({ type: "phase", title: "codex@home-mac fetches bugs.json and checks SHA-256" });
  emit({ type: "cli", host: "home-mac", cmd: "yobiru inbox --pending --agent codex" });
  emit({ type: "cli", host: "home-mac", cmd: `yobiru show ${env1.id}` });
  emit({ type: "cli", host: "home-mac", cmd: `yobiru fetch ${env1.id}` });
  tick(3);
  const f1 = await fetchAndVerify(env1.fetch![0], cloud.outbox, home.identity.fqdn, mesh.now, home.disk);
  emit({ type: "file", stage: "fetch", owner: "cloud", fetcher: "home-mac", item: bugItem, ok: f1.ok, computed: f1.computed, steps: f1.steps, error: f1.ok ? undefined : f1.error });
  for (const s of f1.steps) emit({ type: "log", host: "home-mac", line: s, tone: f1.ok ? "ok" : s.includes("mismatch") || s.startsWith("deleted") ? "err" : "info" });

  if (!f1.ok) {
    tick();
    const text = `Could not use bugs.json: ${f1.error}. The .part file was deleted. Please resend.`;
    deliver(home, respond(home, entry1, text, "failed"), "failed response", true);
    setState(cloud, env1.id, "failed", f1.error);
    return finish(false, `SHA-256 check failed on home-mac. ${f1.error}.`);
  }

  tick();
  const running = await texts("running", scripted.running);
  deliver(home, respond(home, entry1, running.text, "running"), "running update", true);
  setState(cloud, env1.id, "running", "codex is working");

  // Hop 2: codex -> tokyo-server/claude repro task.
  tick();
  emit({ type: "phase", title: "codex@home-mac passes a repro task to tokyo-server/claude" });
  const bug = bugs.bugs[0];
  const env2 = mesh.envelope(home, "tokyo-server", {
    kind: "request",
    text: scripted.repro_task,
    wake: "now",
    agent: "claude",
    from_agent: "codex",
    request: { timeout_seconds: 600, deadline: new Date(mesh.now + 600_000).toISOString() },
  });
  labels.set(env2.id, `codex: repro ${bug.id}`);
  emit({
    type: "cli",
    host: "home-mac",
    cmd: `yobiru request send tokyo-server/claude '{"bug":"${bug.id}","repo":"${bug.repo}"}' --timeout-seconds 600 --wake now`,
  });
  home.requests.create(env2, mesh.now, 600);
  track(home, env2.id);
  const res2 = deliver(home, env2, "repro request", false);
  if (res2.status !== 202 || !res2.entry) {
    setState(home, env2.id, "blocked", `tokyo-server refused: ${res2.status} ${res2.error}`);
    tick();
    const text = `Blocked: tokyo-server refused the repro request (${res2.status} ${res2.error}). Nothing was run.`;
    deliver(home, respond(home, entry1, text, "blocked"), "blocked response", true);
    setState(cloud, env1.id, "blocked", `${res2.status} at tokyo-server`);
    return finish(false, `tokyo-server refused codex: ${res2.status} ${res2.error}. Request ended blocked.`);
  }
  setState(home, env2.id, "accepted", "202 receipt");
  const entry2 = res2.entry;

  if (entry2.wake.effective !== "now") {
    timeoutAt(home, env2.id, `claude was not woken: ${entry2.wake.reason ?? "batch"}`);
    tick();
    const text = `Repro timed out: claude@tokyo-server was not woken (${entry2.wake.reason ?? "batch"}). Bundle triaged, repro pending.`;
    deliver(home, respond(home, entry1, text, "failed"), "failed response", true);
    setState(cloud, env1.id, "failed", "repro timed out");
    return finish(false, `tokyo-server downgraded wake now to ${entry2.wake.effective} (${entry2.wake.reason}). claude stayed asleep; the repro request timed out.`);
  }

  // Hop 3: claude reproduces and replies along the reply path.
  tick(5);
  emit({ type: "phase", title: "claude@tokyo-server reproduces the bug and replies" });
  emit({ type: "cli", host: "tokyo-server", cmd: "yobiru inbox --pending --agent claude" });
  emit({ type: "cli", host: "tokyo-server", cmd: `yobiru show ${env2.id}` });
  deliver(tokyo, respond(tokyo, entry2, "Reproducing on shop-web@main", "running"), "running update", true);
  setState(home, env2.id, "running", "claude is reproducing");
  tick(40);
  const reproBytes = enc.encode(JSON.stringify(repro, null, 2));
  const reproItem = await tokyo.outbox.grant(`t${mesh.nextId()}`, "repro.json", "application/json", reproBytes, home.identity.fqdn, mesh.now);
  emit({ type: "file", stage: "grant", owner: "tokyo-server", fetcher: "home-mac", item: reproItem });
  const reproText = await texts("repro_reply", scripted.repro_reply);
  const env3 = respond(tokyo, entry2, reproText.text, "completed", { fetch: [reproItem] }, "repro.json");
  const res3 = deliver(tokyo, env3, "repro result + repro.json", true);
  if (res3.status !== 202 || !res3.entry) {
    timeoutAt(home, env2.id, "the repro result was refused");
    return finish(false, `home-mac refused claude's reply: ${res3.status} ${res3.error}.`);
  }
  setState(home, env2.id, "completed", `reply_to ${env2.id}, routed to ${env3.agent}`);
  tick(3);
  emit({ type: "cli", host: "home-mac", cmd: `yobiru fetch ${env3.id}` });
  const f3 = await fetchAndVerify(reproItem, tokyo.outbox, home.identity.fqdn, mesh.now, home.disk);
  emit({ type: "file", stage: "fetch", owner: "tokyo-server", fetcher: "home-mac", item: reproItem, ok: f3.ok, computed: f3.computed, steps: f3.steps, error: f3.ok ? undefined : f3.error });
  for (const s of f3.steps) emit({ type: "log", host: "home-mac", line: s, tone: f3.ok ? "ok" : "err" });
  mesh.ack(home, env3.id);
  emit({ type: "cli", host: "home-mac", cmd: `yobiru ack ${env3.id}` });

  // Hop 4: codex sends the final summary back to grokbot.
  tick(6);
  emit({ type: "phase", title: "codex@home-mac sends the completed summary back to grokbot@cloud" });
  const summary = await texts("summary", scripted.summary);
  const res4 = deliver(home, respond(home, entry1, summary.text, "completed"), "completed summary", true);
  if (res4.status !== 202) {
    timeoutAt(cloud, env1.id, "the summary was refused");
    return finish(false, `cloud refused the summary: ${res4.status} ${res4.error}.`);
  }
  setState(cloud, env1.id, "completed", `reply_to ${env1.id}, routed to ${AGENT.cloud}`);
  emit({ type: "cli", host: "cloud", cmd: `yobiru ack ${JSON.parse(res4.packet.body).id}` });
  return finish(true, "Request completed. The result came back along the reply path tokyo-server, home-mac, cloud.", ["tokyo-server", "home-mac", "cloud"]);
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
