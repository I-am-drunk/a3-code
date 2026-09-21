# README-tokens.md — where each token/class came from

Deliverables in this folder: `t3-tokens.css`, `t3-shell.html`, `01-sidebar-automations-tab.html`.
All paths below are relative to `/Users/irene/a3-code/apps/web/src/`. Nothing under `apps/` was edited.

## Token map (`t3-tokens.css` section → source)

| Section | What | Source |
|---|---|---|
| 1 Palette scale | `--color-zinc-*`, `--color-neutral-*`, red/amber/emerald/blue steps | Tailwind v4 default oklch scale (index.css `@import "tailwindcss"` :1); `--color-zinc-25` is T3-custom, index.css:147 |
| 2 Geometry | `--control-radius`, `--sidebar-content-inset`, `--sidebar-control-gap`, `--sidebar-row-content-inset`, `--command-*-inset`, `--floating-content-inset`, `--glass-*`, `--workspace-topbar-height`, `--workspace-titlebar-*`, scrollbar tokens | index.css:79-125 |
| 2 Fonts | `--font-sans`, `--font-mono` | index.css:140-144 (`@theme`) |
| 2 Radii | `--radius` 0.625rem; `--radius-sm..3xl` = radius −4/−2/0/+4/+8/+12 px | index.css:972, 196-201 |
| 2 Motion | `t3-status-pulse` stepped keyframes (duty-cycled, steps(6)) | index.css:151, 229-241 |
| 2 Shadows | `--shadow-xs/sm/md` (Tailwind `shadow-xs`, `shadow-sm/5`, `shadow-md/5`), `--shadow-popup(-dark)` | button.tsx:44, empty.tsx:37, tooltip.tsx:46, select.tsx:155 |
| 3 Light roles | `--background … --warning-surface`, `--update*`, `--message-*`, `--code-background`, `--toolbar-*` | index.css:970-1033 |
| 3 Light sidebar | `--sidebar*`, `--sidebar-row-hover/active/selected` | index.css:1024-1032 and `[data-app-sidebar]` 1080-1094 |
| 3/4 Diff colors | `--diff-addition/deletion-foreground` | index.css:1991-1994 |
| 4 Dark roles | `.dark` / `.t3-dark-vars` / `prefers-color-scheme` block | index.css:1035-1076 (`@variant dark`) |
| 4 Dark sidebar | `#000` bg, `#f1f3f7` fg, `#a3a3a3` muted, white/8% border, row hover/active/selected 8/11/7% | index.css:1105-1122 |
| — Not mirrored | `--contrast-*` (identity when contrast boost is 0%, index.css:1442-1530), `--stage-*` artwork, theme-id palettes (632-800, 1136-1279), terminal/diffs/trees overrides, view-transition rules | out of scope for static mockups |

Dark mode wiring: `.dark` on `<html>` (or any wrapper via `.t3-dark-vars`) OR `prefers-color-scheme: dark` when `<html>` has neither `.light` nor `.dark`. `.light` forces light.

## Class map (`t3-tokens.css` → T3 component)

