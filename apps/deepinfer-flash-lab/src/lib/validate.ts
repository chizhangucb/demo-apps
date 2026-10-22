import Ajv, { type ErrorObject } from "ajv";

export type FieldResult = {
  field: string;
  ok: boolean;
  value: unknown;
  present: boolean;
  messages: string[];
};

export type ValidationReport = {
  valid: boolean;
  parseError: string | null;
  schemaError: string | null;
  fields: FieldResult[];
  rootErrors: string[];
};

function fieldOf(e: ErrorObject): string | null {
  if (e.keyword === "required" && e.instancePath === "") {
    return String((e.params as { missingProperty?: string }).missingProperty ?? "");
  }
  const m = /^\/([^/]+)/.exec(e.instancePath);
  return m ? m[1].replace(/~1/g, "/").replace(/~0/g, "~") : null;
}

function describe(e: ErrorObject): string {
  if (e.keyword === "required") return "missing (required)";
  if (e.keyword === "enum") {
    const allowed = (e.params as { allowedValues?: unknown[] }).allowedValues ?? [];
    return `must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`;
  }
  if (e.keyword === "additionalProperties") {
    return `unexpected property "${(e.params as { additionalProperty?: string }).additionalProperty}"`;
  }
  const where = e.instancePath.split("/").slice(2).join(".");
  return `${where ? where + " " : ""}${e.message ?? e.keyword}`;
}

// Validate a JSON string against a JSON schema and report pass or fail per
// top-level field, plus any errors that belong to the root object.
export function validateJson(schema: unknown, raw: string): ValidationReport {
  const report: ValidationReport = { valid: false, parseError: null, schemaError: null, fields: [], rootErrors: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    report.parseError = err instanceof Error ? err.message : "invalid JSON";
    return report;
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  let validate;
  try {
    validate = ajv.compile(schema as object);
  } catch (err) {
    report.schemaError = err instanceof Error ? err.message : "invalid schema";
    return report;
  }
  report.valid = validate(data) as boolean;
  const errors = validate.errors ?? [];

  const props = (schema as { properties?: Record<string, unknown> })?.properties ?? {};
  const obj = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const names = new Set<string>(Object.keys(props));
  for (const e of errors) {
    const f = fieldOf(e);
    if (f && e.keyword !== "additionalProperties") names.add(f);
  }
  for (const name of names) {
    const msgs = errors.filter((e) => e.keyword !== "additionalProperties" && fieldOf(e) === name).map(describe);
    report.fields.push({ field: name, ok: msgs.length === 0, value: obj[name], present: name in obj, messages: msgs });
  }
  report.rootErrors = errors.filter((e) => fieldOf(e) === null || e.keyword === "additionalProperties").map(describe);
  return report;
}
