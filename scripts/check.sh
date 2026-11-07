#!/usr/bin/env bash
# Pre-merge gate (AGENTS.md §4.4). Run before every merge into main. CI runs it too.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
ok()   { printf '  ✔ %s\n' "$1"; }
bad()  { printf '  ✖ %s\n' "$1"; fail=1; }

echo "1/5 JSON files parse"
while IFS= read -r f; do
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$f" 2>/dev/null || bad "invalid JSON: $f"
done < <(git ls-files '*.json')
[ $fail -eq 0 ] && ok "all tracked JSON valid"

echo "2/5 no secrets in tracked files"
# data/datasets/* legitimately contains signed audio links from the organizers.
hits=$(git grep -nIE '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|sig=[A-Za-z0-9_%-]{20,})' -- . ':!data/datasets/*' ':!scripts/check.sh' || true)
if [ -n "$hits" ]; then bad "possible secret:"; echo "$hits" | head -5; else ok "none found"; fi
git ls-files --error-unmatch .env >/dev/null 2>&1 && bad ".env is tracked, remove it" || ok ".env not tracked"

echo "3/5 no AI attribution in commits since main"
base=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo "")
range=${base:+$base..HEAD}
if git log ${range:-HEAD} --format=%B | grep -Eiq '^[[:space:]]*co-authored-by:|(generated|co-created|created|written) (with|by|using) \[?(claude|codex|chatgpt|gpt|openai|anthropic|copilot|cursor|gemini)|🤖|noreply@anthropic\.com|noreply@openai\.com'; then
  bad "AI attribution found in commit messages (${range:-all history}); reword them before merging"
else ok "clean"; fi

echo "4/5 required team files present"
for f in AGENTS.md CLAUDE.md docs/STATUS.md docs/CONTRACTS.md docs/DECISIONS.md docs/TOOLING.md; do
  [ -f "$f" ] || bad "missing $f"
done; [ $fail -eq 0 ] && ok "present"

echo "5/5 build + tests (if a package.json exists)"
found=0
while IFS= read -r pj; do
  found=1; d=$(dirname "$pj")
  if command -v npm >/dev/null; then
    ( cd "$d" && [ -d node_modules ] || npm ci --silent ) && \
    ( cd "$d" && npm run --if-present build >/dev/null && npm run --if-present test >/dev/null ) \
      && ok "$d build/test ok" || bad "$d build/test failed"
  else bad "npm not installed but $pj exists"; fi
done < <(git ls-files '*package.json' | grep -v node_modules)
[ $found -eq 0 ] && ok "no package.json yet, skipped"

echo
if [ $fail -eq 0 ]; then echo "CHECK PASSED"; else echo "CHECK FAILED"; fi
exit $fail
