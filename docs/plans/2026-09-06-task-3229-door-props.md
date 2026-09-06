# TASK-3229 -- sm-ui Layout exposes authBase and apiBase (one door shape, D2)

## Identity

- Waffle item: TASK-3229 (`bug_7657d0a14188c58f`), status `open`.
- Allowed repository: `sprint-mode/sm-ui`.
- Waffle source revision: `updated_at` `2026-09-06 01:42:15`; the canonical contract is stored on TASK-3229.
- Planning base: `origin/main` at `074270d9188d66ee93e82977776e1bade25720d4` (tag `v1.2.3`).
- Feature branch: `task-3229-door-props` (pushed, PR #375, head `4ccf0b6fed22d056d5b7e5970603c4bf416f38c9`); target branch: `main`.
- Design binding: none. FEAT-3170 factory sequence step 1, proposal bc_cf23c2095a71a229 section 1, Aaron's D2 ruling.
- Decision owner: Aaron Hall (`ct_d47be523b3efbea5`). Operating mode: rails.
- Waffle is authoritative. This plan documents the already-implemented sm-ui scope for landing.

## Readiness keys

| key | how it is satisfied |
|---|---|
| `item_binding` | Computed from TASK-3229's stored sections and revision via `wf-ready.py`'s `item_binding`. |
| `plan_binding` | This committed file. |
| `repository` | `sprint-mode/sm-ui`, matching the item's Allowed repository. |
| `feature_branch` | `task-3229-door-props`, PR #375, bound to TASK-3229 via the PR body's Item line. |
| `target_branch` | `main`, the single entry in `landing_branches`. |
| `base_sha` | `origin/main` at `074270d9` at planning time; re-read at verification time. |
| `working_tree` | Clean; all source, test, README, and dist changes already committed at branch head. |
| `git_metadata` | A fresh plain clone at `/Users/ah/code/sm-ui-wt-3229`, not a linked worktree. |
| `github_identity` | `sprint-mode-automation[bot]` via the sm-gh proxy wrapper. |
| `waffle_identity` | The session's Waffle MCP identity. |
| `push_capability` | Ordinary branch push; no `.github/` path touched by this square. |
| `commands` | `npm ci`, `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`. |
| `dependencies` | None added. |
| `target_ci` | `ci-gate` on the exact PR head, in `sprint-mode/sm-ui`. |

## Tasks

| # | Task | Stored `Done when` slice | Evidence |
|---|---|---|---|
| 1 | `src/Layout.tsx`: typed `authBase?`/`apiBase?` on `LayoutProps`; threaded to `AccountSwitcher`; view-as base precedence `viewAsAuthBase \|\| authBase \|\| 'https://api.sprintmode.ai'`; untyped `viewAsAuthBase` cast removed. | PR landed through `/merge` with a fresh APPROVE at the current head and green CI | `src/Layout.tsx` diff; `src/__tests__/task-3229-door-props.test.jsx`. |
| 2 | `src/AccountSwitcher.tsx`: explicit `authBase` wins on every host (onSmHost split only decides the default); linked-accounts already read through `apiBase`; two props documented at top of file. | Same | `src/AccountSwitcher.tsx` diff; same test file. |
| 3 | `src/usePortalConfig.tsx`: `apiBase` prop documented ("" = portal's own origin; default stays direct). | Same | `src/usePortalConfig.tsx` diff. |
| 4 | Tests: threading, explicit-prop routing, and a regression test proving the v1.2.3 default is unchanged when no new prop is passed. | Regression test proves byte-identical default behavior | `src/__tests__/task-3229-door-props.test.jsx` (8 tests, all passing; full suite 276 passing). |
| 5 | README "One door shape" section naming the three props a portal passes. | Documents the contract | `README.md` diff. |
| 6 | Land the PR through `/merge`: fresh review, green CI, merge queue; published tag carries the typed props. | `The published tag (v1.2.4 or the next per the release rules) carries the typed LayoutProps.authBase and apiBase, read back from the tag` | PR #375 URL; merge SHA; tag readback. |
| 7 | One line on TASK-3199 naming the version and the three props the template passes. | `TASK-3199 carries one line naming the version and the three props the template passes` | TASK-3199 comment id. |

## Planned mutation paths

| Repository-relative path | Operation | Pair |
|---|---|---|
| `src/Layout.tsx` | `modify` | `-` |
| `src/AccountSwitcher.tsx` | `modify` | `-` |
| `src/usePortalConfig.tsx` | `modify` | `-` |
| `README.md` | `modify` | `-` |
| `src/__tests__/task-3229-door-props.test.jsx` | `create` | `-` |
| `dist/index.js`, `dist/src/Layout.d.ts`, `dist/src/usePortalConfig.d.ts` | `modify` (rebuilt) | `-` |
| `docs/plans/2026-09-06-task-3229-door-props.md` | `create` | `-` |

## Risks

- **Default behavior must stay byte-identical to v1.2.3 for every portal that passes no new prop.** Enforced by the AccountSwitcher `hasExplicitAuthBase || onSmHost` gate (identical to the prior `onSmHost`-only gate when no `authBase` is passed) and by the Layout `viewAsAuthBase || authBase || 'https://api.sprintmode.ai'` precedence (identical to the prior `viewAsAuthBase || 'https://api.sprintmode.ai'` when `authBase` is absent). Proven by four regression-path tests in `src/__tests__/task-3229-door-props.test.jsx`.
- **Committed `dist/` must match a fresh build.** `npm run build`'s own `git diff --exit-code -- dist` check was run locally and the resulting `dist/index.js`, `dist/src/Layout.d.ts`, `dist/src/usePortalConfig.d.ts` diffs are committed at branch head (precedent: commit `60c0531`, "dist rebuilt on top of 1.2.0").
- **No portal-standard.json change, no component redesign, ASCII only** — confirmed by diff review; out of scope items (default-flip square, sm-portal-template's own commit, Login authBase) untouched.

## Execution controls

- This plan documents already-completed implementation for landing purposes only; no new implementation commits are anticipated beyond conflict resolution or review-driven fixes. Retry ceiling: 2 per failing verification command.

The plan ends before landing; `/merge` takes the branch through the queue.
