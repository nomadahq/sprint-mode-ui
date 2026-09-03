#!/usr/bin/env python3
"""Emit one bounded, value-free terminal deploy result.

Managed workflows pass only identifiers, canonical status enums, and the GitHub
run URL. Provider response bodies and free-form messages deliberately have no
input field, so this helper cannot turn them into logs or step summaries.
"""

import argparse
import json
import os
import re
import sys
from urllib.parse import urlsplit


EXACT_SHA = re.compile(r"[0-9a-f]{40}")
IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
DNS_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")
PROVIDERS = {"cloudflare-pages", "cloudflare-workers", "railway"}
ENVIRONMENTS = {"staging", "production"}
DEPLOY_STATUSES = {"verified", "failed", "timeout", "unconfigured", "skipped"}
PROBE_STATUSES = {"passed", "failed", "skipped", "unconfigured"}


class ResultError(Exception):
    """A caller tried to emit evidence outside the closed schema."""


def safe_run_url(value):
    if not value or len(value) > 512:
        raise ResultError("run_url is invalid")
    if any(ord(char) < 32 or ord(char) == 127 for char in value) or "\\" in value:
        raise ResultError("run_url is invalid")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except (TypeError, ValueError):
        raise ResultError("run_url is invalid")
    host = parsed.hostname
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or (port is not None and not 1 <= port <= 65535)
        or any(DNS_LABEL.fullmatch(label) is None for label in host.split("."))
    ):
        raise ResultError("run_url is invalid")
    return value


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--environment", required=True)
    parser.add_argument("--deployment-id", required=True)
    parser.add_argument("--deploy-status", required=True)
    parser.add_argument("--health-status", required=True)
    parser.add_argument("--smoke-status", required=True)
    parser.add_argument("--run-url", required=True)
    return parser, parser.parse_args(argv)


def build_result(args):
    if args.provider not in PROVIDERS:
        raise ResultError("provider is invalid")
    if EXACT_SHA.fullmatch(args.sha) is None:
        raise ResultError("sha is invalid")
    if args.environment not in ENVIRONMENTS:
        raise ResultError("environment is invalid")
    if args.deployment_id != "unavailable" and IDENTIFIER.fullmatch(args.deployment_id) is None:
        raise ResultError("deployment_id is invalid")
    if args.deploy_status not in DEPLOY_STATUSES:
        raise ResultError("deploy_status is invalid")
    if args.health_status not in PROBE_STATUSES:
        raise ResultError("health_status is invalid")
    if args.smoke_status not in PROBE_STATUSES:
        raise ResultError("smoke_status is invalid")
    if args.deploy_status == "verified" and (
        args.health_status != "passed" or args.smoke_status != "passed"
    ):
        raise ResultError("verified requires passed health and smoke evidence")

    warnings = []
    if args.deployment_id == "unavailable":
        warnings.append("deployment id unavailable")
    if args.health_status in {"skipped", "unconfigured"}:
        warnings.append("health evidence incomplete")
    if args.smoke_status in {"skipped", "unconfigured"}:
        warnings.append("critical-flow evidence incomplete")

    return {
        "schema_version": 1,
        "provider": args.provider,
        "sha": args.sha,
        "environment": args.environment,
        "deployment_id": args.deployment_id,
        "deploy_status": args.deploy_status,
        "health_status": args.health_status,
        "smoke_status": args.smoke_status,
        "run_url": safe_run_url(args.run_url),
        "warnings": warnings,
    }


def main(argv=None):
    parser, args = parse_args(argv)
    try:
        result = build_result(args)
    except ResultError as error:
        parser.error(str(error))

    line = "DEPLOY-RESULT: " + json.dumps(result, separators=(",", ":"))
    print(line)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        try:
            with open(summary_path, "a", encoding="utf-8") as summary:
                summary.write("### Deploy result\n\n")
                summary.write(line + "\n")
        except OSError:
            print("::warning::deploy result could not be appended to the step summary", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
