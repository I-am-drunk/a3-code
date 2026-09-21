# [WIP · not for merging · please don't close] feat(automations): run agents on schedules, webhooks, and pull request events

> [!IMPORTANT]
> **Why this PR exists.** It produces real screenshots of what Automations could look like inside T3 Code, to accompany a feature request in Ideas discussions, and gives the work a place to be reviewed in small, CI-green pushes while those images are made. It is not a request to merge. We have read `CONTRIBUTING.md` and know unsolicited feature work is not what you want right now; we will close this ourselves once the images are captured, and immediately if you ask — one comment is enough. Every push stays under about 1,000 changed lines and passes `vp fmt`, `vp lint`, the touched packages' typechecks, and targeted tests before it goes up.

## Problem

T3 Code only starts work when someone types in the composer. Recurring and event-driven jobs — bump dependencies every Monday, investigate each failing check run on `main`, review every pull request the moment it opens, act on whatever a monitoring webhook sends — need a person to open a thread, paste the prompt, and pick the model, every time, on every environment. The server already owns everything an unattended run needs (provider drivers, worktrees, checkpoints, pull request polling, remote access through T3 Connect), but nothing can drive it from a clock or an event.

## Fix

An **automation** is an environment-owned record with triggers, actions, and limits. When a trigger fires, the server starts a thread in the target project with the automation's prompt and model selection, in a fresh worktree or the project tree, in the configured runtime mode, and records the run. A run is an ordinary thread: checkpointed, diffable, visible in the sidebar, and controllable from any connected client.

- **Contracts.** `packages/contracts/src/automation.ts` defines the automation, its triggers (`schedule`, `webhook`, `pullRequest`, `manual`), actions (`startThread`, `messageThread`, `notify`), runs, limits, templates, and the RPC inputs and errors. Trigger and action unions decode forward-compatibly, so a client keeps rendering an automation whose newer server added a kind it does not know.
- **Server.** `AutomationService` persists definitions and runs in the environment's SQLite database. `AutomationScheduler` is a reactor: it evaluates cron triggers once a minute and keeps running with no client connected, like `ThreadSettlementReactor`. Webhooks arrive at `POST /api/automations/:automationId/hooks/:hookId` and are verified against a per-hook secret. Pull request triggers are fed by the existing pull request watcher. Runs dispatch `thread.create` and `thread.turn.start` through the orchestration engine, so the decider, projector, and checkpointing see nothing new. Concurrency, queue depth, and invocation-window limits are enforced before a run is queued.
- **Client runtime.** Atom state per environment for the automation list, one automation, and its runs, in `packages/client-runtime`, so web and mobile compose it the same way.
- **Web.** `/automations` lists every automation with a 30-day run sparkline, last-run time, and metadata filters; `/automations/templates` offers starting points; `/automations/create` and `/automations/$automationId/edit` build triggers, conditions, actions, and limits; `/automations/$automationId` shows the activity chart, recent runs with links to their threads, and grouped failures. Everything is built from `apps/web/src/components/ui`.
- **Surfaces.** Sidebar entry, command palette actions (open automations, create automation, run automation), and a keybinding for the list. Mobile gets the shared contracts and runtime state but no screens in this PR; that is a follow-up once the web surface settles.
- **Docs.** `docs/user/automations.md` for the feature, `docs/internals/automations.md` for the architecture, and glossary entries for automation, trigger, and run.

## Verification

Filled in per push; each entry names the commit it covers.

- _pending_

## UI changes

Before: nothing under the sidebar starts work without a person. After: the list, templates, editor, and detail pages, uploaded here as each one lands.

- _pending_

---

Claude Fable 5.1 via Claude Code

🤖 Generated with [Claude Code](https://claude.com/claude-code)
