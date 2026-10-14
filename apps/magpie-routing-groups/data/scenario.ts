// The scripted coding day. Every account, key, quota number and price here is
// fictional and illustrative. Times are sim minutes from 08:00 on a Tuesday.
import type { Account, AgentId, Config, Kind, Outage, Turn } from "../src/lib/routing/types";

export const ACCOUNTS: Account[] = [
  {
    id: "max-work",
    label: "Claude Max (work)",
    plan: "Claude Max",
    provider: "claude",
    model: "claude/claude-opus-5-5",
    tier: "strong",
    windows: [
      { kind: "5h", cap: 350_000, startPct: 12, resetAt: 2 },
      { kind: "week", cap: 3_500_000, startPct: 22, resetAt: 96 },
    ],
    price: { input: 5, output: 25 },
    color: "#d97757",
  },
  {
    id: "max-home",
    label: "Claude Max (home)",
    plan: "Claude Max",
    provider: "claude",
    model: "claude/claude-opus-5-5",
    tier: "strong",
    windows: [
      { kind: "5h", cap: 500_000, startPct: 0, resetAt: 3.5 },
      { kind: "week", cap: 3_500_000, startPct: 78, resetAt: 5 },
    ],
    price: { input: 5, output: 25 },
    color: "#b4532a",
  },
  {
    id: "copilot",
    label: "Copilot Pro+",
    plan: "GitHub Copilot",
    provider: "copilot",
    model: "copilot/claude-opus-5.5",
    tier: "strong",
    windows: [{ kind: "week", cap: 1_500_000, startPct: 82, resetAt: 26 }],
    price: { input: 5, output: 25 },
    color: "#6e7681",
  },
  {
    id: "codex",
    label: "ChatGPT Plus (Codex)",
    plan: "ChatGPT Plus",
    provider: "codex",
    model: "codex/gpt-5.5-codex",
    tier: "strong",
    windows: [
      { kind: "5h", cap: 300_000, startPct: 0, resetAt: 4 },
      { kind: "week", cap: 2_500_000, startPct: 45, resetAt: 100 },
    ],
    price: { input: 1.25, output: 10 },
    color: "#10a37f",
  },
  {
    id: "kimi",
    label: "Kimi coding plan",
    plan: "Kimi coding plan",
    provider: "moonshot",
    model: "moonshot/kimi-k2.5",
    tier: "cheap",
    windows: [
      { kind: "5h", cap: 500_000, startPct: 0, resetAt: 1.5 },
      { kind: "week", cap: 4_000_000, startPct: 15, resetAt: 120 },
    ],
    price: { input: 0.6, output: 2.5 },
    color: "#4f6bed",
  },
  {
    id: "deepseek",
    label: "DeepSeek API key",
    plan: "Pay per token",
    provider: "deepseek",
    model: "deepseek/deepseek-v4-pro",
    tier: "cheap",
    windows: [],
    price: { input: 0.5, output: 2 },
    color: "#2f80ed",
  },
  {
    id: "gemini",
    label: "Gemini Code Assist",
    plan: "Gemini Code Assist",
    provider: "gemini",
    model: "gemini/gemini-3-pro",
    tier: "strong",
    windows: [
      { kind: "5h", cap: 400_000, startPct: 0, resetAt: 3 },
      { kind: "week", cap: 3_000_000, startPct: 20, resetAt: 72 },
    ],
    price: { input: 2, output: 12 },
    color: "#a142f4",
  },
];

/** The one shared model list every agent picks from. */
export const MODEL_LIST = [
  "group/daily-coding",
  "claude/claude-opus-5-5",
  "copilot/claude-opus-5.5",
  "codex/gpt-5.5-codex",
  "moonshot/kimi-k2.5",
  "deepseek/deepseek-v4-pro",
  "gemini/gemini-3-pro",
];

export const AGENTS: { id: AgentId; name: string; cmd: string; file: string; key: string }[] = [
  { id: "claude", name: "Claude Code", cmd: "claude", file: "~/.claude/settings.json", key: '"model"' },
  { id: "codex", name: "Codex", cmd: "codex", file: "~/.codex/config.toml", key: "model" },
  { id: "gemini", name: "Gemini CLI", cmd: "gemini", file: "~/.gemini/settings.json", key: '"model.name"' },
];

export const DEFAULT_CONFIG: Config = {
  mode: "smart",
  stays: "auto",
  sink: true,
  intent: false,
  picks: { claude: "group/daily-coding", codex: "group/daily-coding", gemini: "gemini/gemini-3-pro" },
  members: [
    { accountId: "max-work", enabled: true },
    { accountId: "codex", enabled: true },
    { accountId: "copilot", enabled: true },
    { accountId: "max-home", enabled: true },
    { accountId: "kimi", enabled: true },
    { accountId: "deepseek", enabled: true, fallback: true },
  ],
};

/** Scripted failures, the same in every mode. */
export const OUTAGES: Outage[] = [
  { accountId: "max-home", from: 140, to: 150, code: 429 },
  { accountId: "copilot", from: 148, to: 156, code: 429 },
  { accountId: "max-work", from: 150, to: 160, code: 429 },
  { accountId: "copilot", from: 455, to: 470, code: 503 },
];

interface ConvSpec {
  id: string;
  title: string;
  agent: AgentId;
  start: number;
  gap: number;
  base: number;
  grow: number;
  output: number;
  kinds: Kind[];
  prompts: string[];
}

