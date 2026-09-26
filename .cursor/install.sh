#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the demo-apps monorepo.
# Installs Bun (the repo's required runtime / package manager) and refreshes
# dependencies for every Bun app under apps/*.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "==> Installing Bun"
  curl -fsSL https://bun.sh/install | bash
fi

# Make bun/bunx resolvable from any shell (login or not) for future agents.
if command -v sudo >/dev/null 2>&1; then
  sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun 2>/dev/null || true
  sudo ln -sf "$BUN_INSTALL/bin/bunx" /usr/local/bin/bunx 2>/dev/null || true
fi

# Belt-and-suspenders: keep Bun on PATH in interactive shells too.
line='export PATH="$HOME/.bun/bin:$PATH"'
for profile in "$HOME/.bashrc" "$HOME/.profile"; do
  touch "$profile"
  grep -qxF "$line" "$profile" || echo "$line" >>"$profile"
done

echo "==> Bun $(bun --version) ready"

shopt -s nullglob
installed=0
for pkg in "$repo_root"/apps/*/package.json; do
  app_dir="$(dirname "$pkg")"
  echo "==> bun install in ${app_dir#"$repo_root"/}"
  (cd "$app_dir" && bun install)
  installed=$((installed + 1))
done

if [ "$installed" -eq 0 ]; then
  echo "==> No Bun apps found under apps/*; nothing to install"
fi
echo "==> Install complete ($installed app(s))"
