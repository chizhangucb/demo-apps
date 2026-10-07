export type DotId = "researcher" | "writer";

export const PERMISSIONS = ["browser", "files", "shell", "research", "savePage"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type PermissionSet = Record<Permission, boolean>;
export type Permissions = Record<DotId, PermissionSet>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  browser: "Browser",
  files: "Workspace files",
  shell: "Shell",
  research: "Web research",
  savePage: "Save page",
};

export type Dot = {
  id: DotId;
  name: string;
  role: string;
  instructions: string;
  space: string;
  defaultPermissions: PermissionSet;
};

/** One scripted move a Dot makes: say something, or call a simulated tool. */
export type ScriptStep =
  | { say: string }
  | {
      tool: string;
      args: Record<string, unknown>;
      /** Canned output returned when the call is allowed. */
      output: string;
      /** What the Dot says next if the call is allowed / denied. */
      onAllowed?: string;
      onDenied?: string;
    };

export type Finding = { title: string; detail: string; source: string | null };

export type Task = {
  id: string;
  title: string;
  prompt: string;
  researcher: ScriptStep[];
  findings: Finding[];
  handoff: string;
  writer: ScriptStep[];
  page: { title: string; body: string };
};

export type ActivityRow = {
  id: string;
  action: string;
  requestedBy: string;
  status: "allowed" | "denied";
  reason?: string;
  at: number;
};

/** The simulated Dot computer, mirrored to the client via ACTIVITY_SNAPSHOT / ACTIVITY_DELTA. */
export type Computer = {
  dot: DotId;
  browser: { url: string; title: string; snapshot: string } | null;
  files: { path: string; bytes: number }[];
  terminal: string[];
  activity: ActivityRow[];
};

export type Draft = { title: string; body: string; sources: string[] };

/** Shared run state mirrored via STATE_SNAPSHOT / STATE_DELTA. */
export type RunState = {
  task: { id: string; title: string; prompt: string } | null;
  findings: Finding[];
  draft: Draft | null;
  savedPage: SavedPage | null;
};

export type SavedPage = Draft & { id: string; space: string; savedAt: number };

export type ForwardedProps = { taskId?: string; permissions?: Permissions };
