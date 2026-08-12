#!/usr/bin/env bash
# sm-workflow hook-env: constrained-sandbox detection for hook fast-paths.
# Constrained when CLAUDE_CODE_REMOTE=true (Claude Code cloud sandbox, documented
# at code.claude.com/docs/en/cloud-environments) or hook_profile=fast in
# .sm-workflow.conf (explicit per-repo opt-in). Repo-owned heavy pre-commit
# checks fast-path on it — CI still runs the full checks on the PR. Convention
# for an adopted repo's own .githooks/pre-commit, at the top:
#
#   . "$(git rev-parse --show-toplevel)/scripts/hook-env.sh"
#   sm_constrained_env && exit 0
#
# May also be executed directly: exit 0 means constrained.
sm_constrained_env() {
  [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && return 0
  _sm_root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -f "$_sm_root/.sm-workflow.conf" ] \
    && grep -q '^hook_profile=fast$' "$_sm_root/.sm-workflow.conf" 2>/dev/null \
    && return 0
  return 1
}
case "${0##*/}" in hook-env.sh) sm_constrained_env ;; esac
