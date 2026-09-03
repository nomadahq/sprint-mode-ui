#!/usr/bin/env python3
"""Run one bounded deployed-host probe without exposing response bodies."""

import argparse
import ipaddress
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import urlsplit


DNS_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")


def fail(message):
    sys.stderr.write("deploy probe: %s\n" % message)
    return 1


def valid_base_url(value):
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    hostname = parsed.hostname or ""
    try:
        ipaddress.ip_address(hostname)
        return False
    except ValueError:
        pass
    normalized_host = hostname.lower()
    local_suffixes = (".internal", ".lan", ".local", ".localhost", ".home")
    host_ok = bool(
        "." in normalized_host
        and not normalized_host.endswith(local_suffixes)
        and all(DNS_LABEL.fullmatch(label) for label in normalized_host.split("."))
    )
    return bool(
        parsed.scheme == "https"
        and host_ok
        and parsed.username is None
        and parsed.password is None
        and not parsed.query
        and not parsed.fragment
        and (port is None or 1 <= port <= 65535)
        and not any(char in value for char in {'"', "\\"})
    )


def valid_path(value):
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        return False
    parsed = urlsplit(value)
    return bool(
        value.startswith("/")
        and not value.startswith("//")
        and not parsed.scheme
        and not parsed.netloc
        and not parsed.query
        and not parsed.fragment
        and parsed.path == value
        and not any(segment == ".." for segment in value.split("/"))
        and not any(char in value for char in {'"', "\\"})
    )


def append_output(path, key, value):
    try:
        with Path(path).open("a", encoding="utf-8") as handle:
            handle.write("%s=%s\n" % (key, value))
    except OSError as error:
        raise ValueError("could not write bounded output: %s" % error)


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--path", required=True)
    parser.add_argument("--kind", required=True, choices=("health", "smoke"))
    parser.add_argument("--attempts", type=int, default=24)
    parser.add_argument("--sleep-seconds", type=int, default=5)
    parser.add_argument("--github-output", default=os.environ.get("GITHUB_OUTPUT", ""))
    return parser.parse_args(argv)


def main(argv):
    args = parse_args(argv)
    if not valid_base_url(args.base_url):
        return fail("base URL must be HTTPS without credentials, query, or fragment")
    if not valid_path(args.path):
        return fail("path must be one safe absolute URL path")
    if not 1 <= args.attempts <= 30:
        return fail("attempts must be between 1 and 30")
    if not 0 <= args.sleep_seconds <= 60:
        return fail("sleep-seconds must be between 0 and 60")
    if not args.github_output:
        return fail("GITHUB_OUTPUT is required")

    url = args.base_url.rstrip("/") + args.path
    key = "%s_status" % args.kind
    for attempt in range(1, args.attempts + 1):
        completed = subprocess.run(
            [
                "curl",
                "--silent",
                "--show-error",
                "--output",
                os.devnull,
                "--write-out",
                "%{http_code}",
                "--connect-timeout",
                "10",
                "--max-time",
                "15",
                "--proto",
                "=https",
                "--max-redirs",
                "0",
                url,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        code = completed.stdout.strip()
        if completed.returncode != 0 or re.fullmatch(r"[0-9]{3}", code) is None:
            code = "000"
        if code.startswith("2"):
            append_output(args.github_output, key, "passed")
            print("%s probe passed (HTTP %s)" % (args.kind, code))
            return 0
        print("%s probe attempt %d/%d: HTTP %s" % (args.kind, attempt, args.attempts, code))
        if attempt < args.attempts and args.sleep_seconds:
            time.sleep(args.sleep_seconds)

    append_output(args.github_output, key, "failed")
    return fail("%s probe did not return 2xx" % args.kind)


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except ValueError as error:
        raise SystemExit(fail(str(error)))
