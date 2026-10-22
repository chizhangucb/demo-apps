// Incremental Server-Sent Events parser. Feed it raw text chunks as they
// arrive; it returns the complete `data:` payloads and keeps the remainder.

export type SSEParser = {
  push(chunk: string): string[];
  flush(): string[];
};

export function createSSEParser(): SSEParser {
  let buffer = "";
  let dataLines: string[] = [];

  function takeLine(line: string, out: string[]) {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line === "") {
      if (dataLines.length) out.push(dataLines.join("\n"));
      dataLines = [];
      return;
    }
    if (line.startsWith(":")) return; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
  }

  return {
    push(chunk) {
      buffer += chunk;
      const out: string[] = [];
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        takeLine(buffer.slice(0, nl), out);
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
      return out;
    },
    flush() {
      const out: string[] = [];
      if (buffer) takeLine(buffer, out);
      buffer = "";
      takeLine("", out);
      return out;
    },
  };
}

export type ChatDelta = {
  content?: string;
  reasoning?: string;
  completionTokens?: number;
  done?: boolean;
};

// Map one OpenAI-format chat.completion.chunk payload (DeepSeek and
// OpenRouter both use it) to the pieces the lab cares about.
export function parseChatChunk(data: string): ChatDelta | null {
  if (data.trim() === "[DONE]") return { done: true };
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const obj = json as {
    choices?: { delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null } }[];
    usage?: { completion_tokens?: number } | null;
  };
  const delta = obj.choices?.[0]?.delta;
  const out: ChatDelta = {};
  if (delta?.content) out.content = delta.content;
  const reasoning = delta?.reasoning_content ?? delta?.reasoning;
  if (reasoning) out.reasoning = reasoning;
  if (typeof obj.usage?.completion_tokens === "number") out.completionTokens = obj.usage.completion_tokens;
  return out;
}
