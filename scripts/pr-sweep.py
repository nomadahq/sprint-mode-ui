#!/usr/bin/env python3
"""sm-workflow PR sweep: find open PRs that have stopped progressing.

Pure functions (idle_seconds/classify/resolve_owner/should_escalate) do no I/O
so tests drive them from fixtures; main() holds the gh calls.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime

GATE = "codeowner-gate"
EMIT_USER_AGENT = "sm-workflow-kit-emit/1 (+https://github.com/sprint-mode/sm-workflow)"
STALLED_LABEL = "sm:stalled"
OPTOUT_LABEL = "sm:no-sweep"
REVIEWERS = "@sprint-mode/reviewers"
RENAG_HOURS = 6


def _ts(value):
    """ISO-8601 -> epoch seconds. None/blank -> None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _checks(pr):
    return pr.get("statusCheckRollup") or []


def _check_name(check):
    return check.get("name") or check.get("context") or ""


def _labels(pr):
    return set(lbl.get("name", "") for lbl in (pr.get("labels") or []))


def idle_seconds(pr, now_ts):
    """Seconds since the PR last actually moved.

    Deliberately ignores updatedAt: the sweep's own comment mutates it, which
    would reset the clock on every escalation and silently disable the re-nag
    (spec 5.1). Head-commit time and check completions both track real work.
    """
    marks = [_ts(pr.get("headCommittedAt"))]
    for check in _checks(pr):
        marks.append(_ts(check.get("completedAt")))
    marks = [m for m in marks if m is not None]
    if not marks:
        return 0.0
    return max(0.0, now_ts - max(marks))


def _failing(pr, include_gate=False):
    out = []
    for check in _checks(pr):
        if check.get("conclusion") != "FAILURE":
            continue
        name = _check_name(check)
        if name == GATE and not include_gate:
            continue
        out.append(name)
    return out


def _gate_failing(pr):
    return any(
        _check_name(c) == GATE and c.get("conclusion") == "FAILURE"
        for c in _checks(pr)
    )


def classify(pr, now_ts, threshold_min):
    """One of: healthy, broken, gated, unarmed, behind, stuck.

    Order is load-bearing (spec 5). Past the threshold there is NO path back to
    healthy: an unrecognised state is still a stall and falls through to stuck.
    """
    if pr.get("isDraft"):
        return "healthy"
    if OPTOUT_LABEL in _labels(pr):
        return "healthy"
    if idle_seconds(pr, now_ts) < threshold_min * 60:
        return "healthy"
    if pr.get("mergeable") == "CONFLICTING" or _failing(pr):
        return "broken"
    if _gate_failing(pr):
        return "gated"
    if not pr.get("autoMergeRequest"):
        return "unarmed"
    if (pr.get("behind_by") or 0) > 0:
        return "behind"
    return "stuck"


MARKER_PREFIX = "<!-- sm-pr-sweep"


def resolve_owner(pr):
    """Who is responsible for landing this PR.

    A cascade, never a gate (spec 6). The author is useless on its own: thread
    PRs author as a human's PAT today and as the App after the identity flip,
    so neither names who owns the landing.
    """
    for name in sorted(_labels(pr)):
        if name.startswith("owner:"):
            handle = name.split(":", 1)[1].strip().lstrip("@")
            if handle:
                return "@" + handle
    author = pr.get("author") or {}
    login = author.get("login") or ""
    is_bot = (author.get("is_bot")
              or login.endswith("[bot]")
              or login.startswith("app/"))
    if login and not is_bot:
        return "@" + login
    return REVIEWERS


def recipient(pr, cls):
    """Route every stalled PR to its landing owner.

    A red codeowner gate is an ordinary gate failure for that owner to diagnose,
    not a human-review queue routed to the reviewers team.
    """
    return resolve_owner(pr)


def marker(cls, now_iso):
    return "%s class=%s at=%s -->" % (MARKER_PREFIX, cls, now_iso)


def parse_marker(body):
    for line in (body or "").splitlines():
        line = line.strip()
        if not line.startswith(MARKER_PREFIX):
            continue
        fields = {}
        tail = line[len(MARKER_PREFIX):]
        if tail.endswith("-->"):
            tail = tail[:-3]
        for token in tail.split():
            if "=" in token:
                key, _, value = token.partition("=")
                fields[key] = value
        if "class" in fields and "at" in fields:
            return {"class": fields["class"], "at": fields["at"]}
    return None