export const CONVERSATIONS: ConvSpec[] = [
  {
    id: "billing", title: "Refactor billing module", agent: "claude", start: 5, gap: 3, base: 40_000, grow: 9_000, output: 4_000,
    kinds: ["refactor", "refactor", "refactor", "refactor", "test", "refactor", "refactor", "test", "refactor", "test"],
    prompts: ["Map out billing/ and propose a split", "Extract InvoiceCalculator", "Move tax rules into a strategy", "Update call sites in checkout", "Run the billing tests", "Fix the rounding regression", "Inline the old helpers", "Run the full test suite", "Tidy up imports and types", "Run tests once more"],
  },
  {
    id: "flaky", title: "Fix flaky checkout tests", agent: "codex", start: 25, gap: 4, base: 30_000, grow: 7_000, output: 3_000,
    kinds: ["test", "test", "refactor", "test", "test", "test"],
    prompts: ["Run checkout.spec 20 times and report", "Find the race in the cart fixture", "Await the network mock properly", "Run checkout.spec 20 times again", "Run the e2e smoke suite", "Run the whole suite on CI config"],
  },
  {
    id: "quick-am", title: "Quick questions", agent: "claude", start: 95, gap: 9, base: 4_000, grow: 500, output: 600,
    kinds: ["quick", "quick", "quick", "quick"],
    prompts: ["What does Array.prototype.at return for -1?", "Regex for a semver tag?", "How do I squash the last 3 commits?", "Is structuredClone safe for Dates?"],
  },
  {
    id: "auth", title: "Migrate auth to JWT", agent: "claude", start: 130, gap: 4, base: 50_000, grow: 10_000, output: 5_000,
    kinds: ["long", "refactor", "refactor", "refactor", "refactor", "test", "refactor", "test"],
    prompts: ["Read the session middleware and plan the JWT move", "Add token signing and rotation", "Replace session lookups in routes", "Migrate the admin guard", "Add refresh token storage", "Run auth tests", "Fix the expired token edge case", "Run the full suite"],
  },
  {
    id: "search", title: "Profile slow search query", agent: "codex", start: 200, gap: 5, base: 35_000, grow: 6_000, output: 3_000,
    kinds: ["long", "refactor", "refactor", "test", "quick"],
    prompts: ["Profile /search with the slow fixture", "Add a covering index", "Rewrite the ORM query", "Run the search benchmarks", "Which index name did we pick?"],
  },
  {
    id: "quick-pm", title: "Quick questions", agent: "codex", start: 300, gap: 8, base: 4_000, grow: 500, output: 600,
    kinds: ["quick", "quick", "quick"],
    prompts: ["What is the TS satisfies operator for?", "Difference between git restore and reset?", "How do I tail a Vercel log?"],
  },
  {
    id: "invoices", title: "Write tests for invoices", agent: "claude", start: 330, gap: 4, base: 45_000, grow: 8_000, output: 4_500,
    kinds: ["test", "test", "refactor", "test", "test", "test"],
    prompts: ["Write unit tests for InvoiceCalculator", "Add property tests for tax rounding", "Make the clock injectable", "Run invoice tests", "Cover credit notes", "Run the full suite"],
  },
  {
    id: "review", title: "Review PR #212", agent: "codex", start: 450, gap: 5, base: 40_000, grow: 5_000, output: 3_000,
    kinds: ["long", "refactor", "test", "quick"],
    prompts: ["Review the diff of PR #212", "Apply the suggested null checks", "Run the tests touched by the PR", "Summarise the review in one line"],
  },
  {
    id: "release", title: "Release prep", agent: "claude", start: 560, gap: 4, base: 30_000, grow: 6_000, output: 3_000,
    kinds: ["quick", "refactor", "test", "quick"],
    prompts: ["Which PRs merged since v2.3?", "Bump versions and changelog", "Run the release test suite", "Draft the release tweet"],
  },
  {
    id: "docs", title: "Write API docs", agent: "gemini", start: 60, gap: 6, base: 25_000, grow: 6_000, output: 3_500,
    kinds: ["long", "long", "refactor", "quick"],
    prompts: ["Draft docs for the billing API", "Add examples for each endpoint", "Generate the OpenAPI snippet", "Is 'idempotency key' one word or two?"],
  },
  {
    id: "ci", title: "Fix CI yaml", agent: "gemini", start: 400, gap: 6, base: 8_000, grow: 2_000, output: 1_000,
    kinds: ["quick", "refactor", "quick"],
    prompts: ["Why does the cache step miss?", "Pin the bun version in CI", "What is the default job timeout?"],
  },
];

export const CONV_TITLE: Record<string, string> = Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.title]));

export const TURNS: Turn[] = CONVERSATIONS.flatMap((c) =>
  c.kinds.map((kind, i) => ({
    idx: 0,
    t: c.start + i * c.gap,
    agent: c.agent,
    conv: c.id,
    kind,
    prompt: c.prompts[i],
    context: c.base + i * c.grow,
    output: kind === "quick" ? Math.min(c.output, 800) : c.output,
  })),
)
  .sort((a, b) => a.t - b.t || a.conv.localeCompare(b.conv))
  .map((t, i) => ({ ...t, idx: i + 1 }));

export const SCENARIO = { accounts: ACCOUNTS, turns: TURNS, outages: OUTAGES };
