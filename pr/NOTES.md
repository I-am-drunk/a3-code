# PR message — working notes (not part of the PR)

Style rules distilled from pingdotgg/t3code PRs #9299, #9306, #9310 (maintainer) and #9137, #9294, #9307, #9308 (accepted external):

- Title: `type(scope): lowercase imperative that names the outcome`, no period. Ours carries the bracketed status prefix the maintainers can read at a glance in the PR list.
- Body: `## Problem` → `## Fix` (bold-led bullets, one per subsystem: contracts / server / client runtime / web / surfaces / docs) → `## Verification` (exact commands, test counts, which packages typechecked) → `## UI changes` (before/after images with descriptive alt text, uploaded to GitHub — never committed) → one attribution line naming model + harness → the 🤖 line.
- Voice: present tense, declarative, mechanism-level. Identifiers in backticks. No hedging, no exclamation marks, no emoji outside the footer, no template checklist.
- Big PRs (#9137, #9308) say plainly why they are big and how they relate to other work. Ours does that in the status callout.
- AGENTS.md "Hit every surface": state a decision per surface (web, desktop, mobile) and per connection mode. The **Surfaces** bullet does this; keep it true.

Keep in sync with the code before every `open_pr.py` run:

- Route paths, service names (`AutomationService`, `AutomationScheduler`), webhook path, trigger/action kinds.
- Replace `_pending_` in Verification with real commands + counts for the pushes that have landed.
- Add uploaded screenshot URLs under UI changes as pages land (upload via the PR page or `gh` release assets, not the repo).
- Bump the attribution line if the model or harness changes.

## Commitments made in the PR message (must actually happen)

1. Screenshots of every page (list, templates, editor, detail) get uploaded to the PR as they land — never committed.
2. When the images are captured, post an **Ideas** discussion on pingdotgg/t3code (category `ideas`) titled like the PR, with the screenshots and a short Problem/Fix summary lifted from the PR body.
3. Then close the PR ourselves with a one-line comment linking the discussion. Close immediately if a maintainer asks, no argument.

## Push mechanics

- The gh OAuth token has scopes `gist, read:org, repo` but not `workflow`; git pushes that carry upstream commits touching `.github/workflows/*` are rejected. Keep the fork's `main` in sync with `gh repo sync I-am-drunk/a3-code --source pingdotgg/t3code --branch main` (server-side merge, not subject to that check), rebase `feat/automations` on it, and never touch `.github/workflows/` in our commits.
