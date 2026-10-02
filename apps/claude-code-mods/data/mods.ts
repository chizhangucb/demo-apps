import type { StarterMod } from "@/lib/types";

/**
 * Starter mods. Each is a complete `hooks/register.ts`-style module in the shape the Claude Code mods docs use:
 * `export function register(on)` and `on(event, [matcher], async ($, e, next) => …)`.
 */
export const STARTER_MODS: StarterMod[] = [
  {
    id: "bash-guard",
    name: "bash-guard",
    blurb: "Denies force pushes and rm -rf, and refuses `git push` on main at the permission check.",
    shows: ["deny", "pass-through"],
    source: `// bash-guard: refuse risky shell commands before they run
const RISKY = /\\brm\\s+-rf?\\b|\\bgit\\s+reset\\s+--hard\\b|\\bgit\\s+push\\b.*--force/

export function register(on: any) {
  // The matcher limits the hook to Bash calls, so e.command is the shell command
  on('tool.call', { tool: 'Bash' }, async ($: any, e: any, next: any) => {
    if (RISKY.test(e.command)) {
      // No call to next: the command never runs, and Claude reads the deny text
      return { deny: 'Blocked by bash-guard: ' + e.command + '. Ask the user first.' }
    }
    return next(e)
  })

  // Runs after permission rules decide; can overrule them
  on('tool.check', { tool: 'Bash' }, async ($: any, e: any, next: any) => {
    const decided = await next(e)
    if (!e.input.command.includes('git push')) return decided
    const branch = await $.process.run(['git', 'branch', '--show-current'])
    if (branch.stdout.trim() !== 'main') return decided
    return { decision: 'deny', reason: 'No pushes from main — open a branch' }
  })
}
`,
  },
  {
    id: "prompt-polish",
    name: "prompt-polish",
    blurb: "Rewrites npm → bun in Bash calls, trims prompts and adds the branch as context for PR asks.",
    shows: ["rewrite", "pass-through"],
    source: `// prompt-polish: rewrite events on their way to Claude Code
export function register(on: any) {
  // This repo uses Bun: swap npm/npx for bun/bunx before the command runs
  on('tool.call', { tool: 'Bash' }, async ($: any, e: any, next: any) => {
    const command = e.command
      .replace(/\\bnpm install\\b/g, 'bun install')
      .replace(/\\bnpm run\\b/g, 'bun run')
      .replace(/\\bnpx\\b/g, 'bunx')
    if (command !== e.command) $.ui.log('rewrote: ' + e.command + ' → ' + command)
    // The event is frozen — pass a changed copy
    return next({ ...e, command })
  })

  // Trim every prompt; add the branch name for Claude when it mentions a PR
  on('prompt.submit', async ($: any, e: any, next: any) => {
    const text = e.text.trim()
    if (!/\\bPR\\b|pull request/i.test(text)) return next({ ...e, text })
    const git = await $.process.run(['git', 'branch', '--show-current'])
    return next({ ...e, text, context: [...(e.context ?? []), 'Current branch: ' + git.stdout.trim()] })
  })
}
`,
  },
  {
    id: "spinner-counter",
    name: "spinner-counter",
    blurb: "The docs' first mod: counts tool calls (pass-through) and adds the count beside the spinner.",
    shows: ["pass-through", "rewrite"],
    source: `// spinner-counter: the example from the Claude Code mods overview
// The count, shared by the two hooks below (it survives between fires)
let calls = 0

export function register(on: any) {
  // Runs each time Claude is about to use a tool
  on('tool.call', async ($: any, e: any, next: any) => {
    calls += 1
    // Ask Claude Code to draw the interface again, so the new count shows
    $.ui.invalidate('ui.render')
    // Let the tool run as usual
    return next(e)
  })

  // Runs each time Claude Code draws the spinner
  on('ui.render', { component: 'Spinner' }, async ($: any, e: any, next: any) => {
    // Keep Claude Code's spinner, with the count added after its word
    return next({ ...e, props: { ...e.props, suffix: ' · tool calls: ' + calls + '…' } })
  })
}
`,
  },
];

export const BLANK_MOD = `// Your mod. Handle any event: tool.call, tool.check, prompt.submit, ui.render
export function register(on: any) {
  on('tool.call', async ($: any, e: any, next: any) => {
    $.ui.log('Claude is about to use ' + e.tool)
    return next(e)
  })
}
`;
