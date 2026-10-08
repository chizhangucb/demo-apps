import type { OutputItem, StreamEvent, StreamEventBody, UhpResponse } from "./types";

// One reducer folds SSE events into a response. The server uses it to rebuild a partial response
// at any instant (GET, cancel); the browser uses the same code to render the live stream.

const clone = <T,>(v: T): T => structuredClone(v);

export function applyEvent(resp: UhpResponse | null, ev: StreamEventBody | StreamEvent): UhpResponse | null {
  switch (ev.type) {
    case "response.created":
    case "response.in_progress":
    case "response.completed":
    case "response.incomplete":
    case "response.failed":
      return clone(ev.response);
    case "error":
      return resp;
  }
  if (!resp) return resp;
  const next: UhpResponse = { ...resp, output: [...resp.output] };
  const at = ev.output_index;
  const item = next.output[at] ? (clone(next.output[at]) as OutputItem) : undefined;
  switch (ev.type) {
    case "response.output_item.added":
    case "response.output_item.done":
      next.output[at] = clone(ev.item);
      return next;
  }
  if (!item) return next;
  switch (ev.type) {
    case "response.content_part.added":
    case "response.content_part.done":
      if (item.type === "message") item.content[ev.content_index] = clone(ev.part);
      break;
    case "response.output_text.delta":
      if (item.type === "message") item.content[ev.content_index].text += ev.delta;
      break;
    case "response.output_text.done":
      if (item.type === "message") item.content[ev.content_index].text = ev.text;
      break;
    case "response.output_text.annotation.added":
      if (item.type === "message") item.content[ev.content_index].annotations[ev.annotation_index] = clone(ev.annotation);
      break;
    case "response.reasoning_summary_part.added":
    case "response.reasoning_summary_part.done":
      if (item.type === "reasoning") item.summary[ev.summary_index] = clone(ev.part);
      break;
    case "response.reasoning_summary_text.delta":
      if (item.type === "reasoning") item.summary[ev.summary_index].text += ev.delta;
      break;
    case "response.function_call_arguments.delta":
      if (item.type === "function_call") item.arguments += ev.delta;
      break;
    case "response.function_call_arguments.done":
      if (item.type === "function_call") item.arguments = ev.arguments;
      break;
  }
  next.output[at] = item;
  return next;
}

/** True when sequence numbers run 0, 1, 2, ... with no gaps or repeats. */
export function isGapless(events: { sequence_number: number }[]): boolean {
  return events.every((e, i) => e.sequence_number === i);
}
