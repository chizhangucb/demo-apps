import { REPO_STATS, snapshot, SOURCES } from "@/lib/data";
import { Section } from "./section";

const LINKS: [string, string, string][] = [
  ["Bookmark", SOURCES.bookmark, "The post that picked this demo"],
  ["GitHub repo", SOURCES.repo, "mll-lab-nu/embodied-first-exam"],
  ["Site", SOURCES.site, "embodied-first-exam.ai"],
  ["Leaderboard", SOURCES.leaderboard, "Official board this app mirrors"],
  ["Failure-analysis post", SOURCES.failureAnalysis, "Written against ten agents (before Qwen4 Max)"],
  ["RoboDojo suite page", SOURCES.robodojo, "Source of the prompt table"],
  ["Report", SOURCES.report, "Agentic robotics benchmark write-up"],
  ["Paper, arXiv 2611.12177", SOURCES.paper, "Abstract describes an older 456-task, eight-agent run"],
  ["LICENSE (MIT)", SOURCES.license, "Copyright 2026 Kangrui Wang and Embodied First Exam contributors"],
];

function Sha({ label, sha, href, note }: { label: string; sha: string; href: string; note: string }) {
  return (
    <div className="py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <a href={href} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] break-all underline">
        {sha}
      </a>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

export function SourcePanel() {
  return (
    <Section id="sources" number="5" title="Sources and limits">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-sm border border-foreground/60 bg-card px-4 py-3">
          <ul className="divide-y divide-dotted divide-border">
            {LINKS.map(([label, href, note]) => (
              <li key={href} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                <a href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                  {label}
                </a>
                <span className="text-xs text-muted-foreground">{note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            GitHub API on {REPO_STATS.fetched}: {REPO_STATS.stars} stars, {REPO_STATS.forks} forks. EFE is MIT licensed;
            third-party simulators, assets, reference solutions derived from upstream experts, and base image contents
            keep their own licenses.
          </p>
        </div>
        <div className="rounded-sm border border-foreground/60 bg-card px-4 py-3">
          <Sha
            label="Website data commit"
            sha={snapshot.site_commit}
            href={SOURCES.siteCommit}
            note="24 November 2026, 8:07:42 PM PT (exam.json and tasks.json)"
          />
          <Sha
            label="Exam task-set commit"
            sha={snapshot.task_set_commit}
            href={SOURCES.examCommit}
            note="24 November 2026, 8:05:39 PM PT"
          />
          <dl className="mt-2 space-y-1.5 text-xs leading-relaxed">
            <div>
              <dt className="inline font-semibold">Results window: </dt>
              <dd className="inline">
                batch evaluation from 2 October to 23 November 2026, the latest finished attempt per agent and test.
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Leaderboard footer: </dt>
              <dd className="inline">questions as of 24 November 2026, results updated 24 November 2026.</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Vendored: </dt>
              <dd className="inline">{snapshot.fetched_at_pt}. No live scrape; the app ships this snapshot.</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-4 rounded-sm border-2 border-dashed border-foreground/50 px-4 py-3 text-[13px] leading-relaxed">
        <p className="font-semibold">
          This is a scoreboard of published EFE results. It does not run Harbor, a simulator, or a coding agent.
        </p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-foreground/80">
          <li>Core set only: 481 tasks, 951 tests. The 675 easy tasks are not on the official board.</li>
          <li>Success is the official S mark (verifier reward of at least 1 within the token budget), one counted attempt per agent and test.</li>
          <li>Differences of a few tests, especially in a small suite or in Realtime, may come from variation between runs.</li>
          <li>Each result belongs to a model in its harness. All results are in simulation.</li>
          <li>Models may remember solutions of public benchmarks that some suites adapt.</li>
          <li>The older Hugging Face leaderboard dump (2026-11-21, ten agents, no Qwen4 Max) is not mixed in.</li>
        </ul>
      </div>
    </Section>
  );
}
