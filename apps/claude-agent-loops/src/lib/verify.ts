import type { CriterionResult } from "@/lib/types";

const quoted = (s: string) => s.match(/["“'‘]([^"”'’]+)["”'’]/)?.[1];

/**
 * Local verifier: understands a handful of plain-English rule shapes
 * ("Headline at most 8 words", 'Contains "free trial"', 'No "!"').
 * Anything else comes back "unchecked" — the live path hands those to Claude.
 */
export function checkCriterion(criterion: string, output: string): CriterionResult {
  const text = output.toLowerCase();
  const c = criterion.trim();

  const words = c.match(/(?:at most|no more than|under|max(?:imum)?|≤|<=)\s*(\d+)\s*words?/i);
  if (words) {
    const limit = Number(words[1]) - (/under/i.test(c) ? 1 : 0);
    const scope = /headline|first line|title/i.test(c) ? output.split("\n")[0] : output;
    const n = scope.trim().split(/\s+/).filter(Boolean).length;
    return {
      criterion,
      by: "rule",
      status: n <= limit ? "pass" : "fail",
      note: `${n} word${n === 1 ? "" : "s"} (limit ${limit})`,
    };
  }

  const needle = quoted(c);
  if (needle && /^(no|without|avoid|never|does not contain|excludes?)\b/i.test(c)) {
    const hit = text.includes(needle.toLowerCase());
    return { criterion, by: "rule", status: hit ? "fail" : "pass", note: hit ? `found “${needle}”` : `no “${needle}”` };
  }
  if (needle && /^(contains?|mentions?|includes?|has|says)\b/i.test(c)) {
    const hit = text.includes(needle.toLowerCase());
    return { criterion, by: "rule", status: hit ? "pass" : "fail", note: hit ? `found “${needle}”` : `missing “${needle}”` };
  }

  return { criterion, by: "none", status: "unchecked", note: "no local rule — needs an LLM judge (live mode)" };
}

export function checkAll(criteria: string[], output: string): CriterionResult[] {
  return criteria.map((c) => checkCriterion(c, output));
}

/** Verified = nothing failing and at least one criterion actually checked. */
export function isVerified(results: CriterionResult[]): boolean {
  return results.some((r) => r.status === "pass") && results.every((r) => r.status !== "fail");
}
