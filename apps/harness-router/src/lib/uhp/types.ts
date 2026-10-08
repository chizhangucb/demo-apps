// Local Unified Harness Protocol (UHP 2026-10-04) types. Wire names match the spec exactly.

export const UHP_VERSION = "2026-10-04";

// ---- Request ----

export type InputContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename?: string; file_data?: string; file_id?: string }
  | { type: "input_image"; image_url?: string; file_id?: string };

export type InputItem = { role: "user" | "system" | "developer"; content: string | InputContentPart[] };

export interface ResponseRequest {
  input: string | InputItem[];
  model?: string;
  metadata?: { harness_id?: string; [key: string]: unknown };
  stream?: boolean;
  previous_response_id?: string;
  instructions?: string;
  store?: boolean;
  max_output_tokens?: number;
  max_step?: number;
  timeout_seconds?: number;
  background?: boolean;
  [unknown: string]: unknown;
}

// ---- Output items ----

export type ItemStatus = "in_progress" | "completed" | "incomplete";

export interface ContainerFileCitation {
  type: "container_file_citation";
  container_id: string;
  file_id: string;
  filename: string;
  download_url: string;
  start_index: number;
  end_index: number;
}

export interface OutputText {
  type: "output_text";
  text: string;
  annotations: ContainerFileCitation[];
}

export interface SummaryText {
  type: "summary_text";
  text: string;
}

export interface MessageItem {
  id: string;
  type: "message";
  role: "assistant";
  status: ItemStatus;
  content: OutputText[];
}

export interface ReasoningItem {
  id: string;
  type: "reasoning";
  summary: SummaryText[];
  status: ItemStatus;
}

export interface FunctionCallItem {
  id: string;
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status: ItemStatus;
}

export interface FunctionCallOutputItem {
  id: string;
  type: "function_call_output";
  call_id: string;
  output: string;
  status: ItemStatus;
}

export type OutputItem = MessageItem | ReasoningItem | FunctionCallItem | FunctionCallOutputItem;

// ---- Response ----

export type ResponseStatus = "in_progress" | "completed" | "failed" | "incomplete" | "cancelled";
export const TERMINAL_STATUSES: ResponseStatus[] = ["completed", "failed", "incomplete", "cancelled"];

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ResponseMetadata {
  session_id: string;
  harness_id: string;
  requested_model?: string;
  model_fallback?: boolean;
  model_fallback_reason?: string;
  ignored_fields?: string[];
  [key: string]: unknown;
}

export interface UhpResponse {
  id: string;
  object: "response";
  created_at: number;
  status: ResponseStatus;
  error: { code: string; message: string } | null;
  incomplete_details: { reason: string } | null;
  previous_response_id: string | null;
  model: string;
  output: OutputItem[];
  store: boolean;
  usage: Usage | null;
  metadata: ResponseMetadata;
}

// ---- Streaming events (sequence_number is added when the stream is serialised) ----

export type StreamEventBody =
  | { type: "response.created" | "response.in_progress"; response: UhpResponse }
  | { type: "response.completed" | "response.incomplete" | "response.failed"; response: UhpResponse }
  | { type: "response.output_item.added" | "response.output_item.done"; output_index: number; item: OutputItem }
  | { type: "response.content_part.added" | "response.content_part.done"; item_id: string; output_index: number; content_index: number; part: OutputText }
  | { type: "response.output_text.delta"; item_id: string; output_index: number; content_index: number; delta: string }
  | { type: "response.output_text.done"; item_id: string; output_index: number; content_index: number; text: string }
  | { type: "response.output_text.annotation.added"; item_id: string; output_index: number; content_index: number; annotation_index: number; annotation: ContainerFileCitation }
  | { type: "response.reasoning_summary_part.added" | "response.reasoning_summary_part.done"; item_id: string; output_index: number; summary_index: number; part: SummaryText }
  | { type: "response.reasoning_summary_text.delta"; item_id: string; output_index: number; summary_index: number; delta: string }
  | { type: "response.function_call_arguments.delta"; item_id: string; output_index: number; delta: string }
  | { type: "response.function_call_arguments.done"; item_id: string; output_index: number; arguments: string }
  | { type: "error"; code: string; message: string; param: string | null };

export type StreamEvent = StreamEventBody & { sequence_number: number };

export const TERMINAL_EVENTS = ["response.completed", "response.incomplete", "response.failed"] as const;

// ---- Errors ----

export type ErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "rate_limit_error"
  | "harness_error"
  | "server_error";

export interface ErrorEnvelope {
  error: { type: ErrorType; code: string; message: string; param: string | null; detail: unknown };
}

// ---- Harnesses, discovery, files ----

export interface Harness {
  id: string;
  object: "harness";
  name: string;
  base: string;
  baseLabel: string;
  defaultModel: string;
  systemPrompt: string;
  mcpServers: string[];
  skills: string[];
  disabledTools: string[];
  maxStep: number;
  timeoutSeconds: number;
  createdAt: number;
}

export interface HarnessModel {
  id: string;
  object: "model";
  available: boolean;
  default: boolean;
}

export interface Discovery {
  object: "uhp.discovery";
  protocol: "uhp";
  versions: string[];
  default_version: string;
  conformance_class: "core" | "extended" | "full";
  capabilities: Record<string, boolean>;
}

export interface SessionFile {
  id: string;
  container_id: string;
  filename: string;
  bytes: number;
  created_at: number;
}
