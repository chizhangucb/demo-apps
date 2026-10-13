import type { MachineSpec } from "./mesh/mesh";
import type { Policy } from "./mesh/types";

export type Host = "cloud" | "home-mac" | "tokyo-server";
export const HOSTS: Host[] = ["cloud", "home-mac", "tokyo-server"];
export const AGENT: Record<Host, string> = { cloud: "grokbot", "home-mac": "codex", "tokyo-server": "claude" };

export type Policies = Record<Host, Policy>;

export const DEFAULT_POLICIES: Policies = {
  cloud: {
    mode: "tailnet",
    allow: [],
    deny: [],
    wake_policy: { "home-mac": "now" },
    default_max: "batch",
    quiet_hours: null,
    wake_rate: 6,
    agents: { grokbot: { wake_max: "now" } },
  },
  "home-mac": {
    mode: "tailnet",
    allow: [],
    deny: [],
    wake_policy: { cloud: "now", "tokyo-server": "now" },
    default_max: "batch",
    quiet_hours: null,
    wake_rate: 6,
    agents: { codex: { wake_max: "now" } },
  },
  "tokyo-server": {
    mode: "allowlist",
    allow: ["home-mac"],
    deny: [],
    wake_policy: { "home-mac": "now" },
    default_max: "batch",
    quiet_hours: null,
    wake_rate: 6,
    agents: { claude: { wake_max: "now" } },
  },
};

const BASE: Record<Host, Omit<MachineSpec, "policy">> = {
  cloud: { host: "cloud", ip: "100.101.7.12", user: "chi@github", tags: ["tag:cloud"], agents: ["grokbot"], utcOffsetHours: 0 },
  "home-mac": { host: "home-mac", ip: "100.88.21.4", user: "chi@github", tags: [], agents: ["codex"], utcOffsetHours: -7 },
  "tokyo-server": { host: "tokyo-server", ip: "100.120.45.9", user: "chi@github", tags: ["tag:server"], agents: ["claude"], utcOffsetHours: 9 },
};

export function machineSpecs(policies: Policies): MachineSpec[] {
  return HOSTS.map((h) => ({ ...BASE[h], policy: policies[h] }));
}

export const MACHINE_INFO = BASE;

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  policies: (p: Policies) => Policies;
  tamper: boolean;
  spoof: boolean;
}

const clone = (p: Policies): Policies => structuredClone(p);

export const PRESETS: Preset[] = [
  {
    id: "main",
    label: "Main story",
    blurb: "grokbot sends three bug reports, codex hands a repro to claude, the result comes back along the reply path.",
    policies: () => clone(DEFAULT_POLICIES),
    tamper: false,
    spoof: false,
  },
  {
    id: "deny",
    label: "Deny rule",
    blurb: "home-mac adds deny: cloud. Deny always wins, so grokbot's request gets 403.",
    policies: () => {
      const p = clone(DEFAULT_POLICIES);
      p["home-mac"].deny = ["cloud"];
      return p;
    },
    tamper: false,
    spoof: false,
  },
  {
    id: "allowlist",
    label: "Allowlist miss",
    blurb: "tokyo-server's allowlist only names tag:ci, so codex's repro request is refused with 403 and the request ends blocked.",
    policies: () => {
      const p = clone(DEFAULT_POLICIES);
      p["tokyo-server"].allow = ["tag:ci"];
      return p;
    },
    tamper: false,
    spoof: false,
  },
  {
    id: "spoof",
    label: "Spoofed from",
    blurb: "cloud sends an envelope claiming to be from tokyo-server. whois says cloud, so home-mac returns 403.",
    policies: () => clone(DEFAULT_POLICIES),
    tamper: false,
    spoof: true,
  },
  {
    id: "quiet",
    label: "Quiet hours",
    blurb: "It is 23:00 in Tokyo and tokyo-server has quiet hours 22:00-07:00. Wake now is downgraded to batch, claude stays asleep, the repro times out.",
    policies: () => {
      const p = clone(DEFAULT_POLICIES);
      p["tokyo-server"].quiet_hours = "22:00-07:00";
      return p;
    },
    tamper: false,
    spoof: false,
  },
  {
    id: "tamper",
    label: "Tamper",
    blurb: "bugs.json is changed on cloud after the envelope was sent. codex's SHA-256 check fails, the .part file is deleted, the request fails.",
    policies: () => clone(DEFAULT_POLICIES),
    tamper: true,
    spoof: false,
  },
];
