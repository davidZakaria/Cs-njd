#!/usr/bin/env bash
# Capture distinct before (main@0d0b555) vs after (feature) walkthrough screenshots (shared DB).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE="${WORKTREE_MAIN:-/tmp/njd-main-0d0b555}"
MAIN_SHA="${MAIN_SHA:-0d0b555}"
ARTIFACT_ROOT="${ARTIFACT_ROOT:-/opt/cursor/artifacts}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/njd_crm}"
export AUTH_SECRET="${AUTH_SECRET:-walkthrough-dev-secret-min-32-chars-long}"

mkdir -p "$ARTIFACT_ROOT"

if [[ ! -d "$WORKTREE/.git" ]]; then
  git -C "$REPO_ROOT" fetch origin main 2>/dev/null || true
  git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$MAIN_SHA"
fi

if [[ -f "$REPO_ROOT/.env" && ! -f "$WORKTREE/.env" ]]; then
  cp "$REPO_ROOT/.env" "$WORKTREE/.env"
fi

cd "$REPO_ROOT"
echo "Seeding walkthrough fixtures (feature branch script)..."
WALKTHROUGH_UNIT_ID="$(npx tsx scripts/seed-walkthrough-fixtures.ts 2>&1 | sed -n 's/Walkthrough unit: WALK-DEMO-AR (\(.*\))/\1/p')"
export WALKTHROUGH_UNIT_ID
echo "WALKTHROUGH_UNIT_ID=$WALKTHROUGH_UNIT_ID"

SESSION_BEFORE="njd-before-main"
SESSION_AFTER="njd-after-feature"

tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_BEFORE" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_BEFORE" -c "$WORKTREE" -- bash -l

tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_AFTER" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_AFTER" -c "$REPO_ROOT" -- bash -l

start_server() {
  local session="$1"
  local dir="$2"
  local port="$3"
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$session:0.0" "cd '$dir' && (test -d node_modules || npm install --legacy-peer-deps) && set -a && [ -f .env ] && source .env; set +a && export AUTH_URL=http://localhost:$port && PORT=$port npm run dev" C-m
}

echo "Starting main@$MAIN_SHA on :3001..."
start_server "$SESSION_BEFORE" "$WORKTREE" 3001
echo "Starting feature branch on :3000..."
start_server "$SESSION_AFTER" "$REPO_ROOT" 3000

for port in 3000 3001; do
  for _ in $(seq 1 90); do
    if curl -sf "http://localhost:$port/ar/login" >/dev/null; then
      break
    fi
    sleep 2
  done
done

cd "$REPO_ROOT"
E2E_BASE_URL=http://localhost:3001 CAPTURE_PHASE=before npx tsx scripts/capture-walkthrough-proof.ts
E2E_BASE_URL=http://localhost:3000 CAPTURE_PHASE=after npx tsx scripts/capture-walkthrough-proof.ts

echo "Done → $ARTIFACT_ROOT"