// The JSON mode prompt shared by the server and the sample recorder.

// Build a filled example of the target shape from a schema, since the
// DeepSeek JSON mode docs ask for an example in the prompt.
export function exampleFor(schema: unknown): unknown {
  const s = (schema ?? {}) as Record<string, unknown>;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  switch (s.type) {
    case "object": {
      const props = (s.properties ?? {}) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, exampleFor(v)]));
    }
    case "array":
      return [exampleFor(s.items)];
    case "integer":
    case "number":
      return typeof s.minimum === "number" ? s.minimum : 1;
    case "boolean":
      return true;
    case "string":
      return "...";
    default:
      return null;
  }
}

export function structuredMessages(schema: object, prompt: string) {
  return [
    {
      role: "system",
      content:
        "Reply with a single json object only, no prose. It must conform to this JSON schema:\n" +
        JSON.stringify(schema) +
        "\nExample json output shape:\n" +
        JSON.stringify(exampleFor(schema)),
    },
    { role: "user", content: prompt },
  ];
}
