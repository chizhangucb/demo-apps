import type { Task } from "@/lib/types";

/**
 * Canned loop tasks. Each one replays under any of the four loop types; the loop
 * type only changes when the harness decides to Continue or Stop. Criteria are
 * written in the small rule language the local verifier understands (see
 * src/lib/verify.ts), so the scripted path checks real output, not a flag.
 */
export const TASKS: Task[] = [
  {
    id: "landing-copy",
    title: "Refine landing copy",
    blurb: "Iterate on a hero headline + subhead until every copy rule passes.",
    recommended: "goal",
    goal: "Rewrite the landing-page hero for Loopwright, a CI tool that tracks flaky tests, so it is short, concrete, and ends in a trial CTA.",
    criteria: [
      "Headline at most 8 words",
      'Mentions "flaky tests"',
      'Contains "free trial"',
      'No "revolutionary"',
      'No "!"',
    ],
    maxTurns: 6,
    budget: 12000,
    intervalSec: 0,
    steps: [
      {
        act: "Drafted a first hero from the product brief.",
        output:
          "Loopwright: the revolutionary way to finally stop worrying about your CI pipeline!\nCatch unreliable tests before they block a release.",
        tokens: 1850,
        agentDone: false,
      },
      {
        act: "Cut the headline to 6 words and dropped the hype adjective.",
        output:
          "Stop babysitting your CI pipeline!\nLoopwright spots flaky tests before they block a release.",
        tokens: 1620,
        agentDone: false,
      },
      {
        act: "Removed the exclamation mark; tightened the subhead. Looks shippable to me.",
        output:
          "Ship without re-running flaky tests\nLoopwright quarantines flaky tests and tells you who owns each one.",
        tokens: 1540,
        agentDone: true,
      },
      {
        act: "Verifier flagged a missing CTA; added the free-trial line.",
        output:
          "Ship without re-running flaky tests\nLoopwright quarantines flaky tests and tells you who owns each one.\nStart a 14-day free trial, no card required.",
        tokens: 1480,
        agentDone: true,
      },
      {
        act: "Polished the subhead wording.",
        output:
          "Ship without re-running flaky tests\nLoopwright quarantines flaky tests and names an owner for each.\nStart a 14-day free trial, no card required.",
        tokens: 1320,
        agentDone: true,
      },
    ],
  },
  {
    id: "deploy-poll",
    title: "Poll a deploy until green",
    blurb: "Check a fake deploy every 30s and report the URL once it is live.",
    recommended: "time",
    goal: "Watch deploy #482 of the web app and, once it is green, post the production URL to #releases.",
    criteria: ['Contains "status: green"', 'Contains "https://"', 'No "rollback"'],
    maxTurns: 8,
    budget: 6000,
    intervalSec: 30,
    steps: [
      {
        observation: "GET /deploys/482 → { status: queued, position: 2 }",
        act: "Kicked off deploy #482 and checked it once. It's queued; I'll report back later.",
        output: "deploy #482\nstatus: queued (position 2)",
        tokens: 520,
        agentDone: true,
      },
      {
        observation: "GET /deploys/482 → { status: building, progress: 35% }",
        act: "Polled the deploy API.",
        output: "deploy #482\nstatus: building (35%)",
        tokens: 480,
        agentDone: false,
      },
      {
        observation: "GET /deploys/482 → { status: building, progress: 80%, checks: 11/12 }",
        act: "Polled the deploy API; one smoke check still pending.",
        output: "deploy #482\nstatus: building (80%, checks 11/12)",
        tokens: 490,
        agentDone: false,
      },
      {
        observation: "GET /deploys/482 → { status: green, url: https://loopwright-web.example.app }",
        act: "Deploy is green. Posted the URL to #releases.",
        output:
          "deploy #482\nstatus: green\nurl: https://loopwright-web.example.app\nposted to #releases",
        tokens: 610,
        agentDone: true,
      },
    ],
  },
  {
    id: "latency-watch",
    title: "Watch alerts, open an incident",
    blurb: "Idle on an alert stream; act only when p95 latency breaches.",
    recommended: "proactive",
    goal: "Watch the #alerts stream. When checkout p95 latency breaches 1s, open an incident with an owner and a first mitigation.",
    criteria: ['Contains "incident opened"', 'Contains "owner: @"', 'Contains "mitigation:"'],
    maxTurns: 6,
    budget: 8000,
    intervalSec: 60,
    steps: [
      {
        idleBefore: 2,
        trigger: "#alerts · deploy note: web v2.14 rolled out to 10%",
        observation: "p95 /checkout = 420ms (threshold 1s)",
        act: "Read the deploy note; latency is under threshold, nothing to do.",
        output: "no action: p95 420ms < 1s",
        tokens: 380,
        agentDone: false,
      },
      {
        idleBefore: 1,
        trigger: "#alerts · PagerDuty: checkout p95 1.84s for 5m",
        observation: "p95 /checkout = 1840ms; error rate 0.4%; v2.14 at 50%",
        act: "Latency breach. Drafted an incident but no owner is on-call in the schedule cache.",
        output: "incident opened: INC-231 checkout p95 1.84s\nowner: (unassigned)",
        tokens: 1260,
        agentDone: false,
      },
      {
        trigger: "#alerts · on-call handoff: @dana-payments now primary",
        observation: "on-call primary = @dana-payments; v2.14 correlated with regression",
        act: "Assigned the on-call owner and proposed a rollout pause.",
        output:
          "incident opened: INC-231 checkout p95 1.84s\nowner: @dana-payments\nmitigation: pause v2.14 rollout at 50% and shift traffic to v2.13",
        tokens: 940,
        agentDone: true,
      },
    ],
  },
];

export function getTask(id: string): Task | undefined {
  return TASKS.find((t) => t.id === id);
}
