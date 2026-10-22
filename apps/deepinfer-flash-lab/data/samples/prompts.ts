// Preset prompts and JSON schemas. The recorded answers for SAMPLE mode
// live in chat.json and structured.json (written by scripts/build-samples.ts)
// and are joined to these prompts in presets.ts.

export type ChatPrompt = {
  id: string;
  title: string;
  prompt: string;
};

export const CHAT_PRESETS: ChatPrompt[] = [
  {
    id: "spec-decode",
    title: "Explain draft-token decoding",
    prompt: "In three short paragraphs, explain how speculative decoding with draft tokens speeds up LLM inference.",
  },
  {
    id: "haiku",
    title: "Haiku: a GPU that never idles",
    prompt: "Write a haiku about a GPU that never idles, then one sentence on what the metaphor means.",
  },
  {
    id: "sql",
    title: "SQL: top customers",
    prompt: "Write a SQL query that returns the top 5 customers by total order value in 2026, with a one-line explanation.",
  },
  {
    id: "latency-checklist",
    title: "Checklist: measuring LLM latency",
    prompt: "Give me a 5-bullet checklist for measuring LLM latency from a client: TTFT, tokens per second and total latency.",
  },
];

export type StructuredPrompt = {
  id: string;
  title: string;
  prompt: string;
  schema: object;
  note?: string;
};

export const STRUCTURED_PRESETS: StructuredPrompt[] = [
  {
    id: "deepinfer-example",
    title: "DeepInfer example (color + count)",
    note: "Schema from DeepInfer examples/_structured_output.py",
    prompt: "Pick a balloon color and how many balloons to order.",
    schema: {
      type: "object",
      properties: {
        color: { type: "string", enum: ["red", "green", "blue"] },
        count: { type: "integer", enum: [1, 2, 3] },
      },
      required: ["color", "count"],
      additionalProperties: false,
    },
  },
  {
    id: "bug-report",
    title: "Bug report",
    prompt: "File a bug report: the speed gauge keeps animating after the user cancels a stream mid-run.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 8 },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        component: { type: "string" },
        steps: { type: "array", items: { type: "string" }, minItems: 2 },
        reproducible: { type: "boolean" },
      },
      required: ["title", "severity", "component", "steps", "reproducible"],
      additionalProperties: false,
    },
  },
  {
    id: "recipe",
    title: "Recipe card",
    prompt: "A quick vegetarian weeknight noodle recipe for two.",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        servings: { type: "integer", minimum: 1, maximum: 12 },
        minutes: { type: "integer", minimum: 1 },
        vegetarian: { type: "boolean" },
        ingredients: {
          type: "array",
          minItems: 3,
          items: {
            type: "object",
            properties: { item: { type: "string" }, qty: { type: "string" } },
            required: ["item", "qty"],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "servings", "minutes", "vegetarian", "ingredients"],
      additionalProperties: false,
    },
  },
];
