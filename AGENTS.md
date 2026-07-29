<!-- sm-workflow:begin -->
# Working in this repo — contract for humans and AI agents

## Landing code
- Never push to a landing branch (see `.sm-workflow.conf` → `landing_branches`).
  Every change lands via PR through the merge queue: run **/merge**.
- Manual path: rebase on the target → `npm run lint && npm run format &&
  npm run type-check` (+ `bash scripts/check-migration-numbers.sh` if present)
  → push your branch → `gh pr create` → `gh pr merge --auto --squash`.
- Never `gh pr merge --admin`, never `--no-verify`, never force-push a shared branch.
- **No red PRs:** a PR that fails CI is fixed until green before any new work —
  never merged, never worked around, never abandoned. Reverting or closing with
  a stated reason are the only other exits.
- If a landing branch is red: stop merging. The breaking author reverts or
  fixes within 30 minutes. Reverting is always acceptable.

## Migrations (repos with src/schema/migrations/)
- Numbers must be unique vs the target branch. Ceiling:
  `git ls-tree origin/main src/schema/migrations/ | awk '{print $4}' | sort | tail -3`
- Renumber YOUR new file. **Never rename a migration that exists on origin/main**
  (`d1_migrations` tracks applied files by name — a rename re-applies it).
- Never edit `scripts/migration-dupe-allowlist.txt` (frozen history; hooks read it).

## Deploys
- Deploys run **only from CI** after green. Never `wrangler deploy` /
  `npm run deploy` from a laptop. Repos with `promotion=` set use **/promote**;
  production waits on its required reviewer.

## Secrets
- Never commit tokens, keys, or passwords. If one leaks: say so immediately —
  it must be rotated; deleting the commit is not sufficient.
<!-- sm-workflow:end -->
