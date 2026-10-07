import { describe, expect, test } from "bun:test";
import { defaultPermissions } from "../src/lib/catalog";
import { checkTool, normalizePermissions, permissionFor } from "../src/lib/permissions";

describe("permission gate", () => {
  const perms = defaultPermissions();

  test("maps tools to permissions", () => {
    expect(permissionFor("browser.navigate")).toBe("browser");
    expect(permissionFor("files.write")).toBe("files");
    expect(permissionFor("shell.run")).toBe("shell");
    expect(permissionFor("page.save")).toBe("savePage");
    expect(permissionFor("rm.rf")).toBeNull();
  });

  test("Writer browser is off by default", () => {
    expect(checkTool("writer", "browser.navigate", { url: "https://x.dev" }, perms)).toEqual({
      allowed: false,
      reason: "browser permission disabled",
    });
    expect(checkTool("researcher", "browser.navigate", { url: "https://x.dev" }, perms).allowed).toBe(true);
  });

  test("files must stay in the Dot's workspace", () => {
    expect(checkTool("researcher", "files.read", { path: "notes.md" }, perms).allowed).toBe(true);
    expect(checkTool("researcher", "files.read", { path: "../writer/draft.md" }, perms)).toEqual({
      allowed: false,
      reason: "path outside researcher workspace",
    });
    expect(checkTool("researcher", "files.read", { path: "/etc/passwd" }, perms).allowed).toBe(false);
  });

  test("unknown tools and missing permissions are denied", () => {
    expect(checkTool("writer", "net.fetch", {}, perms).allowed).toBe(false);
    const none = normalizePermissions({ writer: { browser: "yes", shell: 1 } });
    expect(none.writer.browser).toBe(false);
    expect(none.writer.shell).toBe(false);
    expect(none.researcher.files).toBe(false);
  });
});
