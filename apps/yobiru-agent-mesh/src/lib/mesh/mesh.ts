import { encodeEnvelope } from "./envelope";
import { Outbox } from "./files";
import { receive, type ReceiverState } from "./receiver";
import { RequestTracker } from "./requests";
import type { Envelope, Identity, InboxEntry, Packet, Policy, ReceiveResult, RequestState, WakeLevel } from "./types";

export interface MachineSpec {
  host: string;
  ip: string;
  user: string;
  tags: string[];
  agents: string[];
  utcOffsetHours: number;
  policy: Policy;
}

export class Machine implements ReceiverState {
  identity: Identity;
  policy: Policy;
  agents: string[];
  utcOffsetHours: number;
  ip: string;
  inbox: InboxEntry[] = [];
  wakeLog: { sender: string; agent: string; at: number }[] = [];
  outbox: Outbox;
  requests = new RequestTracker();
  disk = new Map<string, Uint8Array>();

  constructor(public spec: MachineSpec, tailnet: string) {
    this.identity = { fqdn: `${spec.host}.${tailnet}`, user: spec.user, tags: spec.tags };
    this.policy = structuredClone(spec.policy);
    this.agents = spec.agents;
    this.utcOffsetHours = spec.utcOffsetHours;
    this.ip = spec.ip;
    this.outbox = new Outbox(this.identity.fqdn);
  }

  get host() {
    return this.spec.host;
  }
}

export interface SendOptions {
  /** Override the packet's source address (used to simulate off-tailnet traffic). */
  sourceIp?: string;
  contentType?: string;
}

export class Mesh {
  machines = new Map<string, Machine>();
  now: number;
  private seq = 0;

  constructor(specs: MachineSpec[], public tailnet = "example-tail.ts.net", start = Date.UTC(2026, 9, 13, 14, 0, 0)) {
    for (const s of specs) this.machines.set(s.host, new Machine(s, tailnet));
    this.now = start;
  }

  machine(hostOrFqdn: string): Machine {
    const m = this.machines.get(hostOrFqdn.split(".")[0]);
    if (!m) throw new Error(`unknown host ${hostOrFqdn}`);
    return m;
  }

  /** Simulated `tailscale whois`: the network layer, not the envelope, says who is talking. */
  whois = (ip: string): Identity | undefined => [...this.machines.values()].find((m) => m.ip === ip)?.identity;

  advance(ms: number) {
    this.now += ms;
  }

  nextId(): string {
    this.seq += 1;
    const x = (this.seq * 0x9e3779b1 + 0x7f4a7c15) >>> 0;
    const y = ((x ^ (x >>> 13)) * 0x85ebca6b) >>> 0;
    return (x.toString(16).padStart(8, "0") + y.toString(16).padStart(8, "0")).slice(0, 16);
  }

  envelope(from: Machine, toHost: string, fields: Partial<Envelope> & { kind: string }): Envelope {
    return {
      v: 1,
      id: this.nextId(),
      from: from.identity.fqdn,
      to: this.machine(toHost).identity.fqdn,
      ts: new Date(this.now).toISOString(),
      wake: "batch",
      ...fields,
    };
  }

  /** Sender resolves the short host, then POSTs the envelope to the receiver's /msg. */
  send(from: Machine, env: Envelope, opts: SendOptions = {}): ReceiveResult & { packet: Packet } {
    const to = this.machine(env.to);
    const packet: Packet = {
      sourceIp: opts.sourceIp ?? from.ip,
      contentType: opts.contentType ?? "application/json",
      body: encodeEnvelope(env),
    };
    return { ...receive(to, packet, this.whois, this.now), packet };
  }

  /**
   * Reply routing: a response goes back to the authenticated sender (the whois peer, not the
   * envelope's from), to the asking agent named in from_agent, with reply_to set.
   */
  respond(by: Machine, entry: InboxEntry, text: string, state: RequestState, extra: Partial<Envelope> = {}, wake: WakeLevel = "now"): Envelope {
    return this.envelope(by, entry.peer.fqdn, {
      kind: "response",
      text,
      reply_to: entry.envelope.id,
      agent: entry.envelope.from_agent,
      from_agent: entry.envelope.agent,
      wake,
      response: { request_id: entry.envelope.id, state },
      ...extra,
    });
  }

  /** ack is local bookkeeping only. It never notifies the sender. */
  ack(by: Machine, id: string): boolean {
    const e = by.inbox.find((x) => x.envelope.id === id);
    if (!e) return false;
    e.acked = true;
    return true;
  }
}
