"use client";

import { CloudOff, Radio } from "lucide-react";
import { CATALOG, type CatalogGroup, DATASETS, FETCH_DATE, REPO_FACTS, SRC } from "@/lib/data";
import { SourceLink } from "./source-link";
import { useHubList } from "./use-hub";

const GROUPS: CatalogGroup[] = ["Modified / tokenizer", "SimplerEnv / Bridge", "LIBERO", "RoboCasa GR1", "RoboTwin", "BEHAVIOR", "RoboDojo", "VLAct"];

export function CatalogPanel({ offline }: { offline: boolean }) {
  const live = useHubList(offline);
  return (
    <section className="paper-card flex min-w-0 flex-col gap-3 p-5" aria-label="Official catalog" data-testid="catalog-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-ink">Official Hugging Face catalog</h2>
        <SourceLink href={SRC.hfOrg} label="huggingface.co/StarVLA" />
      </div>
      <p className="text-[13px] text-muted-foreground">
        Vendored snapshot: <b className="text-ink">{REPO_FACTS.hfModelCount} model repos</b> and {REPO_FACTS.hfDatasetCount} dataset repos from the public Hub API on {FETCH_DATE}. The homepage still said {REPO_FACTS.homepageCheckpointClaim}.
        Community forks found by search are not treated as official.
      </p>

      <div className="rounded-lg border px-3 py-2 text-[12.5px]" data-testid="catalog-live">
        {"state" in live ? (
          <span className="font-mono text-muted-foreground">Live list lookup: checking huggingface.co/api/models?author=StarVLA ...</span>
        ) : live.ok ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.93_0.06_150)] px-2 py-0.5 font-mono text-[10.5px] font-medium text-[oklch(0.33_0.09_150)]">
              <Radio className="size-3" /> LIVE Hub list
            </span>
            <span>
              <b className="font-mono">{live.count}</b> StarVLA model repos right now.{" "}
              {live.added.length === 0 && live.missing.length === 0
                ? "Same ids as the vendored snapshot."
                : `${live.added.length} new since the snapshot, ${live.missing.length} snapshot ids missing.`}
            </span>
          </span>
        ) : (
          <span className="flex items-start gap-1.5 text-[oklch(0.42_0.14_27)]" data-testid="catalog-unavailable">
            <CloudOff className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <b>Live lookup unavailable.</b> {live.reason} The list below is the vendored {FETCH_DATE} catalog, not live data.
            </span>
          </span>
        )}
      </div>

      <div className="gap-6 sm:columns-2">
        {GROUPS.map((g) => {
          const items = CATALOG.filter((e) => e.group === g);
          return (
            <div key={g} className="mb-3 break-inside-avoid">
              <h3 className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {g} ({items.length})
              </h3>
              <ul className="space-y-0.5">
                {items.map((e) => (
                  <li key={e.id} className="truncate font-mono text-[11.5px]">
                    <a href={`https://huggingface.co/${e.id}`} target="_blank" rel="noreferrer" className="text-ink hover:underline" title={e.id}>
                      {e.id.replace("StarVLA/", "")}
                    </a>
                    {e.downloads !== undefined && (
                      <span className="block pl-3 text-[10.5px] text-muted-foreground">{e.downloads} downloads, {e.likes} likes at snapshot</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="mb-3 break-inside-avoid">
          <h3 className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Datasets ({DATASETS.length})</h3>
          <ul className="space-y-0.5">
            {DATASETS.map((d) => (
              <li key={d} className="truncate font-mono text-[11.5px] text-muted-foreground">
                {d.replace("StarVLA/", "")}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground">Download and like counts in the snapshot are Hub totals at fetch time and change over time.</p>
    </section>
  );
}
