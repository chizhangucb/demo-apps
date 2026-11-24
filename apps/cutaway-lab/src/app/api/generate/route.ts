import { NextResponse } from "next/server";
import { generateSpec, liveAvailable, LiveError } from "@/server/claude";
import { checkCooldown } from "@/server/cooldown";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof TYPES)[number];

/** Live: one reference image to Claude, a validated ModelSpec back. Any failure is a readable error, never a preset. */
export async function POST(req: Request) {
  if (!liveAvailable()) {
    return NextResponse.json({ error: "Live is unavailable: no ANTHROPIC_API_KEY is configured on this server." }, { status: 503 });
  }
  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { image: base64, mediaType }." }, { status: 400 });
  }
  const data = typeof body.image === "string" ? body.image.replace(/^data:[^,]*,/, "") : "";
  const mediaType = body.mediaType as ImageType;
  if (!data || !TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "Send a JPEG, PNG or WebP image." }, { status: 400 });
  }
  if ((data.length * 3) / 4 > MAX_BYTES) {
    return NextResponse.json({ error: "Image is over 2 MB." }, { status: 413 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const wait = checkCooldown(ip);
  if (wait > 0) return NextResponse.json({ error: `One Live run per 30 s. Try again in ${wait} s.` }, { status: 429 });
  try {
    return NextResponse.json(await generateSpec({ data, mediaType }));
  } catch (err) {
    const e = err instanceof LiveError ? err : new LiveError(err instanceof Error ? err.message : String(err), 502);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
