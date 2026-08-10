#!/usr/bin/env bash
#
# Move this project into its own repository.
#
# Needed because the GitHub App that built this could not create repositories
# (decision D-012 in PROJECT.md), so the code was developed inside srtiz-bot/M3PL.
# Nothing here references the parent repo, so it transplants unchanged.
#
# Usage:
#   ./scripts/transplant.sh https://github.com/srtiz-bot/ai.Goodproductivity.git
#   ./scripts/transplant.sh git@github.com:srtiz-bot/ai.Goodproductivity.git ~/code/shopify-gateway

set -euo pipefail

REMOTE="${1:?Usage: $0 <git-remote-url> [destination-dir]}"
DEST="${2:-$HOME/shopify-mcp-gateway}"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -e "$DEST" ]]; then
  echo "error: $DEST already exists. Pass a different destination." >&2
  exit 1
fi

echo "Copying $SOURCE -> $DEST"
mkdir -p "$DEST"

# Copy everything except build output and local state. .gitignore covers these
# too, but excluding them here keeps the copy fast and the destination clean.
tar -C "$SOURCE" \
    --exclude=node_modules \
    --exclude=.wrangler \
    --exclude=dist \
    --exclude=.dev.vars \
    -cf - . | tar -C "$DEST" -xf -

cd "$DEST"
git init -q
git add .
git commit -q -m "Initial commit: Cloudflare-hosted Shopify multi-store MCP gateway

Multi-store Shopify gateway on Cloudflare Workers and D1, exposing an MCP
interface with per-user Google SSO via OAuth 2.1, service accounts for
scheduled tasks, encrypted token storage, per-store permission scopes and an
append-only audit log.

See docs/ARCHITECTURE.md for the design and PROJECT.md for status and decisions."

git branch -M main
git remote add origin "$REMOTE"

echo
echo "Ready. Review with:  cd $DEST && git log --stat -1"
echo "Then push with:      cd $DEST && git push -u origin main"
