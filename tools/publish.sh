#!/usr/bin/env bash
# Publie une tâche : numéro de version anti-cache, tests rapides, commit + push.
# Usage : tools/publish.sh "message de commit"   (FULL=1 pour lancer aussi le test navigateur complet)
set -e
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
sed -i -E "s/\?v=[0-9]+\"/?v=$V\"/g; s/window.ASSET_V=\"[0-9]+\"/window.ASSET_V=\"$V\"/" index.html
if [ "$FULL" = "1" ]; then npm run test:all; else npm test; fi
git add -A
git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
git log --oneline -1
