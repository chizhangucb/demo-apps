// Preset prompts and the hand-written sample answers used in SAMPLE mode.
// No API key was available when these were written, so the text is an
// illustrative sample, not a recording of a real DeepSeek response. Chunk
// timings for replay live in chat.json (built by scripts/build-samples.ts).

export type ChatPreset = {
  id: string;
  title: string;
  prompt: string;
  reasoning: string;
  answer: string;
};

export const CHAT_PRESETS: ChatPreset[] = [
  {
    id: "spec-decode",
    title: "Explain draft-token decoding",
    prompt: "In three short paragraphs, explain how speculative decoding with draft tokens speeds up LLM inference.",
    reasoning:
      "The user wants three short paragraphs. Cover the problem first: one token per forward pass is memory bound. Then the idea: a cheap draft proposes several tokens and the big model checks them in one pass. Then the catch: rejected drafts waste compute, so how many to verify matters.",
    answer: `A large language model normally produces one token per forward pass. Each pass has to stream the model weights through the GPU, so at small batch sizes the hardware spends most of its time moving memory rather than doing math, and per-user speed is capped by that loop.

Speculative decoding adds a cheap draft step. A small draft head guesses the next few tokens, then the full model checks all of them in a single forward pass. Every guess that matches what the full model would have produced is accepted for free, so one expensive pass can emit several tokens instead of one.

The trade-off is wasted work. When a draft token is rejected, everything after it is thrown away, and verifying long drafts costs compute that a busy server could have spent on other requests. That is why schedulers try to verify only the draft tokens that are likely to be accepted, keeping the speedup while trimming the waste.`,
  },
  {
    id: "haiku",
    title: "Haiku: a GPU that never idles",
    prompt: "Write a haiku about a GPU that never idles, then one sentence on what the metaphor means.",
    reasoning:
      "Five, seven, five. Image: the CPU plans the next step while the GPU is still busy with this one. Keep the explanation to one sentence.",
    answer: `Kernels hum all night,
the planner sketches step two
while step one still burns.

The metaphor is pipelining: the CPU prepares the next batch while the GPU is still computing the current one, so the accelerator never waits.`,
  },
  {
    id: "sql",
    title: "SQL: top customers",
    prompt: "Write a SQL query that returns the top 5 customers by total order value in 2026, with a one-line explanation.",
    reasoning:
      "Join customers to orders, filter on order date within 2026, group by customer, sum the amount, order descending, limit 5. Use a half-open date range so it works on timestamps.",
    answer: `\`\`\`sql
SELECT c.id,
       c.name,
       SUM(o.total_amount) AS total_2026
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.id
WHERE o.created_at >= '2026-01-01'
  AND o.created_at <  '2027-01-01'
GROUP BY c.id, c.name
ORDER BY total_2026 DESC
LIMIT 5;
\`\`\`

It sums each customer's 2026 orders with a half-open date range, then keeps the five largest totals.`,
  },
  {
    id: "latency-checklist",
    title: "Checklist: measuring LLM latency",
    prompt: "Give me a 5-bullet checklist for measuring LLM latency from a client: TTFT, tokens per second and total latency.",
    reasoning:
      "Five bullets. Define where the clock starts, what counts as first token, how to count tokens, how to compute decode speed, and why to repeat runs.",
    answer: `- Start the clock when the request leaves the client, not when the server accepts it, so network and queueing time are included.
- Record time to first token (TTFT) at the first streamed chunk that carries text, ignoring empty keep-alive events.
- Count completion tokens from the provider's usage field when it is reported; otherwise estimate from characters and label it as an estimate.
- Compute decode speed as completion tokens divided by the time after the first token, so TTFT does not drag the rate down.
- Repeat each prompt several times and report the median, because a single run over the internet is noisy.`,
  },
];

export type StructuredPreset = {
  id: string;
  title: string;
  prompt: string;
  schema: object;
  sampleOutput: object;
  sampleLatencyMs: number;
  note?: string;
};

export const STRUCTURED_PRESETS: StructuredPreset[] = [
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
    sampleOutput: { color: "blue", count: 3 },
    sampleLatencyMs: 912,
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
    sampleOutput: {
      title: "Speed gauge keeps animating after stream cancel",
      severity: "medium",
      component: "speed-gauge",
      steps: ["Start a streamed run from the playground", "Press Stop before the answer finishes", "Watch the gauge needle"],
      reproducible: true,
    },
    sampleLatencyMs: 1684,
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
    sampleOutput: {
      name: "Sesame garlic noodles",
      servings: 2,
      minutes: 20,
      vegetarian: true,
      ingredients: [
        { item: "wheat noodles", qty: "200 g" },
        { item: "garlic", qty: "3 cloves" },
        { item: "soy sauce", qty: "2 tbsp" },
        { item: "sesame oil", qty: "1 tbsp" },
        { item: "spring onions", qty: "2" },
      ],
    },
    sampleLatencyMs: 2140,
  },
];
