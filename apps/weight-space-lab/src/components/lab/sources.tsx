import { ExtLink } from "./weight-explorer";
import { AUTHOR_RESULTS, BASE_MODEL, BASE_REVISION, EDITED_MODEL, EVAL_SETTINGS, PROMPT_SUFFIX, RERUN_COMPUTE, RERUN_RESULTS, SRC } from "@/lib/sources";

export function Sources() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="lab-panel p-4" style={{ boxShadow: "inset 0 2px 0 var(--base)" }}>
          <div className="lab-label">source A · author results</div>
          <h2 className="font-heading text-lg font-semibold">Blog post, Experiment 8 (p50c, 50 forward passes)</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Reported by the authors for the original vs the 50-pass edit, thinking on, up to 32,768 tokens.</p>
          <table className="mt-3 w-full font-mono text-[12px] tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border"><th className="py-1 text-left font-normal">metric</th><th className="py-1 text-right font-normal">original</th><th className="py-1 text-right font-normal">edited</th></tr>
            </thead>
            <tbody>
              {AUTHOR_RESULTS.map((r) => (
                <tr key={r.metric} className="border-b border-border/60">
                  <td className="py-1.5">{r.metric}</td>
                  <td className="py-1.5 text-right text-base">{r.base}</td>
                  <td className="py-1.5 text-right text-edited">{r.edited}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px]">
            <ExtLink href={SRC.blog}>rikiyat.github.io blog</ExtLink>
            <ExtLink href={SRC.benchmarksJson}>benchmarks.json</ExtLink>
            <ExtLink href={SRC.trajectoriesJson}>trajectories.json</ExtLink>
            <ExtLink href={SRC.logsRepo}>lm_understand-logs</ExtLink>
          </div>
        </section>
        <section className="lab-panel p-4" style={{ boxShadow: "inset 0 2px 0 var(--edited)" }}>
          <div className="lab-label">source B · independent Hugging Face re-run</div>
          <h2 className="font-heading text-lg font-semibold">akhaliq model card, 2026-11-02</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Same protocol, different run sizes. Do not combine these numbers with source A or with each other.</p>
          <table className="mt-3 w-full font-mono text-[12px] tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border"><th className="py-1 text-left font-normal">model</th><th className="py-1 text-right font-normal">MATH-500</th><th className="py-1 text-right font-normal">cut at 32k</th></tr>
            </thead>
            <tbody>
              {RERUN_RESULTS.map((r) => (
                <tr key={r.model} className="border-b border-border/60 align-top">
                  <td className="py-1.5">{r.model}<div className="text-[10.5px] text-muted-foreground">{r.scope}</div></td>
                  <td className="py-1.5 text-right">{r.accuracy}</td>
                  <td className="py-1.5 text-right">{r.cut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-muted-foreground">Compute: {RERUN_COMPUTE}. The 20 paired outputs in Compare come from this re-run&apos;s eval/ samples.</p>
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px]">
            <ExtLink href={SRC.modelCard}>model card</ExtLink>
            <ExtLink href={SRC.evalDir}>eval/ samples</ExtLink>
            <ExtLink href={SRC.math500}>MATH-500 dataset</ExtLink>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="lab-panel p-4">
          <div className="lab-label">evaluation protocol (both sources)</div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
            {EVAL_SETTINGS.map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
            ))}
            <dt className="text-muted-foreground">prompt suffix</dt><dd className="break-words">{PROMPT_SUFFIX}</dd>
            <dt className="text-muted-foreground">base</dt><dd className="break-all">{BASE_MODEL} @ {BASE_REVISION}</dd>
            <dt className="text-muted-foreground">edited</dt><dd className="break-all">{EDITED_MODEL}</dd>
          </dl>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            The authors evaluated a text-only export; the re-run used the full multimodal checkpoint. The language-model tensors were hash-verified identical.
          </p>
        </section>
        <section className="lab-panel p-4">
          <div className="lab-label">scope limits</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-foreground/90">
            <li>This app runs no model weights. There is no GPU behind it, and a serverless deploy cannot host one. The re-run alone took {RERUN_COMPUTE.split(" (")[0]}.</li>
            <li>Compare shows recorded outputs from the re-run. Live mode is a best-effort call to a third-party Space and is usually refused by its GPU quota.</li>
            <li>The weight diff holds edited values only. Base weights are not in it and are not shown.</li>
            <li>Repetition and \boxed indicators describe text shape. They are not a grader; gold answers are MATH-500 references.</li>
            <li>The authors note that removing loops is not the same as teaching the model more math: remaining errors include wrong math, missing boxes and some degeneration.</li>
          </ul>
        </section>
      </div>

      <section className="lab-panel p-4">
        <div className="lab-label">all sources</div>
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 font-mono text-[12px] sm:grid-cols-2">
          <li><ExtLink href={SRC.bookmark}>Bookmark: @rikiyatakehi on X</ExtLink></li>
          <li><ExtLink href={SRC.blog}>Blog: Sparks of Weight Space Programming</ExtLink></li>
          <li><ExtLink href={SRC.editDir}>Edit diff: exp8_math/runs/p50c/edit (CC BY 4.0 / MIT)</ExtLink></li>
          <li><ExtLink href={SRC.editManifest}>manifest.json</ExtLink></li>
          <li><ExtLink href={SRC.modelCard}>Edited checkpoint (akhaliq), Apache-2.0</ExtLink></li>
          <li><ExtLink href={SRC.authorModel}>RikiyaT model page</ExtLink></li>
          <li><ExtLink href={SRC.baseModel}>Base: Qwen/Qwen3.5-0.8B</ExtLink></li>
          <li><ExtLink href={SRC.space}>Space: ML-Intern-lab/weight-space-programming-demo</ExtLink></li>
        </ul>
      </section>
    </div>
  );
}
