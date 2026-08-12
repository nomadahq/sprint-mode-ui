#!/usr/bin/env bash
# sm-workflow guard — Claude Code PreToolUse hook (Bash matcher).
# stdin: {"tool_input":{"command":"..."}}. Exit 0 allows; exit 2 blocks and
# stderr is shown to the model. Org-scoped: outside sprint-mode remotes → allow.
set -u

CMD=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)
[ -n "$CMD" ] || exit 0

REMOTE=$(git remote get-url origin 2>/dev/null || true)
printf '%s' "$REMOTE" | grep -qE 'github\.com[:/]sprint-mode/' || exit 0

BRANCHES="main"
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$ROOT" ] && [ -f "$ROOT/.sm-workflow.conf" ]; then
  LB=$(grep '^landing_branches=' "$ROOT/.sm-workflow.conf" 2>/dev/null | head -1 | cut -d= -f2-)
  [ -n "$LB" ] && BRANCHES="$LB"
fi

deny() { echo "$1" >&2; exit 2; }

for b in $BRANCHES; do
  if printf '%s' "$CMD" | grep -qE "git push[^|&;]*[[:space:]](origin[[:space:]]+)?($b|HEAD:$b)([[:space:]]|\$)"; then
    deny "Direct pushes to $b are blocked. Run /merge — it rebases, checks migrations, and lands through the merge queue."
  fi
done
if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+(push|commit)[^|&;]*--no-verify'; then
  # Constrained-sandbox exception (BUG-1841, decision owner ruling 2026-08-11,
  # LANDING-PROCESS): `git commit --no-verify` is allowed when the environment
  # is a constrained agent sandbox — CLAUDE_CODE_REMOTE=true (Claude Code cloud)
  # or hook_profile=fast in .sm-workflow.conf. Temporary until the per-repo
  # pre-commit fast-path lands fleet-wide. `git push --no-verify` never passes:
  # pre-push carries the landing-branch and migration blocks.
  ALLOW_NV=1
  if ! printf '%s' "$CMD" | grep -qE 'git[[:space:]]+push[^|&;]*--no-verify'; then
    if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
      ALLOW_NV=0
    elif [ -n "$ROOT" ] && [ -f "$ROOT/.sm-workflow.conf" ] \
      && grep -q '^hook_profile=fast$' "$ROOT/.sm-workflow.conf" 2>/dev/null; then
      ALLOW_NV=0
    fi
  fi
  if [ "$ALLOW_NV" -ne 0 ]; then
    deny "--no-verify is blocked: the hooks catch migration collisions and CI failures before they cost the queue."
  fi
fi
if printf '%s' "$CMD" | grep -qE 'gh pr merge[^|&;]*--admin'; then
  deny "Admin merges bypass the merge queue. Use 'gh pr merge --auto', or /merge."
fi
if printf '%s' "$CMD" | grep -qE '(wrangler|npm run)[[:space:]]+(pages[[:space:]]+)?deploy'; then
  deny "Deploys run only from CI after the gates. Land through the queue and let the pipeline ship it."
fi
exit 0
