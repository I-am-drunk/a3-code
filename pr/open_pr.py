#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""File (or re-sync) the Automations pull request on pingdotgg/t3code.

The branch lives in the fork (I-am-drunk/a3-code); the PR lives upstream, so upstream's
checks and review bots run on it. Reads the title from the first `# ` heading of
PR_MESSAGE.md and the body from everything after it.

    uv run pr/open_pr.py --dry-run        # show what would happen, render title/body
    uv run pr/open_pr.py                  # push branch, then create or update the PR
    uv run pr/open_pr.py --draft          # create as a draft (note: Cursor Bugbot skips drafts)
    uv run pr/open_pr.py --yes            # skip the confirmation prompt

Idempotent: if an open PR for the branch already exists, its title and body are updated
instead of creating a second one.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO_DIR = HERE.parent / "a3 code"
MESSAGE_FILE = HERE / "PR_MESSAGE.md"

UPSTREAM_REPO = "pingdotgg/t3code"
UPSTREAM_REMOTE = "upstream"
BASE_BRANCH = "main"
FORK_OWNER = "I-am-drunk"
FORK_REMOTE = "origin"
BRANCH = "feat/automations"
SIZE_XXL_LINES = 1000  # upstream's pr-size.yml: 1,000+ effective changed lines => size:XXL


def sh(args: list[str], *, cwd: pathlib.Path | None = None, check: bool = True) -> str:
    proc = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stdout + proc.stderr)
        raise SystemExit(f"command failed ({proc.returncode}): {' '.join(args)}")
    return proc.stdout.strip()


def parse_message(path: pathlib.Path) -> tuple[str, str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    try:
        idx = next(i for i, line in enumerate(lines) if line.startswith("# "))
    except StopIteration:
        raise SystemExit(f"{path}: no '# <title>' heading found")
    title = lines[idx][2:].strip()
    body_lines = lines[idx + 1 :]
    while body_lines and not body_lines[0].strip():
        body_lines.pop(0)
    body = "\n".join(body_lines).rstrip() + "\n"
    if "_pending_" in body:
        print("note: PR_MESSAGE.md still contains '_pending_' placeholders", file=sys.stderr)
    return title, body


def existing_pr(branch: str) -> dict | None:
    out = sh([
        "gh", "pr", "list", "--repo", UPSTREAM_REPO, "--state", "open",
        "--head", branch, "--author", "@me", "--json", "number,url,isDraft,title",
    ])
    prs = json.loads(out or "[]")
    return prs[0] if prs else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print the plan and rendered message; change nothing")
    ap.add_argument("--draft", action="store_true", help="create the PR as a draft")
    ap.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    ap.add_argument("--branch", default=BRANCH, help=f"head branch in the fork (default: {BRANCH})")
    ap.add_argument("--allow-dirty", action="store_true", help="proceed with uncommitted changes in the worktree")
    ap.add_argument("--no-push", action="store_true", help="assume the branch is already pushed")
    args = ap.parse_args()

    if not REPO_DIR.is_dir() or not (REPO_DIR / ".git").exists():
        raise SystemExit(f"repo not found at {REPO_DIR}")
    if not MESSAGE_FILE.is_file():
        raise SystemExit(f"message file not found at {MESSAGE_FILE}")

    title, body = parse_message(MESSAGE_FILE)
    sh(["gh", "auth", "status"])  # fails loudly when logged out

    current = sh(["git", "branch", "--show-current"], cwd=REPO_DIR)
    if current != args.branch:
        raise SystemExit(f"checked out branch is '{current}', expected '{args.branch}' (git switch {args.branch})")
    dirty = sh(["git", "status", "--porcelain"], cwd=REPO_DIR)
    if dirty and not args.allow_dirty:
        raise SystemExit("worktree has uncommitted changes; commit them or pass --allow-dirty")

    sh(["git", "fetch", UPSTREAM_REMOTE, "--quiet"], cwd=REPO_DIR)
    base_ref = f"{UPSTREAM_REMOTE}/{BASE_BRANCH}"
    ahead = int(sh(["git", "rev-list", "--count", f"{base_ref}..HEAD"], cwd=REPO_DIR) or "0")
    behind = int(sh(["git", "rev-list", "--count", f"HEAD..{base_ref}"], cwd=REPO_DIR) or "0")
    shortstat = sh(["git", "diff", "--shortstat", f"{base_ref}...HEAD"], cwd=REPO_DIR)
    numstat = sh(["git", "diff", "--numstat", f"{base_ref}...HEAD"], cwd=REPO_DIR)
    changed = 0
    for line in numstat.splitlines():
        added, deleted, path = (line.split("\t") + ["", "", ""])[:3]
        if added.isdigit() and deleted.isdigit():
            changed += int(added) + int(deleted)

    pr = existing_pr(args.branch)

    print(f"repo      : {REPO_DIR}")
    print(f"head      : {FORK_OWNER}:{args.branch}  ->  {UPSTREAM_REPO}:{BASE_BRANCH}")
    print(f"commits   : {ahead} ahead of {base_ref}, {behind} behind")
    print(f"diff      : {shortstat or '(none)'}")
    if changed >= SIZE_XXL_LINES:
        print(f"size      : ~{changed} changed lines => upstream will label size:XXL")
    print(f"existing  : {pr['url'] + (' (draft)' if pr['isDraft'] else '') if pr else 'none'}")
    print(f"title     : {title}")
    print("body      :")
    for line in body.splitlines()[:12]:
        print(f"  | {line}")
    if len(body.splitlines()) > 12:
        print(f"  | ... ({len(body.splitlines())} lines total)")

    if ahead == 0:
        msg = f"no commits ahead of {base_ref}; nothing to file"
        if args.dry_run:
            print(f"warning   : {msg}")
        else:
            raise SystemExit(msg)
    if behind and not args.dry_run:
        print(f"warning   : branch is {behind} commits behind {base_ref}; consider rebasing first")

    if args.dry_run:
        print("dry run   : no changes made")
        return

    if not args.yes:
        answer = input("Type 'file' to push and create/update the PR: ").strip()
        if answer != "file":
            raise SystemExit("aborted")

    if not args.no_push:
        sh(["git", "push", "-u", FORK_REMOTE, args.branch], cwd=REPO_DIR)

    body_path = HERE / ".pr-body.rendered.md"
    body_path.write_text(body, encoding="utf-8")
    try:
        if pr:
            sh(["gh", "pr", "edit", str(pr["number"]), "--repo", UPSTREAM_REPO, "--title", title, "--body-file", str(body_path)])
            print(f"updated   : {pr['url']}")
        else:
            cmd = [
                "gh", "pr", "create", "--repo", UPSTREAM_REPO, "--base", BASE_BRANCH,
                "--head", f"{FORK_OWNER}:{args.branch}", "--title", title, "--body-file", str(body_path),
            ]
            if args.draft:
                cmd.append("--draft")
            url = sh(cmd)
            print(f"created   : {url}")
    finally:
        body_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
