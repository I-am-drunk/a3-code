# Devin 3.10.31 decompilation — shared brief for subagents

Read this before doing anything. It is the ground truth for paths, rules, and output shape.

## Goal of the whole effort

Reimplement Devin's Automations, Integrations (Connections), and Voice Call features inside T3 Code (the repo at `/Users/irene/a3-code`), styled like T3 Code. **Nothing is being implemented yet.** This phase is decompilation + architecture documentation + HTML mockups only.

## Artifacts (read-only evidence)

| Artifact | Path | Notes |
|---|---|---|
| Installed app (RUNNING — do not touch, do not relaunch, do not kill) | `/Applications/Devin.app` | 3.10.31, bundle id `com.exafunction.windsurf` |
| Copy of the app for static analysis | `/Users/irene/a3-code/Automations UI/reference/Devin.app` | Never launch it. Never execute binaries from it. Static reads only. |
| Desktop workbench bundle | `…/reference/Devin.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js` | 20 MB. **Formatted copy:** `_work/formatted-desktop/workbench.desktop.main.js` (888k lines) — cite that |
| Sessions workbench bundle (Devin "Sessions" window; hosts the ACP transcript renderer, voice-call meta schemas, `settings/connections` nav table, `devin_automation_manage` renderer) | `…/reference/Devin.app/Contents/Resources/app/out/vs/sessions/sessions.desktop.main.js` | 44 MB. **Formatted copy:** `_work/formatted-desktop/sessions.desktop.main.js` (1.67M lines) — cite that |
| Windsurf extension | `…/reference/Devin.app/Contents/Resources/app/extensions/windsurf/dist/extension.js` | 9.7 MB. **Formatted copy:** `_work/formatted-desktop/extension.js` (269k lines) — cite that |
| Windsurf schemas (mcp_config etc.) | `…/reference/Devin.app/Contents/Resources/app/extensions/windsurf/schemas/` | |
| Devin CLI (Rust) | `…/reference/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin` | 163 MB. Use `strings`/`rg -a`, never execute |
| Devin CLI docs | `…/reference/Devin.app/Contents/Resources/app/extensions/windsurf/devin/share/devin/docs/` | mdx: subagents, sandbox, handoff, extensibility, enterprise |
| Language server (Go) | `…/reference/Devin.app/Contents/Resources/app/extensions/windsurf/bin/language_server_macos_arm` | 168 MB. strings only |
| Captured app.devin.ai production web bundle (2026-09-20) | `/Users/irene/a3-code/Automations UI/reference/web-2026-09-20/assets/` | 2,168 rolldown chunks, 78 MB; `index.json` + `all-assets.sha256` beside it |
| Live user data (read-only, copy don't touch) | `~/Library/Application Support/Devin/` and `~/.codeium/windsurf/` | globalStorage/state.vscdb, acp-messages/, logs/ |
| Previous (3.8.20) decompilation | `/Users/irene/a3-code/Automations UI/DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md`, `DEVIN_MCP_OAUTH_ARCHITECTURE_GUIDE.md`, `DEVIN_CLIENT_VS_SERVER_FEASIBILITY_AUDIT.md`, `DEVIN_AUTOMATIONS_FULL_ANNOTATED_DECOMPILE.txt` | Stale but mostly accurate; diff against it, do not re-derive what it already proves unless 3.10.31 changed it |
| Previous exact-copy React app of Automations | `/Users/irene/a3-code/Automations UI/app/` | Vite + Tailwind, faithful 3.8.20 clone |

Key chunk names in the captured web bundle (grep `assets/` for the rest):

- Automations: `AutomationsPage-*.js`, `AutomationEditorPage-*.js`, `AutomationViewPage-*.js`, `AutomationListItem-*.js`, `AutomationListTable-*.js`, `AutomationSidePanel-*.js`, `AutomationScopeRow-*.js`, `AutomationItemAnnotation-*.js`, `automations-*.js`, `WebhookConfigModal-*.js`, `CodeStepRunDetail-*.js`, `OncallPage-*.js`, `ResponderEditorPage-*.js`
- Integrations / Connections: `connections-*.js` (two), `ConnectionsSection-*.js`, `IntegrationPageLayout-*.js`, `integrationsConstants-*.js`, `integrationCheck-*.js`, `settings.integrations.index-*.js`, per-service `github-*.js`, `gitlab-*.js`, `slack-*.js`, `linear-*.js`, `jira-*.js`, `bitbucket-*.js`, `azure-devops-*.js`, `perforce-*.js`, `microsoft-teams-*.js`, `pagerduty-*.js`, `incident-io-*.js`, `pylon-*.js`, `oauth-callback-*.js`, `pr-review-oauth-*.js`, `connect-git-*.js`, `github-rate-limits-*.js`
- MCP (adjacent, NOT the focus of the integrations track): `MCPEditor-*.js`, `MCPSetupPage-*.js`, `MCPConfigurationComponents-*.js`, `MCPDeclaredConfiguration-*.js`, `settings.mcp-marketplace.index-*.js`, `settings.enterprise-mcp-management.index-*.js`, `EnterpriseMcpServerEditorPage-*.js`, `McpServiceIcons-*.js`
- Voice call: `VoiceCallController-*.js`, `VoiceCallButton-*.js`, `VoiceCallPresence-*.js`, `sidebar-voice-call-*.js`, `voiceCallChannel-*.js`, `voiceCallSounds-*.js`; plus `en-*.js` i18n (`voiceCall.*`, `phone.*` / "Call Devin"), `InputBox-*.js`, `SessionPanes-*.js`, `MessageHistoryProvider-*.js`, `useSessionActivityState-*.js`, `globalState-*.js`, `requests-*.js`
- The `app-initial-*.js` chunks hold shared runtime: API client, query keys, route table, zod schemas, permissions. Many feature files import from them; resolve the import you need by grepping the exported symbol.

## Hard rules

1. **Static analysis only.** Never launch `Devin.app`, never run `devin`, never run the language server, never attach to the running process, never send network requests to `api.devin.ai` or `app.devin.ai` beyond fetching public static assets (already done). No computer use, no browsers.
2. **Never kill processes by pattern.** Don't `pkill`, don't `kill` anything you didn't spawn.
3. **Never write to** `/Applications`, `~/Library/Application Support/Devin`, `~/.codeium`, `~/.t3`. Copy out if you must, into `/Users/irene/a3-code/Automations UI/_work/<track>/`.
4. **Don't edit** anything under `apps/`, `packages/`, `docs/` of the T3 repo in this phase. You may read it freely to inform mapping proposals.
5. **Evidence labels are mandatory** on every claim: **PROVEN** (literal string/route/field/branch you can cite at file:offset or file:line), **PROJECTED** (shape implied by properties the client reads), **DERIVED** (unavoidable from proven control flow), **REMOTE/UNKNOWN** (lives behind the server; do not invent it). Never present REMOTE as PROVEN.
6. Cite evidence as `chunkName.js:lineNumber` after formatting with `npx prettier --parser babel` or `node -e` into `_work/<track>/formatted/`. Minified line-1 citations are useless. Format the chunks you rely on and cite the formatted line.
7. Keep working files in `/Users/irene/a3-code/Automations UI/_work/<track>/`. Final deliverables go where your task says. Do not touch other tracks' folders.
8. Do not commit. The orchestrator commits.
9. Prefer `rg` (ripgrep) with `-a` for binaries, `strings -n 8` for the Rust/Go binaries, `sqlite3 -readonly` on a **copied** `state.vscdb`.
10. Report honestly. If something is not in the client, say REMOTE/UNKNOWN and say what the boundary looks like from the client side. Do not pad.

## Output style

Markdown, dense, tables where it helps, mermaid for flows. Lead with a one-paragraph "what this proves" summary. Then the contract (routes, endpoints, payload shapes, state machines, copy). Then the T3 mapping section (how this concept would map onto T3's environment/project/thread/turn model — proposals, clearly marked as proposals). Then an evidence appendix with citations. Aim for exactness over prose.

## Context discipline (MANDATORY — the first pass of agents died from ignoring this)

Five agents each hit the ~160k-token context ceiling and crashed before writing anything. Your context is a budget of roughly 100k tokens of tool output. Rules:

1. **Never `Read` more than 120 lines at once, and never `Read` an `app-initial-*.js` chunk.** Use `rg -n` with `-A/-B` ≤ 8, or `sed -n 'START,ENDp'` with ranges ≤ 120 lines. The formatted bundles are hundreds of thousands of lines; you locate, you do not browse.
2. **Resolve imports by symbol, not by reading the module.** `rg -n 'as SYMBOL\b' file.js` to find the import line, then `rg -n 'function TARGET\(|TARGET = ' ../formatted/app-initial-*.js | head` and `sed -n` the ~40 lines around the hit.
3. **Write findings to disk as you go.** After every 3–5 tool calls, append what you learned (with citations) to `_work/<track>/NOTES-<yourtask>.md`. If you crash, the next agent continues from the notes. Read that file first if it already exists — do not redo its work.
4. **Pipe long outputs through `head`/`wc`/`cut -c1-200`.** Minified lines are kilobytes long; `grep -o -E '.{0,200}PATTERN.{0,200}'` instead of printing whole lines.
5. **Stop investigating at ~60% of your budget and write the deliverable.** A complete document with a few REMOTE/UNKNOWN gaps beats a crash with nothing. If you are unsure how much you've used, count tool calls: after ~35 tool calls, start writing.
6. Your task is deliberately narrow. Do not expand into neighbouring tracks; note the pointer in NOTES and move on.

## Output discipline (MANDATORY — second-pass agents died from this)

The API gateway times out on any single model response longer than a few thousand tokens. A one-shot `Write` of a long document kills you. Write every deliverable in chunks: an initial `Write` with header + first section (≤150 lines), then append each further section with a Bash `cat >> "<file>" <<'EOF' ... EOF` heredoc of ≤150 lines. Same for long CSS/HTML. Keep your own prose messages short.
