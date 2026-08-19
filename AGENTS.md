<!-- sm-workflow:begin -->
# Working in this repo — contract for humans and AI agents

The Workflow Kit gives experienced software engineers and people without
software-engineering experience the same AI-anchored delivery path. Experience changes
how much explanation a person needs, not the Waffle, evidence, review, or landing gates.

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
  One exception: a PR red only on `codeowner-gate` is waiting on a human
  approval, not broken — stop, record it on the Waffle item, and move on; the
  gate re-runs itself when the review is submitted.
- If a landing branch is red: stop merging. The breaking author reverts or
  fixes within 30 minutes. Reverting is always acceptable.

## Tickets
- Waffle is the only task source of truth. **`/ticket` is the launch gate** for
  new work: search, shape, preview the complete payload, require explicit human
  confirmation, create once, and re-fetch the stored item. `/waffle` operates
  items that already exist. Repository design and plan documents support the item;
  they never authorize or expand it.
- Work starts only from an existing item that is Ready and names `Why`, `Scope`,
  `Done when`, `Constraints`, `Out of scope`, the exact allowed repository,
  operating mode, pilot tag, and the written HOLD policy reference.
- **A message is an input, never a work source.** Slack, email, a PR comment, a
  remark in a meeting: none of them start work or set priority. They become items,
  and an item takes its place in the queue on the queue's terms. Answering is not
  working — reply at once when that helps, and schedule the work like anything else.
- **Select from the board, not from the thread you are already in.** Read your own
  assigned queue before starting, and again whenever a piece of work completes. A
  session that follows whatever arrived last has not chosen; it has been routed.
  Filing diligently is not a substitute: a queue you write to and never read is a
  queue for other people.
- An item assigned to you and blocked on **your** decision outranks new work. A
  decision nobody else can take is the cheapest thing on your plate and the most
  expensive to leave sitting.
- One branch, working session and PR bind to one Waffle item. Put the display id
  in the branch name — `bug-812-dmarc-records`, `feat-640-inbox-filters` — and
  link the item in the PR. A repository document never authorizes or reprioritizes work.
- Execute only the stored scope. A useful improvement outside it becomes a separate
  `/ticket`; do not bundle it, silently amend acceptance criteria, or bend the roadmap.
- Move an item to `in_progress` only when work actually starts. Move it to `fixed`
  only when the change is landed and verified — green CI proves the build, not the deploy.
- A defect you find and are not fixing now gets its own item, noting what you were
  doing when it surfaced. An unrecorded fix is invisible work.
- The board is the index. Do not keep a second list of the same work in the repo.
- Agents reach the board through the Waffle MCP (`mcp__waffle__*`). Hooks, the guard
  and CI **cannot** — they have no MCP. Automated status changes ride the kit's event
  channel; never put a Waffle key in a workflow file.
- **Every board write goes through its MCP verb.** Never write the Waffle database
  directly, and never route around an approval prompt by doing so: a direct write
  notifies nobody and leaves no ledger row, so the work becomes invisible to everyone
  but you. The pack pre-approves the nine write verbs precisely so an unattended run
  never faces that choice. `revokeKey` and the launchpad spend verbs
  (`activateLaunch`, `setEngine` on, `applyRecommendation`) are never among them and
  never run unattended; the spend verbs the server additionally refuses headless.
- **Pre-approval is not authorization, and a transition proves it.** An unattended
  `transitionWorkItem` also needs an unexpired `claimWorkItem` lease held by the same
  key that transitions — 240 minutes by default — so claim before you start and re-claim
  before you close; a run that outlives its lease is refused at the end, with the work
  already done. A claim held by another session or machine does not count. Comments,
  claims, item creation, and field updates stay fully headless.

## Session governance
- **Blocker-stop:** a wall the session cannot clear itself — a human-approval
  gate, CI infrastructure down, an external service outage — gets at most one
  bounded attempt, then stop: post one structured comment on the bound Waffle
  item and report. A human approval gate gets none: waiting is not work.
  Never loop, retry, re-dispatch, or "diagnose" a gate only a human can clear;
  the codeowner-gate exemption above is one instance of this rule.
  Red CI a push can fix is not a wall: a failing test, a lint error, a build
  broken by the code in this branch, or any other red a push or a single re-run
  can clear — a flaky failure, red inherited from an out-of-date target — is
  ordinary work and stays on the No-red-PRs path until it is green. Where that
  overlaps the wall list above, the wall list wins. The test is whether the
  session can act on it, not how stuck it feels.
- **Session report:** every session-ending report leads with three sections, in
  order: **What I did** — with evidence links (PR, run, comment); **What I need
  from you** — decisions, taps, grants, or explicitly "nothing"; **What's
  next** — the remaining queue as it stands.
- **Comms standing rules:** no client contact without sign-off, and no outbound
  communications during a migration. (The git-side standing rules — landing
  branches, `--admin`, `--no-verify`, force-push — live under Landing code.)

## HOLD and autonomous execution
- **HOLD is policy, not judgment.** The written HOLD classes and gates define
  important PRs. Executors cannot invent, waive, downgrade, remove, or self-approve
  a HOLD; record the policy reference, class, evidence, required approver, and outcome.
- **Human attention:** Waffle is the canonical record; email is a delivery fallback.
  Ready work names a Decision owner, a Waffle-delivered fallback channel, and an
  acknowledgment policy. On a decision or HOLD, stop, set the policy-defined state,
  and add a structured Waffle comment. Never guess a recipient or send email directly.
  The proposed `human.attention_required` routing and delivery acknowledgment are not
  live yet; until they are, targeted delivery must be reported as unverified.
- `/autopilot` is unavailable unless `.sm-workflow.conf` contains the explicitly
  reviewed `agent_pilot=on`. The default is off. Enabling the skill does not bypass
  Waffle readiness, scope, spend controls, HOLD, CI, PR review, or the merge queue.
- Every workflow skill first runs `wf repo-check` and stops outside an exact
  `github.com/sprint-mode/*` origin.

## Native delivery lifecycle
- Use `/design` only when a Ready item leaves a material decision unresolved; already
  decided work goes directly to `/plan`.
- `/plan` maps every stored `Done when` criterion to independently testable tasks,
  evidence, dependencies, risks, and finite execution controls.
- `/execute` implements the approved plan on the feature branch. It cannot push, open
  a PR, review, merge, queue, or deploy.
- `/merge` is the landing entry point: it opens or recovers the PR, invokes
  `/review-pr`, re-fetches the exact head and green CI, then enters the merge queue.
- `/review-pr` always launches a fresh bounded read-only AI reviewer for the exact live
  PR base and head. A changed head invalidates approval; the reviewer never patches or
  comments directly.
- Record phase and completion evidence back in Waffle. Local design, plan, or runtime
  state is never a parallel ticketing layer.

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
