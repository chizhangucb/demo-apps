import { shortSha, treeUrl, UPSTREAM } from "@/lib/sources";

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 underline-offset-2 hover:decoration-[var(--cut-green)]">
    {children}
  </a>
);

export function SourcePanel() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5" aria-labelledby="src-h">
      <h2 id="src-h" className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Source
      </h2>
      <dl className="mt-3 space-y-2.5 text-[13px] leading-snug text-neutral-700">
        <div>
          <dt className="text-neutral-400">Bookmark</dt>
          <dd>
            <A href={UPSTREAM.bookmark}>x.com/isagi1000x/status/2120548035721572620</A>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Skill</dt>
          <dd>
            <A href={UPSTREAM.repo}>github.com/Nyxera0x/cutaway</A>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Vendored commit</dt>
          <dd className="font-mono text-[12px]">
            <A href={treeUrl("sims")}>{shortSha}</A>{" "}
            <span className="break-all text-neutral-400">{UPSTREAM.sha}</span>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Licenses</dt>
          <dd>
            <A href={UPSTREAM.license}>cutaway, MIT</A> (Nyxera0x and whaleyxbt, 2026) and{" "}
            <A href={UPSTREAM.claudeMotion}>claude-motion</A>, <A href={UPSTREAM.claudeMotionLicense}>MIT</A> (kit, capture
            and review rules)
          </dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-neutral-100 pt-3 text-[12px] leading-relaxed text-neutral-500">
        Presets are the upstream objects running in your browser: bodies, tours and timeline.json beat times vendored at{" "}
        {shortSha}. Live is a single Claude pass that returns a data spec, not the full skill loop (no multi-round still
        grading, no 60 fps film, no score). The reference picture is never imported as a mesh or a texture.
      </p>
    </section>
  );
}
