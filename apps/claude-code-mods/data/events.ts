import type { SampleEvent } from "@/lib/types";

/**
 * Sample engine events. Field names follow the Claude Code mods docs: a `tool.call` carries `tool` plus the tool's
 * arguments (`command` for Bash), `tool.check` carries `input`, `prompt.submit` carries `text`, and `ui.render`
 * carries `component` + `props`. `engine` is what Claude Code's own behavior returns at the end of the chain
 * (simulated); `expect` is the fixture outcome per starter mod, checked by `bun test`.
 */
export const SAMPLE_EVENTS: SampleEvent[] = [
  {
    id: "bash-force-push",
    label: "Bash · git push --force",
    group: "Tools",
    event: { name: "tool.call", tool: "Bash", command: "git push origin main --force", description: "Push the fix" },
    engine: { kind: "tool.call", output: "+ 3f2a1c9...b81e0d4 main -> main (forced update)" },
    expect: { "bash-guard": "deny", "prompt-polish": "pass-through", "spinner-counter": "pass-through" },
  },
  {
    id: "bash-rm-rf",
    label: "Bash · rm -rf build",
    group: "Tools",
    event: { name: "tool.call", tool: "Bash", command: "rm -rf build", description: "Clean the build output" },
    engine: { kind: "tool.call", output: "(no output)" },
    expect: { "bash-guard": "deny", "prompt-polish": "pass-through", "spinner-counter": "pass-through" },
  },
  {
    id: "bash-npm-install",
    label: "Bash · npm install && npm run test",
    group: "Tools",
    event: { name: "tool.call", tool: "Bash", command: "npm install && npm run test", description: "Install and test" },
    engine: { kind: "tool.call", output: "added 412 packages in 9s\n✓ 38 tests passed" },
    expect: { "bash-guard": "pass-through", "prompt-polish": "rewrite", "spinner-counter": "pass-through" },
  },
  {
    id: "bash-ls",
    label: "Bash · ls -la",
    group: "Tools",
    event: { name: "tool.call", tool: "Bash", command: "ls -la", description: "List files" },
    engine: { kind: "tool.call", output: "drwxr-xr-x  src\n-rw-r--r--  package.json\n-rw-r--r--  README.md" },
    expect: { "bash-guard": "pass-through", "prompt-polish": "pass-through", "spinner-counter": "pass-through" },
  },
  {
    id: "edit-readme",
    label: "Edit · README.md",
    group: "Tools",
    event: { name: "tool.call", tool: "Edit", file_path: "README.md", old_string: "## Run", new_string: "## Run locally" },
    engine: { kind: "tool.call", output: "The file README.md has been updated." },
    expect: { "bash-guard": "pass-through", "prompt-polish": "pass-through", "spinner-counter": "pass-through" },
  },
  {
    id: "check-git-push",
    label: "Permission · git push (rules: allow)",
    group: "Permissions",
    event: { name: "tool.check", tool: "Bash", input: { command: "git push origin main" } },
    engine: { kind: "tool.check", decision: "allow" },
    expect: { "bash-guard": "deny", "prompt-polish": "pass-through", "spinner-counter": "pass-through" },
  },
  {
    id: "prompt-pr",
    label: "Prompt · \"  open a PR for this change  \"",
    group: "Prompts",
    event: { name: "prompt.submit", text: "  open a PR for this change  " },
    engine: { kind: "prompt.submit" },
    expect: { "bash-guard": "pass-through", "prompt-polish": "rewrite", "spinner-counter": "pass-through" },
  },
  {
    id: "render-spinner",
    label: "UI render · Spinner",
    group: "Interface",
    event: { name: "ui.render", component: "Spinner", props: { verb: "Thinking", suffix: "…" } },
    engine: { kind: "ui.render" },
    expect: { "bash-guard": "pass-through", "prompt-polish": "pass-through", "spinner-counter": "rewrite" },
  },
];
