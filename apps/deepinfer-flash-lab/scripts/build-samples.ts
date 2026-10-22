// Builds data/samples/chat.json: the sample answers split into token-sized
// chunks with per-chunk delays, so SAMPLE mode can replay a stream.
// The timings come from a fixed-seed generator and are illustrative only.
// Run: bun run samples

import { CHAT_PRESETS } from "../data/samples/presets";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function chunkText(text: string): string[] {
  return text.match(/\s*[^\s]{1,4}/g) ?? [];
}

type Track = { ttftMs: number; chunks: [string, number][] };

function track(text: string, rand: () => number, meanMs: number, ttftMs: number): Track {
  const chunks: [string, number][] = chunkText(text).map((c) => {
    let d = meanMs * (0.55 + rand() * 0.9);
    if (rand() < 0.04) d += 60 + rand() * 120; // occasional network stall
    return [c, Math.round(d)];
  });
  return { ttftMs, chunks };
}

const out: Record<string, { reasoning: Track; answer: Track }> = {};
CHAT_PRESETS.forEach((p, i) => {
  const rand = rng(1017 + i * 31);
  const mean = 1000 / (62 + i * 6);
  out[p.id] = {
    reasoning: track(p.reasoning, rand, mean, 380 + Math.round(rand() * 160)),
    answer: track(p.answer, rand, mean, 460 + Math.round(rand() * 240)),
  };
});

await Bun.write(new URL("../data/samples/chat.json", import.meta.url), JSON.stringify(out) + "\n");
console.log("wrote data/samples/chat.json", Object.keys(out));
