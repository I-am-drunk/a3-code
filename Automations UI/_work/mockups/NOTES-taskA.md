# NOTES Task A (tokens + shell + sidebar mockup)

## index.css map (apps/web/src/index.css, 2224 lines)
- 79-125 :root geometry: --control-radius .5rem, --sidebar-content-inset .5rem, --sidebar-row-content-inset .625rem, --workspace-topbar-height 52px, --glass-*, scrollbar
- 140-144 @theme fonts: --font-sans, --font-mono
- 146-206 @theme inline: color role aliases, --radius-sm..3xl = radius -4/-2/0/+4/+8/+12
- 210-262 keyframes skeleton/status-pulse/status-ping (stepped, duty-cycled)
- 970-1033 :root light palette; 1035-1076 dark variant
- 1080-1123 [data-app-sidebar] sidebar overrides light + dark (dark: bg #000, accent #191a1d, muted #0a0a0a, muted-fg #a3a3a3, border white/8%, input white/18%)
- 1442-1530 --contrast-* derived (identity when contrast boost 0)
- 1991-1999 --diff-addition/deletion(-foreground)

## Sidebar structure (default ThreadSidebar, components/Sidebar.tsx)
- AppSidebarLayout.tsx:243-247 Sidebar side=left, data-app-sidebar, border-r border-sidebar-border bg-sidebar text-sidebar-foreground
- sidebar/SidebarChrome.tsx:50-75 header h-[--workspace-topbar-height], brand "T3 Code" wordmark (T3Wordmark + muted "Code"), optional env pill Badge
- sidebar/SidebarThreadHeader.tsx:82-145 search row (h-8 rounded-md px-2 text-sm font-medium muted, SearchIcon), buttons: project-scope filter (FolderIcon), New project, New thread (size-7 icon buttons)
- Sidebar.tsx:3384-3398 list order: pinned-header(marker), pinned rows, pinned-divider, active rows, snoozed-header shelf ("Snoozed (n)", blue-600/400, h-8 text-xs font-medium with hairline + chevron), settled-header shelf ("Settled (n)", sidebar-muted-foreground/60)
- Sidebar.tsx:1408-1420 row surface: rounded-md; active bg-sidebar-row-active; selected bg-sidebar-row-selected; hover bg-sidebar-row-hover; receded text-sidebar-muted-foreground/75
- Sidebar.tsx:1763-1935 row body: h-[4.875rem] px-[--sidebar-row-content-inset] py-[--sidebar-content-inset]; line1: ProjectFavicon size-4 + project name text-xs text-secondary-label font-medium + status slot (icons size-4: CircleDashed running, MessageCircleQuestion, ShieldQuestion, CircleAlert, Eye, CircleCheck; tabular-nums text-xs); line2 title; line3 branch text-xs muted/40 + diff +N/-N (diff-addition/deletion-foreground)
- SidebarChrome.tsx:187-227 footer: SidebarMenu flex-row: Settings, Pull Requests, Usage icon buttons + SidebarUpdatePill; SidebarFooter px-[--sidebar-content-inset] py-1

## UI primitives (apps/web/src/components/ui/)
- button.tsx:11 base inline-flex gap-2 rounded-[--control-radius] border font-medium; :20 sm h-7 text-xs rounded-md; :21 default h-9/sm:h-8 px-3; :44 primary border-primary bg-primary text-primary-foreground shadow-xs inset white/16%; :46 destructive same w/ bg-destructive text-white
- badge.tsx:10 rounded-sm border-transparent font-medium; :19 default h-6 px-2 text-xs; :28 primary; :30 destructive bg-destructive/8 text-destructive-foreground (dark /16); :31 info; :33 outline border-input bg-background; :34 secondary; :35 success bg-success/8 text-success-foreground (dark /16)
- input.tsx:62 wrapper rounded-lg border border-input bg-background shadow-xs/5 ring-ring/24; :22 h-7.5 px-3 placeholder:text-placeholder
- textarea.tsx:20 same wrapper; :31 min-h-17.5 px-3 py-1.5
- select.tsx:24 trigger border-input bg-background rounded-lg; :155 popup dropdown-glass rounded-lg shadow
- switch.tsx:21 h-[thumb+2] w-[thumb*2-2] rounded-full p-[2px] transition bg/box-shadow 200ms
- tooltip.tsx:46 border bg-popover rounded-md text-xs text-popover-foreground shadow-md/5; :53 px-2 py-1
- table.tsx:10 text-xs; :46 row border-b hover:bg-muted/50; :59 th h-10 px-2 font-medium
- empty.tsx:37 icon size-9 rounded-md border bg-card shadow-sm/5; :92 desc text-sm text-muted-foreground; :105 max-w-sm gap-4
- Deliverables written: t3-tokens.css (515), t3-shell.html (151), 01-sidebar-automations-tab.html (642, generated from shell markup), README-tokens.md. Tag-balance verified; html-validate unavailable offline.
