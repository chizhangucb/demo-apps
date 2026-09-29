export type TargetId = "sample" | "chronicle";
export type ScanMode = "scripted" | "sdk-mock" | "live";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: "high" | "medium" | "low";
  cwe?: string;
  path: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
  rationale: string;
  remediation: string;
  patch: string | null;
  /** Set when the snippet was checked against the fetched checkout. */
  verified?: boolean;
};

export type Checkout = {
  repo: string;
  commit: string | null;
  files: number;
  source: "fetched" | "cache" | "bundled" | "pinned";
  note?: string;
};

export type ScanResult = {
  target: TargetId;
  label: string;
  mode: ScanMode;
  /** The mode that actually produced the findings (falls back to scripted). */
  ranAs: ScanMode;
  findings: Finding[];
  checkout: Checkout;
  durationMs: number;
  warnings: string[];
  reportExcerpt?: string;
};

export type PatchPreview = {
  findingId: string;
  mode: ScanMode;
  patch: string | null;
  remediation: string;
  disposition?: string;
  report?: string;
  warnings: string[];
};

export type Capabilities = {
  hasApiKey: boolean;
  sdkVersion: string;
  python: boolean;
  git: boolean;
};
