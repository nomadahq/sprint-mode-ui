# TASK-3198 -- portal-standard.json, sm-portal-lock runner, and the positive tests

## Identity

- Waffle item: TASK-3198 (`bug_8303fe56d6b7a33f`), status `open`, assigned to the executor.
- Allowed repository: `sprint-mode/sm-ui`.
- Item binding: `sha256:3a1c95bce7d2ab654c1a345f365a7c282126b92a7697d26ddee4a7d26cd9141d`.
- Waffle source revision: `updated_at` `2026-09-05 17:22:47`; the canonical contract is stored on TASK-3198.
- Planning base: `origin/main` at `60c0531`.
- Feature branch: `task-3198-portal-standard`; target branch: `main`.
- Design binding: none. The item is already a bounded, fully specified square (FEAT-3170 section G, checks 1-29 approved by Aaron 2026-09-05); nothing material is undecided.
- Decision owner: Aaron Hall (`ct_d47be523b3efbea5`). Operating mode: rails.
- Waffle is authoritative. This plan implements only the stored sm-ui scope.

## Readiness keys

| key | how it is satisfied |
|---|---|
| `item_binding` | The digest above, computed from the stored sections and revision via `wf-ready.py`'s `item_binding`. |
| `plan_binding` | This committed file. |
| `repository` | `sprint-mode/sm-ui`, matching the item's Allowed repository. |
| `feature_branch` | `task-3198-portal-standard`, carrying the item id. |
| `target_branch` | `main`, the single entry in `landing_branches`. |
| `base_sha` | `origin/main` at `60c0531` at planning time; re-read at verification time. |
| `working_tree` | Clean at plan time; every change lands as a committed diff. |
| `git_metadata` | A fresh clone under the session scratchpad, not a linked worktree. |
| `github_identity` | The session's configured git identity (Aaron Hall, `262458524+amh-gh@users.noreply.github.com`). |
| `waffle_identity` | The developer's own Waffle member, verified through the Waffle MCP. |
| `push_capability` | Ordinary branch push to a new branch; no `.github/` path is touched by this square. |
| `commands` | `npm ci`, `npm run lint`, `npm run type-check`, `npm run build`, `npm run build:standalone`, `npx vitest run`. |
| `dependencies` | None added. The bin and its tests use only Node 20 built-ins and the repo's existing `vitest`. |
| `target_ci` | `ci-gate` on the exact PR head, in `sprint-mode/sm-ui`. |

## Tasks

| # | Task | Stored `Done when` slice | Evidence |
|---|---|---|---|
| 1 | Author `portal-standard.json` and `portal-standard.schema.json` at the package root; export `./portal-standard` and add the `sm-portal-lock` bin and new files to `package.json`'s `files` array. | `portal-standard.json validates against a schema file in the same PR`; `the package publishes with the new export` | `src/__tests__/portal-standard-schema.test.js` passes; `package.json` diff. |
| 2 | Write `bin/sm-portal-lock.mjs`: runs the 15 repo-side checks (ids 1,3,4,6,7,8,9,10,11,12,13,26,27,29, plus 2 with `--newest-tag`), an override reader for `docs/portal-lock/overrides/*.md`, a table/`--json` reporter, and the exit-code rule (1 on any non-warn-only deviation). | `npx sm-portal-lock on the fixture reports every repo-side check pass` | Manual run against the fixture; `npm test`. |
| 3 | Build `test/fixtures/portal-lock/standard-portal/`: a minimal fleet-shaped portal (package.json/lock pinned exact, `.npmrc`, `.sm-workflow.conf`, CODEOWNERS, AGENTS.md, `ci.yml` with `npm ci` and a `ci-gate` job, `portal.json`, `index.html` with `data-product` and the brand override block, `pages/App.jsx` importing `Layout`/`Login`/`PageGate`, `public/_worker.js` reading `{ ok, user }` and calling only the spine). | Same | `src/__tests__/portal-lock-positive.test.js` baseline test. |
| 4 | Positive tests: adding a page with a permKey, adding a role definition file, adding a member through a stubbed `joinPortal` fixture, bumping the sm-ui pin to `--newest-tag`. | `the four positive tests ... are green in CI` | `src/__tests__/portal-lock-positive.test.js`. |
| 5 | Negative tests: one per repo-side check (15) proving it reports `deviation` on the deviation it names, plus one proving an expired override does not rescue a deviation. | `the ... negatives are green in CI` | `src/__tests__/portal-lock-negative.test.js`. |
| 6 | README section "Portal standard and sm-portal-lock": usage, exit codes, override format. | Supports discoverability; not a named `Done when` line but required by the stored scope. | `README.md` diff. |
| 7 | Rebuild `dist/` and commit it in the same PR; run the full verification set. | `sm-ui commits dist and CI diffs it` (Constraints) | `npm run build` (`git diff --exit-code -- dist` passes with no changes needed); `npm test`, `npm run lint`, `npm run type-check`. |
| 8 | Open the PR against `main`, invoke the kit's fresh review, and land through the merge queue. Do not merge or enable auto-merge locally. | `Land through sm-ui's merge queue with the kit's fresh review` (Constraints) | PR URL; `/merge` (or the session performing the equivalent steps) recorded in the session report. |

## Planned mutation paths

| Repository-relative path | Operation | Pair |
|---|---|---|
| `portal-standard.json` | `create` | `-` |
| `portal-standard.schema.json` | `create` | `-` |
| `package.json` | `modify` | `-` |
| `bin/sm-portal-lock.mjs` | `create` | `-` |
| `README.md` | `modify` | `-` |
| `test/fixtures/portal-lock/standard-portal/**` | `create` | `-` |
| `src/__tests__/portal-lock-helpers.js` | `create` | `-` |
| `src/__tests__/portal-standard-schema.test.js` | `create` | `-` |
| `src/__tests__/portal-lock-positive.test.js` | `create` | `-` |
| `src/__tests__/portal-lock-negative.test.js` | `create` | `-` |
| `dist/**` | `modify` (if the rebuild changes it; verified unchanged this run) | `-` |

## Risks

- **The 29 check titles are Aaron's approved text; the item forbids adding or rewording one.** Several titles carry a trailing bracket annotation (e.g. `[A warns,N]`) that is not fully consistent with the item's separate instruction that only checks 2 and 14 are `a_warns_only`. Resolution: titles are stored byte-for-byte as given (brackets included), while the structured `gates` and `a_warns_only` fields follow the narrower explicit rule. Flagged for Aaron in the PR body and the session report rather than silently resolved either way.
- **Two schema fields have no named source in the stored scope**: the "seven variables" for the brand override block (check 12), and a minimum template version for `portal.json` (check 7). Resolution: the seven variables are read directly off `src/tokens.css` and `src/*.tsx` usage (`--accent`, `--accent-hover`, `--accent-foreground`, `--accent-10`, `--accent-20`, `--accent-tint`, `--accent-soft` -- an exact count of 7 found in the existing codebase, not guessed); the minimum template version is a placeholder (`1.0.0`) since square 2 (the template) has not shipped yet. Both are called out explicitly in the session report.
- **Check 3 ("npm ci passes") cannot literally run `npm ci` inside a fixture-based, offline unit test.** Resolution: implemented as a deterministic proxy (the lockfile must exist and pin `@sprint-mode/sm-ui` at the same version as `package.json`), documented in the bin's source and the session report as an approximation, not a live registry check.

## Execution controls

- Maximum wall clock: 90 minutes. Maximum turns: buildout is a single focused session. Retry ceiling: 2 per failing verification command.

The plan ends before landing; `/merge` (or the session performing its equivalent steps) takes the branch through the queue.
