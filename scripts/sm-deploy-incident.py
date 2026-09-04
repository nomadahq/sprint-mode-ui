#!/usr/bin/env python3
"""Create or reuse one bounded GitHub issue for failed deploy verification."""

import argparse
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlsplit


EXACT_SHA = re.compile(r"[0-9a-f]{40}")
TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,79}")
STATUSES = {"passed", "failed", "skipped", "unconfigured"}
REPOSITORY = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/[A-Za-z0-9_.-]{1,100}"
)


def fail(message):
    sys.stderr.write("deploy incident: %s\n" % message)
    return 1


def valid_run_url(value):
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    return bool(
        parsed.scheme == "https"
        and parsed.hostname
        and parsed.username is None
        and parsed.password is None
        and not parsed.query
        and not parsed.fragment
        and (port is None or 1 <= port <= 65535)
        and all(ord(char) >= 32 and ord(char) != 127 for char in value)
    )


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--environment", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--deployment-id", required=True)
    parser.add_argument("--health-status", required=True)
    parser.add_argument("--smoke-status", required=True)
    parser.add_argument("--run-url", required=True)
    return parser.parse_args(argv)


def gh(arguments):
    completed = subprocess.run(
        ["gh"] + arguments,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if completed.returncode:
        raise RuntimeError("GitHub issue operation failed")
    return completed.stdout


def main(argv):
    args = parse_args(argv)
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    if REPOSITORY.fullmatch(repository) is None:
        return fail("GITHUB_REPOSITORY is malformed")
    for label, value in (
        ("provider", args.provider),
        ("environment", args.environment),
        ("deployment id", args.deployment_id),
    ):
        if TOKEN.fullmatch(value) is None:
            return fail("%s is malformed" % label)
    if EXACT_SHA.fullmatch(args.sha) is None:
        return fail("SHA must be 40 lowercase hexadecimal characters")
    if args.health_status not in STATUSES or args.smoke_status not in STATUSES:
        return fail("probe status is malformed")
    if not valid_run_url(args.run_url):
        return fail("run URL must be one safe HTTPS URL")

    title = "[deploy incident] %s/%s/%s" % (
        args.provider,
        args.environment,
        args.sha,
    )
    try:
        raw = gh(
            [
                "issue",
                "list",
                "--repo",
                repository,
                "--state",
                "open",
                "--limit",
                "100",
                "--search",
                "%s in:title" % title,
                "--json",
                "number,title",
            ]
        )
        issues = json.loads(raw)
        if not isinstance(issues, list):
            raise ValueError("issue list is not an array")
        for issue in issues:
            if isinstance(issue, dict) and issue.get("title") == title:
                print("deploy incident already open: #%s" % issue.get("number", "unknown"))
                return 0

        body = "\n".join(
            [
                "Managed deploy verification failed.",
                "",
                "- Provider: `%s`" % args.provider,
                "- Environment: `%s`" % args.environment,
                "- Exact SHA: `%s`" % args.sha,
                "- Deployment ID: `%s`" % args.deployment_id,
                "- Health status: `%s`" % args.health_status,
                "- Critical-flow status: `%s`" % args.smoke_status,
                "- Workflow run: %s" % args.run_url,
                "",
                "Use the managed recovery procedure in `docs/guides/deploy-operations.md`.",
            ]
        )
        gh(
            [
                "issue",
                "create",
                "--repo",
                repository,
                "--title",
                title,
                "--body",
                body,
            ]
        )
    except (json.JSONDecodeError, RuntimeError, ValueError):
        return fail("could not create or resolve the durable GitHub issue")
    print("deploy incident created")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
