// Provenance shown in the source panel and README.
export const UPSTREAM = {
  repo: "https://github.com/Nyxera0x/cutaway",
  sha: "5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a",
  license: "https://github.com/Nyxera0x/cutaway/blob/5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a/LICENSE",
  bookmark: "https://x.com/isagi1000x/status/2120548035721572620",
  claudeMotion: "https://github.com/whaleyxbt/claude-motion",
  claudeMotionLicense: "https://github.com/whaleyxbt/claude-motion/blob/main/LICENSE",
};
export const shortSha = UPSTREAM.sha.slice(0, 7);
export const treeUrl = (path: string) => `${UPSTREAM.repo}/tree/${UPSTREAM.sha}/${path}`;
