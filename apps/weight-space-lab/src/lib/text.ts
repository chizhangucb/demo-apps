// Output-shape helpers. These describe the text only; they are not a grader.

export function trimTrailing(s: string): string {
  return s.replace(/\s+$/u, "");
}

export function hasBoxed(s: string): boolean {
  return s.includes("\\boxed");
}

export function closesThinking(s: string): boolean {
  return s.includes("</think>");
}

/** Last \boxed{...} with balanced braces, or null. */
export function lastBoxed(s: string): string | null {
  const at = s.lastIndexOf("\\boxed{");
  if (at < 0) return null;
  let depth = 0;
  const start = at + "\\boxed{".length;
  for (let i = start - 1; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i);
    }
  }
  return null;
}

export type Segment = { text: string; repeat: boolean };
export type RepetitionReport = {
  segments: Segment[];
  repeatedLines: number;
  totalLines: number;
  firstRepeatChar: number | null;
};

/**
 * Marks lines that are exact copies of an earlier line (after trimming) and
 * at least `minLen` characters long. Pure string matching, no scoring.
 */
export function detectRepetition(s: string, minLen = 40): RepetitionReport {
  const lines = s.split("\n");
  const seen = new Set<string>();
  const segments: Segment[] = [];
  let repeatedLines = 0;
  let totalLines = 0;
  let firstRepeatChar: number | null = null;
  let offset = 0;
  let buf = "";
  let bufRepeat = false;
  const flush = () => {
    if (buf) segments.push({ text: buf, repeat: bufRepeat });
    buf = "";
  };
  lines.forEach((line, i) => {
    const key = line.trim();
    const last = i === lines.length - 1;
    const piece = last ? line : line + "\n";
    let rep = false;
    if (key.length >= minLen) {
      totalLines++;
      if (seen.has(key)) {
        rep = true;
        repeatedLines++;
        if (firstRepeatChar === null) firstRepeatChar = offset;
      } else seen.add(key);
    }
    if (rep !== bufRepeat) {
      flush();
      bufRepeat = rep;
    }
    buf += piece;
    offset += piece.length;
  });
  flush();
  return { segments, repeatedLines, totalLines, firstRepeatChar };
}
