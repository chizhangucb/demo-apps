import { describe, expect, test } from "bun:test";
import { resolveMode, resolveProvider } from "../src/lib/mode";

describe("mode resolution", () => {
  test("no keys means SAMPLE", () => {
    expect(resolveMode({}).mode).toBe("sample");
    expect(resolveMode({ DEEPSEEK_API_KEY: "  " }).mode).toBe("sample");
    expect(resolveProvider({})).toBeNull();
  });

  test("DeepSeek wins over OpenRouter, with model override", () => {
    const m = resolveMode({ DEEPSEEK_API_KEY: "sk-a", OPENROUTER_API_KEY: "sk-b" });
    expect(m).toEqual({ mode: "deepseek", label: "LIVE (DeepSeek)", provider: "DeepSeek API", model: "deepseek-flash" });
    expect(resolveMode({ DEEPSEEK_API_KEY: "sk-a", DEEPSEEK_MODEL: "deepseek-x" }).model).toBe("deepseek-x");
    expect(resolveProvider({ DEEPSEEK_API_KEY: "sk-a" })?.url).toBe("https://api.deepseek.com/chat/completions");
  });

  test("OpenRouter fallback", () => {
    const m = resolveMode({ OPENROUTER_API_KEY: "sk-b" });
    expect(m.mode).toBe("openrouter");
    expect(m.model).toBe("deepseek/deepseek-v4.1-flash");
    expect(resolveMode({ OPENROUTER_API_KEY: "sk-b", OPENROUTER_MODEL: "x/y" }).model).toBe("x/y");
  });

  test("mode info never carries the key", () => {
    const m = resolveMode({ DEEPSEEK_API_KEY: "sk-secret" });
    expect(JSON.stringify(m)).not.toContain("sk-secret");
  });
});
