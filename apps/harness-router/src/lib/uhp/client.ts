import type { ErrorEnvelope, StreamEvent } from "./types";

// Browser side of UHP: a tiny SSE reader over fetch. No SDK needed.

export const API_BASE = "/api/uhp";

export interface HttpError {
  status: number;
  envelope: ErrorEnvelope;
}

export async function readError(res: Response): Promise<HttpError> {
  try {
    return { status: res.status, envelope: (await res.json()) as ErrorEnvelope };
  } catch {
    return {
      status: res.status,
      envelope: { error: { type: "server_error", code: "bad_response", message: `HTTP ${res.status}`, param: null, detail: null } },
    };
  }
}

/** Read `data: {json}` messages until the stream ends. Comment lines (`: keep-alive`) are skipped. */
export async function readSse(res: Response, onEvent: (e: StreamEvent) => void): Promise<void> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const message = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = message
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as StreamEvent);
    }
  }
}

export function toDataUrl(mime: string, text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:${mime};base64,${btoa(bin)}`;
}