def should_escalate(cls, labels, last, now_ts):
    """Dedupe with GitHub itself as the state store (spec 8).

    Speak up on: first sighting, a change of class, or once the re-nag window
    has elapsed. Otherwise stay quiet — the cron runs every 15 minutes and a
    stalled PR must not collect 96 identical comments.
    """
    if cls == "healthy":
        return False
    if STALLED_LABEL not in labels:
        return True
    if last is None or last.get("class") != cls:
        return True
    at = _ts(last.get("at"))
    if at is None:
        return True
    return (now_ts - at) >= RENAG_HOURS * 3600


ADVICE = {
    "broken":  "CI is red or the branch conflicts. Fix or rebase; the queue "
               "cannot take it.",
    "gated":   "Everything is green except the codeowner gate. Diagnose the "
               "current-head AI review publication, stale failed suites, and "
               "workflow inputs; repair or re-request the failed gate before "
               "queueing.",
    "unarmed": "This PR is mergeable but auto-merge was never armed, so nothing "
               "will ever pick it up. Run: `gh pr merge --auto --squash`",
    "behind":  "Green but behind the base branch. Rebase and push "
               "`--force-with-lease`; auto-merge stays armed.",
    "stuck":   "Open and not progressing, cause unrecognised. Needs a human look.",
}

PR_FIELDS = ("number,isDraft,baseRefName,author,labels,autoMergeRequest,"
             "mergeStateStatus,mergeable,statusCheckRollup,headRefOid,commits")


