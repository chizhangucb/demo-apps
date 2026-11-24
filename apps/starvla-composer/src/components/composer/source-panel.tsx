import { FETCH_DATE, REPO_FACTS, SRC } from "@/lib/data";
import { SourceLink } from "./source-link";

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 border-b border-dashed py-1.5 text-[13px] last:border-0">
    <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{k}</dt>
    <dd className="min-w-0 break-words text-ink">{children}</dd>
  </div>
);

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
    {children}
  </a>
);

export function SourcePanel() {
  const { stableBranch: st, devBranch: dev } = REPO_FACTS;
  return (
    <section className="paper-card flex min-w-0 flex-col gap-2 p-5" aria-label="Sources" data-testid="source-panel">
      <h2 className="font-heading text-xl font-semibold text-ink">Sources and provenance</h2>
      <dl>
        <Row k="Bookmark">
          <A href={SRC.bookmark}>x.com/JinhuiYe/status/2122753570730893678</A>
        </Row>
        <Row k="Repo">
          <A href={SRC.repo}>github.com/starVLA/starVLA</A>{" "}
          <span className="text-muted-foreground">
            · {REPO_FACTS.stars.toLocaleString("en-US")} stars, {REPO_FACTS.forks} forks (GitHub API, {FETCH_DATE})
          </span>
        </Row>
        <Row k="Site">
          <A href={SRC.site}>starvla.github.io</A>
        </Row>
        <Row k="Stable">
          <A href={`${SRC.repo}/tree/${st.sha}`}>
            <code className="font-mono text-[12px]">{st.name}</code> @ <code className="font-mono text-[12px]">{st.sha}</code>
          </A>{" "}
          <span className="text-muted-foreground">({st.date}, verified results)</span>
        </Row>
        <Row k="Dev / default">
          <A href={`${SRC.repo}/tree/${dev.sha}`}>
            <code className="font-mono text-[12px]">{dev.name}</code> @ <code className="font-mono text-[12px]">{dev.sha}</code>
          </A>{" "}
          <span className="text-muted-foreground">({dev.date}, newer integrations)</span>
        </Row>
        <Row k="License">
          <A href={SRC.license}>LICENSE</A>: MIT, copyright StarVLA Team, with two extra clauses (descriptive rebase messages, keep the two latest upstream commits separate). GitHub reports Other / NOASSERTION.
        </Row>
        <Row k="Hugging Face">
          <A href={SRC.hfOrg}>huggingface.co/StarVLA</A>{" "}
          <span className="text-muted-foreground">· {REPO_FACTS.hfModelCount} model repos (Hub API, {FETCH_DATE})</span>
        </Row>
        <Row k="Paper">
          <A href={SRC.arxiv}>arXiv 2604.05014</A> <span className="text-muted-foreground">(technical report). Related: </span>
          <A href={SRC.arxivAlpha}>2604.11757</A>, <A href={SRC.arxivVlact}>2608.27550</A>
        </Row>
        <Row k="Score pages">
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <SourceLink href={SRC.simplerenv} label="SimplerEnv" />
            <SourceLink href={SRC.modelZoo} label="Model zoo" />
            <SourceLink href={SRC.libero} label="LIBERO" />
            <SourceLink href={SRC.robocasa} label="RoboCasa GR1" />
            <SourceLink href={SRC.robotwin} label="RoboTwin" />
            <SourceLink href={SRC.robocasa365} label="RoboCasa365" />
            <SourceLink href={SRC.calvin} label="Calvin" />
          </span>
        </Row>
        <Row k="Lineage">
          Originally forked from <A href={SRC.internvlaM1}>InternVLA-M1</A>.
        </Row>
      </dl>
    </section>
  );
}
