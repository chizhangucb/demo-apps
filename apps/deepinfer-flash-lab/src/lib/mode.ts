// Server-side mode resolution. Never returns a key, only which path is active.

export type ModeId = "deepseek" | "openrouter" | "sample";

export type ModeInfo = {
  mode: ModeId;
  label: string;
  provider: string;
  model: string;
};

export type ProviderConfig = ModeInfo & { url: string; key: string };

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-flash";
export const OPENROUTER_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";

type Env = Record<string, string | undefined>;

function clean(v: string | undefined) {
  const s = v?.trim();
  return s ? s : undefined;
}

export function resolveProvider(env: Env): ProviderConfig | null {
  const ds = clean(env.DEEPSEEK_API_KEY);
  if (ds) {
    return {
      mode: "deepseek",
      label: "LIVE (DeepSeek)",
      provider: "DeepSeek API",
      model: clean(env.DEEPSEEK_MODEL) ?? DEEPSEEK_DEFAULT_MODEL,
      url: DEEPSEEK_URL,
      key: ds,
    };
  }
  const or = clean(env.OPENROUTER_API_KEY);
  if (or) {
    return {
      mode: "openrouter",
      label: "LIVE (OpenRouter)",
      provider: "OpenRouter",
      model: clean(env.OPENROUTER_MODEL) ?? OPENROUTER_DEFAULT_MODEL,
      url: OPENROUTER_URL,
      key: or,
    };
  }
  return null;
}

export const SAMPLE_MODE: ModeInfo = {
  mode: "sample",
  label: "SAMPLE",
  provider: "Recorded sample (no key)",
  model: "deepseek/deepseek-v4.1-flash (recorded sample)",
};

export function resolveMode(env: Env): ModeInfo {
  const p = resolveProvider(env);
  if (!p) return SAMPLE_MODE;
  return { mode: p.mode, label: p.label, provider: p.provider, model: p.model };
}