def _gh(args, check=True):
    proc = subprocess.run(["gh"] + args, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError("gh %s failed: %s" % (" ".join(args), proc.stderr.strip()))
    return proc.stdout


def _human(minutes):
    """Render an idle duration. Keeps the hour remainder past a day, because
    flooring 69h to '2d' understates a stall by almost a full day."""
    hours = minutes // 60
    if hours < 48:
        return "%dh" % hours
    days, rem = divmod(hours, 24)
    return "%dd %dh" % (days, rem) if rem else "%dd" % days


def comment_body(pr, cls, who, idle_minutes, now_iso):
    return (
        "%s — this PR has not progressed in **%s** (`%s`).\n\n"
        "%s\n\n"
        "<sub>Posted by the sm-workflow PR sweep. Add `%s` to silence it for "
        "this PR.</sub>\n%s"
    ) % (who, _human(idle_minutes), cls, ADVICE.get(cls, ADVICE["stuck"]),
         OPTOUT_LABEL, marker(cls, now_iso))


def fetch_open_prs(repo):
    """Open PRs with behind_by folded in.

    behind_by comes from the compare endpoint because mergeStateStatus is
    computed lazily and routinely returns UNKNOWN even on an individual fetch
    (spec 5.2) — trusting it would skip exactly the PRs we exist to catch.
    """
    numbers = json.loads(_gh(["pr", "list", "--repo", repo, "--state", "open",
                              "--limit", "100", "--json", "number"]))
    out = []
    skipped = 0
    for entry in numbers:
        try:
            pr = json.loads(_gh(["pr", "view", str(entry["number"]), "--repo", repo,
                                 "--json", PR_FIELDS]))
        except (RuntimeError, ValueError) as exc:
            print("::warning::skipping PR %s: %s" % (entry["number"], exc))
            skipped += 1
            continue
        commits = pr.pop("commits", None) or []
        pr["headCommittedAt"] = commits[-1]["committedDate"] if commits else None
        pr["behind_by"] = 0
        try:
            cmp_json = json.loads(_gh(["api", "repos/%s/compare/%s...%s"
                                       % (repo, pr["baseRefName"], pr["headRefOid"])]))
            pr["behind_by"] = cmp_json.get("behind_by", 0)
        except (RuntimeError, ValueError) as exc:
            # Cannot prove behind-ness; the PR still classifies on checks and
            # arming, and lands in stuck rather than being dropped silently.
            print("::warning::compare failed for #%s: %s" % (pr["number"], exc))
        out.append(pr)
    if skipped:
        # One loud line, because a guard that skips silently is
        # indistinguishable from a healthy one: BUG-2314 ran blind for ~40h
        # over eight stalled PRs this way. Never a failing exit - the sweep
        # must stay unable to block anything.
        print("::warning::%d of %d open PRs could not be read and were "
              "SKIPPED - the sweep is blind to them. If the error above names "
              "checkSuite.workflowRun, the workflow is missing actions: read."
              % (skipped, len(numbers)))
    return out


def last_sweep_marker(repo, number):
    try:
        raw = _gh(["api", "repos/%s/issues/%s/comments" % (repo, number),
                   "--paginate"])
        comments = json.loads(raw)
    except (RuntimeError, ValueError):
        return None
    for comment in reversed(comments):
        found = parse_marker(comment.get("body", ""))
        if found:
            return found
    return None


def _ensure_label(repo, name):
    subprocess.run(["gh", "label", "create", name, "--repo", repo,
                    "--color", "D93F0B", "--description", "sm-workflow PR sweep"],
                   capture_output=True, text=True)


def emit(event_type, payload):
    """Fire-and-forget into the WAFFLE work_events log. Never blocks."""
    secret = os.environ.get("KIT_EVENTS_SECRET", "")
    if not secret:
        return
    body = json.dumps({
        "ts": datetime.now().astimezone().isoformat(),
        "source": "kit", "event_type": event_type,
        "repo": os.environ.get("GITHUB_REPOSITORY", "").split("/")[-1],
        "sha": os.environ.get("GITHUB_SHA", ""),
        "actor": os.environ.get("GITHUB_ACTOR", ""),
        "payload": payload,
        "evidence_url": "%s/%s/actions/runs/%s" % (
            os.environ.get("GITHUB_SERVER_URL", ""),
            os.environ.get("GITHUB_REPOSITORY", ""),
            os.environ.get("GITHUB_RUN_ID", "")),
    }).encode()
    req = urllib.request.Request(
        "https://webhook-hub.sprintmode.ai/events", data=body,
        headers={"Authorization": "Bearer " + secret,
                 "Content-Type": "application/json",
                 # Cloudflare's edge bot-mitigation refuses urllib's default
                 # "Python-urllib/3.x" from a GitHub Actions datacenter IP,
                 # before the hub ever sees the request. That is what the five
                 # HTTP 403s on sm-api were: the hub 401s on a bad secret and
                 # never 403s, so a 403 here was never an auth failure.
                 "User-Agent": EMIT_USER_AGENT})
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as exc:                                    # noqa: BLE001
        print("::warning::event emit failed (non-blocking): %s" % exc)


def sweep(repo, threshold_min, now_ts, dry_run=False):
    now_iso = datetime.fromtimestamp(now_ts).astimezone().isoformat()
    results = []
    for pr in fetch_open_prs(repo):
        cls = classify(pr, now_ts, threshold_min)
        number = pr["number"]
        labels = _labels(pr)
        if cls == "healthy":
            if STALLED_LABEL in labels and not dry_run:
                subprocess.run(["gh", "pr", "edit", str(number), "--repo", repo,
                                "--remove-label", STALLED_LABEL],
                               capture_output=True, text=True)
            continue
        last = last_sweep_marker(repo, number)
        idle_min = int(idle_seconds(pr, now_ts) // 60)
        who = recipient(pr, cls)
        acted = should_escalate(cls, labels, last, now_ts)
        results.append({"number": number, "class": cls, "recipient": who,
                        "idle_minutes": idle_min, "escalated": acted})
        if not acted or dry_run:
            continue
        _ensure_label(repo, STALLED_LABEL)
        subprocess.run(["gh", "pr", "comment", str(number), "--repo", repo,
                        "--body", comment_body(pr, cls, who, idle_min, now_iso)],
                       capture_output=True, text=True)
        subprocess.run(["gh", "pr", "edit", str(number), "--repo", repo,
                        "--add-label", STALLED_LABEL], capture_output=True, text=True)
        emit("kit.pr_stalled", {"pr": number, "class": cls, "owner": who,
                                "idle_minutes": idle_min,
                                "base": pr.get("baseRefName")})
    return results


def _cmd_classify(args):
    pr = json.load(sys.stdin)
    now_ts = _ts(args.now)
    print(json.dumps({
        "class": classify(pr, now_ts, args.threshold),
        "idle_minutes": round(idle_seconds(pr, now_ts) / 60),
    }))
    return 0


def _cmd_sweep(args):
    now_ts = _ts(args.now) if args.now else datetime.now().timestamp()
    for row in sweep(args.repo, args.threshold, now_ts, args.dry_run):
        print(json.dumps(row))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="pr-sweep")
    sub = parser.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("classify", help="classify one PR payload from stdin")
    c.add_argument("--now", required=True)
    c.add_argument("--threshold", type=int, default=60)
    c.set_defaults(func=_cmd_classify)
    s = sub.add_parser("sweep", help="sweep a repo's open PRs")
    s.add_argument("--repo", required=True)
    s.add_argument("--threshold", type=int, default=60)
    s.add_argument("--now")
    s.add_argument("--dry-run", action="store_true")
    s.set_defaults(func=_cmd_sweep)
    args = parser.parse_args(argv)
    # Fail-open: this job must never be the reason anything goes red. It is
    # schedule-only and not a required check, so exiting 0 is always safe.
    try:
        return args.func(args)
    except Exception as exc:                                    # noqa: BLE001
        print("::warning::pr-sweep failed (non-blocking): %s" % exc)
        return 0


if __name__ == "__main__":
    sys.exit(main())