| Class | Mirrors |
|---|---|
| `.t3-app`, `.t3-sidebar` | AppSidebarLayout.tsx:235-247 (`border-r border-sidebar-border bg-sidebar text-sidebar-foreground`, `data-app-sidebar`) |
| `.t3-sidebar-header`, `.t3-sidebar-brand`, `.t3-env-pill` | sidebar/SidebarChrome.tsx:50-75, 86-100 (h-topbar header, T3Wordmark + muted "Code", secondary Badge pill) |
| `.t3-sidebar-toolbar`, `.t3-sidebar-search`, `.t3-sidebar-actions`, `.t3-icon-btn` | sidebar/SidebarThreadHeader.tsx:82-145, 185-205 (h-8 search row; size-7 icon buttons: project scope, New project, New thread) |
| `.t3-sidebar-content`, `.t3-sidebar-list` | Sidebar.tsx:4595 (SidebarGroup ps-[inset+1px] pe-[inset] pb-1), 4607 (`flex flex-col gap-px`) |
| `.t3-shelf`, `.t3-shelf.snoozed` | Sidebar.tsx:655-700 SidebarSectionHeader (h-8 text-xs font-medium, hairline, chevron; snoozed = blue-600/400) and labels at 4880-4905 ("Snoozed (n)", "Settled (n)") |
| `.t3-thread-row` + `.surface`, `.is-active/.is-selected/.is-receded` | Sidebar.tsx:1408-1420 rowSurfaceClassName; 1740-1745 li (py-0.5, content-visibility) |
| `.t3-thread-project`, `.t3-favicon`, `.t3-status-slot` | Sidebar.tsx:1763-1843 (h-5 line: ProjectFavicon size-4, text-xs secondary-label, status icons CircleDashed/MessageCircleQuestion/CircleCheck etc.) |
| `.t3-thread-title`, `.t3-thread-meta` (`.branch .add .del`) | Sidebar.tsx:1920-1947 (mt-1 title; mt-0.5 branch text-xs muted/40; diff-addition/deletion-foreground) |
| `.t3-sidebar-footer`, `.t3-update-pill` | sidebar/SidebarChrome.tsx:187-227 (Settings / Pull Requests / Usage utility items, SidebarUpdatePill, SidebarFooter px-inset py-1) |
| `.t3-nav-item`, `.t3-nav-badge` | New. Sizing follows ui/sidebar.tsx SidebarMenuButton (h-8 rounded-md px-2 text-sm) as used by footer items; badge tints reuse `--update-surface` / `--error-surface` |
| `.t3-btn` (+primary/secondary/ghost/destructive/sm/icon) | ui/button.tsx:11 (base), 21 (default h-8), 20 (sm h-7 text-xs), 44 (primary), 46 (destructive) |
| `.t3-badge` (+success/warning/error/info/neutral/outline/running/primary/sm/pill) | ui/badge.tsx:10, 19, 25, 28-35 (8% tint light → 16% dark) |
| `.t3-dot` | Sidebar.tsx:1533 `animate-status-pulse` usage; keyframes index.css:229 |
| `.t3-input`, `.t3-textarea`, `.t3-select` | ui/input.tsx:62, 22-24; ui/textarea.tsx:20, 31; ui/select.tsx:15, 24, 155 |
| `.t3-switch` | ui/switch.tsx:21, 35 (track = thumb*2−2 × thumb+2, p-2px, 200ms bg/shadow transition) |
| `.t3-tabs`, `.t3-tab` | ui/toggle-group.tsx / RightPanelTabs.tsx segmented pattern (muted track, card-colored active); `.underline` variant is a mockup convenience |
| `.t3-tooltip` | ui/tooltip.tsx:43-53 (rounded-md border bg-popover text-xs shadow-md/5, px-2 py-1) |
| `.t3-card`, `.t3-panel`, `.t3-popup`, `.t3-menu-item` | ui/dialog-styles.ts / select.tsx:155 popup (rounded-lg, dropdown shadow); ui/menu.tsx item h-7 rounded-md |
| `.t3-table` | ui/table.tsx:10 (text-xs), 46 (row border-b hover:bg-muted/50), 59 (th h-10 px-2 font-medium) |
| `.t3-empty` | ui/empty.tsx:37 (size-9 icon tile), 92 (desc text-sm muted), 105 (max-w-sm gap-4) |
| `.t3-topbar`, `.t3-page`, `.t3-details` | `--workspace-topbar-height` and `--toolbar-*` tokens (index.css:975-980, 113); details slot is a mockup convention for Task B |

## Sidebar placement decision (see `01-sidebar-automations-tab.html`)

**Chosen: a top-level nav item** rendered directly under the search/toolbar row, above the thread list.

Why not per-project: the default sidebar has no per-project sections — it groups threads by lifecycle state (pinned → active → snoozed → settled, Sidebar.tsx:3384-3398) and offers project scoping only as a filter (SidebarThreadHeader project-scope combobox). Devin automations also target multiple repos and run on triggers rather than user turns, so a project nesting would either duplicate entries or hide cross-project ones.

Why not the footer: the footer utility row (Settings / Pull Requests / Usage) is for infrequent destinations. Automations carry live state — running, unread run results, failures — that must be visible without hover; a 16px icon slot can't carry that, a full-width row with a `.t3-nav-badge` can.

States delivered: idle (no badge), unread (`.has-indicator`, primary-tinted count), running (`.is-running`, `--update-surface` + duty-cycled dot), active route with failure (`.is-active` + error-tinted "1 failed"). Light and dark shown side by side via `.dark.t3-dark-vars` wrapper (no iframes, no JS).

## Verification

`t3-shell.html` and `01-sidebar-automations-tab.html` pass a tag-balance check (python `html.parser`, void/SVG elements accounted for). `html-validate` is not available offline in this environment, so it was skipped. No network requests: the only `http` string is the SVG XML namespace inside a data-URI chevron in `.t3-select`. JS is limited to the optional theme toggle in `t3-shell.html`. The only animation is the stepped, duty-cycled status pulse copied from T3, disabled under `prefers-reduced-motion`.
