# T3 Code web app — verbatim UI patterns (supplemental research)

Root: `/Users/irene/Documents/Automation Project/a3 code/apps/web/src`
All className strings below are copied verbatim from source. file:line refs included.

## 1. `components/chat/ChatHeader.tsx` — thread header

Rendered as a *child* of `WorkspacePageHeader` (52px topbar). It is not itself the topbar.

**Root wrapper** — `ChatHeader.tsx:302-305`
```jsx
<div
  className="@container/header-actions flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
  onContextMenu={handleHeaderContextMenu}
>
```

**Breadcrumb** (project → thread title) — `ChatHeader.tsx:306-309`
```jsx
<WorkspaceBreadcrumb
  ariaLabel="Thread breadcrumb"
  className="flex-1 overflow-clip [overflow-clip-margin:2px]"
>
```

**Project crumb button + favicon** — `ChatHeader.tsx:315-339`
```jsx
<WorkspaceBreadcrumbItem className="shrink">
  ...
  <button
    type="button"
    aria-label={`New thread in ${activeProjectName}`}
    onClick={onNewThreadInProject}
    className="inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
  />
  <ProjectFavicon ... className="size-3.5" />
  <span className="max-w-40 truncate">{activeProjectName}</span>
</WorkspaceBreadcrumbItem>
<WorkspaceBreadcrumbSeparator />
```

**Title crumb (current)** — `ChatHeader.tsx:343`
```jsx
<WorkspaceBreadcrumbItem current className="min-w-10 flex-1">
```

**Inline rename input** — `ChatHeader.tsx:345-356`
```jsx
className="min-w-0 flex-1 rounded-sm bg-transparent text-sm font-medium text-foreground outline-none ring-1 ring-ring/50 focus:ring-ring"
```

**Title as menu button + reveal-on-hover chevron** — `ChatHeader.tsx:361-378`
```jsx
<button
  ref={titleButtonRef}
  type="button"
  aria-label={`Thread actions for ${activeThreadTitle}`}
  aria-haspopup="menu"
  onClick={openMenuFromTitle}
  onDoubleClick={handleTitleDoubleClick}
  onBlur={cancelPendingTitleMenu}
  className="group/thread-title inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 rounded-sm text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
/>
<h2 className="min-w-0 truncate">{activeThreadTitle}</h2>
<ChevronDownIcon
  aria-hidden
  data-thread-title-chevron
  className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/thread-title:opacity-100 group-focus-visible/thread-title:opacity-100"
/>
```
Note: the title `<h2>` carries NO font classes — it inherits `text-sm` from
`WorkspaceBreadcrumb`'s `<ol className="... text-sm ...">` and `font-medium` from
`WorkspaceBreadcrumbItem`. Non-interactive fallback title: `className="min-w-0 flex-1 truncate"` (`:386`).

**Right-side action cluster** — `ChatHeader.tsx:396-403`
```jsx
<div
  ref={headerActionsRef}
  data-chat-header-actions
  className={cn(
    "flex shrink-0 items-center justify-end gap-2 @3xl/header-actions:gap-3",
    rightPanelOpen ? "pr-0" : "pr-16",
    "[[data-panel-animations=true]_&]:motion-safe:transition-[padding-right] [[data-panel-animations=true]_&]:motion-safe:[transition-duration:var(--panel-animation-duration)] [[data-panel-animations=true]_&]:motion-safe:ease-out",
  )}
>
```
Children (in order): `<ProjectScriptsControl>`, `<OpenInPicker>`, `<GitActionsControl>`.
`pr-16` reserves room for the floating right-panel toggle when the panel is closed.

**There are no `<Separator>` elements in this header.** Separation is the breadcrumb `/`
(`WorkspaceBreadcrumbSeparator`, `text-icon-muted`) plus `gap-2 / @3xl:gap-3`.

**No `data-toolbar-control` attribute exists in ChatHeader.** The data attributes used are
`data-chat-header-actions` (excludes the action cluster from the header context menu) and
`data-thread-title-chevron`.

## 2a. `components/chat/ComposerControl.tsx` — the pill/chip picker primitive

This is THE component every composer chip (model, reasoning, Build/Plan, Full access) is built
from. Two sizes: `"sm"` = **expanded** (composer focused / desktop), `"xs"` = **resting**.

**Shared base** — `ComposerControl.tsx:19-23` (verbatim string constants)
```ts
const composerControlClassName =
  "rounded-[var(--control-radius)] text-secondary-label transition-none hover:text-foreground [&_svg[data-composer-control-chevron]]:-mx-0.5 [&_svg[data-composer-control-icon]]:mx-0";
const expandedComposerControlClassName = "h-7 min-h-7 gap-1.5 px-2.5";
const restingComposerControlClassName =
  "[--control-icon-color:currentColor] font-normal text-muted-foreground/70 hover:text-foreground/80 [&_svg[data-composer-control-chevron]]:-me-1 [&_svg[data-composer-control-chevron]]:ms-0";
```

**`<ComposerControl>`** — `ComposerControl.tsx:25-43` — a `<Button variant="ghost" size="sm"|"xs">` with:
```js
cn(composerControlClassName, size === "xs" ? restingComposerControlClassName : expandedComposerControlClassName, className)
```
So a resting chip resolves to (Button `xs` base + above):
`h-7 gap-1 px-[calc(--spacing(2)-1px)] text-sm sm:h-6 sm:text-xs` + ghost variant
(`border-transparent text-foreground data-pressed:bg-accent [:hover,[data-pressed]]:bg-accent`)
+ `font-normal text-muted-foreground/70 hover:text-foreground/80`.
An expanded chip is forced to `h-7 min-h-7 gap-1.5 px-2.5`.

**`<ComposerControlIcon>`** — `ComposerControl.tsx:45-67`
```jsx
className={cn("shrink-0", size === "xs" ? "size-3" : opticalSize === "large" ? "size-4.5" : "size-4", className)}
data-composer-control-icon
```

**`<ComposerControlChevron>`** — `ComposerControl.tsx:69-88`
```jsx
className={cn("shrink-0", size === "xs" ? "size-3 text-current opacity-50" : "size-3.5 text-icon-muted", className)}
data-composer-control-chevron
strokeWidth={2.25}
```

**`<ComposerControlSeparator>`** — `ComposerControl.tsx:90-104`
```jsx
<Separator orientation="vertical"
  className={cn("mx-0.5 hidden sm:block", size === "xs" ? "h-3.5!" : "h-4", className)} />
```
(base `Separator`: `shrink-0 bg-border data-[orientation=vertical]:w-px`)

**`<ComposerSelectControl>`** — `ComposerControl.tsx:106-125` — same classes applied to a
`<SelectTrigger variant="ghost">`, with `icon={<ComposerControlChevron size={size} />}`.

## 2b. `components/chat/PanelLayoutControls.tsx` — titlebar toggle cluster

**Cluster wrapper** — `PanelLayoutControls.tsx:36-39`
```jsx
<div
  className="flex h-full shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
  data-panel-layout-controls
>
```

**Each toggle** — `PanelLayoutControls.tsx:43-53` and `:64-77`
```jsx
<Toggle
  className="shrink-0 [-webkit-app-region:no-drag]"
  pressed={terminalOpen}
  onPressedChange={onToggleTerminal}
  aria-label="Toggle terminal drawer"
  variant="ghost"
  size="sm"
  disabled={!terminalAvailable}
>
  <PanelBottomIcon className="size-4" />
</Toggle>
```
Toggle `variant="ghost" size="sm"` resolves to
`h-8 min-w-8 px-[calc(--spacing(1.5)-1px)] sm:h-7 sm:min-w-7` +
`border-transparent text-foreground shadow-none ... data-pressed:bg-accent data-pressed:text-accent-foreground`.
Trigger wrappers are `render={<span className="flex shrink-0" />}`.

**Count badge on a toggle** — `PanelLayoutControls.tsx:79-84`
```jsx
<span
  aria-hidden
  className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-info px-1 text-[9px] font-semibold tabular-nums text-white"
>
```

**`RightPanelMaximizeControl`** — `PanelLayoutControls.tsx:114-121` — identical
`<Toggle className="shrink-0 [-webkit-app-region:no-drag]" variant="ghost" size="sm">` with
`Minimize2Icon` / `Maximize2Icon` at `className="size-4"`.

## 2c. `components/chat/ProviderModelPicker.tsx` — model chip trigger

`ProviderModelPicker.tsx:166-222`
```jsx
<PopoverTrigger
  render={
    <ComposerControl
      aria-label={props.triggerAriaLabel}
      variant={props.triggerVariant ?? "ghost"}
      size={size}
      data-chat-provider-model-picker="true"
      className={cn(
        "min-w-0 justify-between whitespace-nowrap",
        props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56",
        props.triggerClassName,
      )}
      disabled={props.disabled}
    />
  }
>
  <span className={cn("flex min-w-0 flex-1 items-center", size === "xs" ? "gap-1" : "gap-1.5")}>
    <ProviderInstanceIcon ... className="size-4" iconClassName={cn("size-4", ...)}
      indicatorBackground={props.instanceIndicatorBackground ?? "var(--contrast-input)"}
      badgeClassName={cn("right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-[7px]", size === "xs" && "shadow-none")} />
    <Tooltip>
      <TooltipTrigger render={<span className="min-w-0 flex-1 overflow-hidden truncate" data-chat-provider-model-picker-label="true" />}>
        {triggerTitle}
      </TooltipTrigger>
      <TooltipPopup side="top">{triggerLabel}</TooltipPopup>
    </Tooltip>
    {selectedModel?.isUnavailable ? <Badge variant="outline" size="sm">Unavailable</Badge> : null}
  </span>
  <span aria-hidden="true" className="flex items-center">
    <ComposerControlChevron size={size} />
  </span>
</PopoverTrigger>
```

**Its popup** — `ProviderModelPicker.tsx:223-228`
```jsx
<PopoverPopup
  align="start"
  className="before:hidden [--viewport-inline-padding:0]"
  viewportClassName="overflow-hidden! rounded-[calc(var(--radius-lg)-1px)] p-0 [clip-path:inset(0_round_calc(var(--radius-lg)-1px))]"
>
```

Shape to copy for a mockup chip: `[icon size-4] [truncating label] [chevron]`, inside a
ghost button with `h-7 px-2.5 gap-1.5 rounded-[var(--control-radius)] text-secondary-label`,
capped at `max-w-48 sm:max-w-56`.

## 2d. `components/chat/ModelListRow.tsx` — two-line list row inside a picker popup

Excellent template for an "automation" list row inside a dropdown.

**Row** — `ModelListRow.tsx:49-61`
```jsx
<ComboboxItem
  hideIndicator
  index={props.index}
  value={modelPickerModelKey(props.instanceId, props.model.slug)}
  disabled={Boolean(props.disabledReason)}
  contentClassName="flex w-full items-center gap-3"
  className={cn(
    "group relative w-full !min-w-0 max-w-full cursor-pointer rounded-md px-2 py-2 transition-[background-color,box-shadow,color]",
    "hover:bg-[color-mix(in_srgb,var(--popover)_90%,var(--contrast-foreground))] data-highlighted:bg-[color-mix(in_srgb,var(--popover)_90%,var(--contrast-foreground))] data-selected:bg-foreground/[0.08] data-selected:text-foreground data-selected:ring-0 [&[data-highlighted][data-selected]]:bg-[color-mix(in_srgb,var(--popover)_90%,var(--contrast-foreground))]",
    props.disabledReason &&
      "data-disabled:pointer-events-auto data-disabled:cursor-not-allowed data-disabled:hover:bg-transparent",
  )}
>
```

**Primary line** — `ModelListRow.tsx:62-71`
```jsx
<div className="min-w-0 flex-1 text-left">
  <div className="flex min-w-0 items-center gap-2">
    <div className="min-w-0 truncate text-xs font-medium leading-snug">…</div>
```

**"New" pill** — `ModelListRow.tsx:73-78`
```jsx
<span
  className="shrink-0 rounded border border-update/35 bg-update/15 px-0.5 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-update-foreground"
  aria-label="New model"
>
  New
</span>
```

**Secondary line (icon + muted label)** — `ModelListRow.tsx:87-92`
```jsx
<div className="mt-1 flex items-center gap-1.5">
  {ProviderIcon ? <ProviderIcon className="size-3 shrink-0" /> : null}
  <span className="truncate text-xs font-normal leading-snug text-muted-foreground/70">{providerLabel}</span>
</div>
```

**Right slot (kbd hint + hover-revealed icon button)** — `ModelListRow.tsx:96-126`
```jsx
<div className="flex shrink-0 items-center gap-1.5">
  <Kbd className="h-4 min-w-0 rounded-sm px-1.5 text-[10px]">{props.jumpLabel}</Kbd>
  <Button
    size="icon-xs"
    variant="ghost"
    className={cn(
      "-mr-1 shrink-0 text-muted-foreground/70 opacity-64 transition-[color,opacity] hover:text-foreground hover:opacity-100 group-hover:opacity-100",
      props.isFavorite && "text-foreground opacity-100",
    )}
  >
    <StarIcon className={cn("size-3.5 sm:size-3", props.isFavorite && "fill-current text-yellow-500")} />
  </Button>
</div>
```

## 2e. `components/chat/ComposerPrimaryActions.tsx` — the send button

**Circular send button** — `ComposerPrimaryActions.tsx:222-271`
```jsx
<button
  type="submit"
  className={cn(
    "relative isolate flex h-9 w-9 items-center justify-center overflow-hidden rounded-full shadow-xs transition-all duration-150 enabled:cursor-pointer enabled:inset-shadow-[0_1px_--theme(--color-white/16%)] hover:scale-105 active:inset-shadow-[0_1px_--theme(--color-black/8%)] active:shadow-none disabled:pointer-events-none disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100 sm:h-8 sm:w-8",
    stageBackdropVariant
      ? "bg-transparent text-white enabled:shadow-black/24 enabled:hover:brightness-110"
      : "bg-message-action text-message-action-foreground enabled:shadow-message-action/24 hover:bg-message-action-hover",
  )}
>
  {/* busy */}  <Spinner className="size-3.5" aria-hidden="true" />
  {/* idle */}
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</button>
```
Key: **36px round on mobile, 32px on `sm:`**, filled `bg-message-action` /
`text-message-action-foreground`, hover `bg-message-action-hover`, `hover:scale-105`,
disabled `opacity-30`. Hand-drawn 14×14 up-arrow SVG, not a lucide icon.

**Text-label pill variants (Refine / Implement)** — `ComposerPrimaryActions.tsx:168-179`
```jsx
<Button type="submit" size="sm"
  className={cn(
    "rounded-full bg-message-action text-message-action-foreground hover:bg-message-action-hover",
    compact ? "h-9 px-3 sm:h-8" : "h-9 px-4 sm:h-8",
  )}>
```

**Split button (primary + chevron menu)** — `ComposerPrimaryActions.tsx:184-208`
```jsx
<div data-chat-composer-implement-actions="true" className="flex items-center justify-end">
  <Button type="submit" size="sm"
    className="h-9 rounded-l-full rounded-r-none bg-message-action px-4 text-message-action-foreground hover:bg-message-action-hover sm:h-8">
    Implement
  </Button>
  <Button size="sm" variant="default"
    className="h-9 rounded-l-none rounded-r-full border-l-message-action-foreground/20 bg-message-action px-2 text-message-action-foreground hover:bg-message-action-hover sm:h-8"
    aria-label="Implementation actions">
    <ChevronDownIcon className="size-3.5" />
  </Button>
</div>
```

## 2f. Composer footer — `components/chat/ChatComposer.tsx`

**Footer bar** — `ChatComposer.tsx:5320-5332`
```jsx
<div
  data-chat-composer-footer="true"
  data-chat-composer-footer-compact={isComposerFooterCompact ? "true" : "false"}
  className={cn(
    "flex min-w-0 flex-nowrap items-center justify-between gap-2 overflow-visible px-3 pb-3 sm:px-4 sm:pb-4",
    pendingUserInputs.length > 0 && "pt-2",
    isComposerFooterCompact ? "gap-1.5" : "gap-2 sm:gap-0",
    showMobilePendingAnswerActions && "hidden sm:flex",
    isComposerResting &&
      "absolute bottom-px right-px z-10 h-12 w-auto gap-0 py-0 sm:gap-0 sm:py-0",
  )}
>
```

**Left control strip (chips scroll horizontally, scrollbar hidden)** — `ChatComposer.tsx:5333-5343`
```jsx
<div
  ref={composerFooterControlsRef}
  data-chat-composer-controls="left"
  data-chat-composer-footer-controls="true"
  className={cn(
    "-m-1 -ms-3.5 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto p-1 ps-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    isComposerResting && "hidden",
  )}
>
```

**Right actions cluster** — `ChatComposer.tsx:5346-5353`
```jsx
<div
  data-chat-composer-actions="right"
  data-chat-composer-transition-actions="true"
  data-chat-composer-primary-actions-compact={isComposerPrimaryActionsCompact ? "true" : "false"}
  className="flex shrink-0 flex-nowrap items-center justify-end gap-2"
>
```
Attach button in that cluster — `ChatComposer.tsx:5371-5382`:
`<Button type="button" variant="ghost" size="icon-sm" aria-label="Attach files"><PaperclipIcon /></Button>`

**Chip order in the left strip** (`composerControls`, `ChatComposer.tsx:3755+`):
`ProviderModelPicker` → traits/reasoning block → `ComposerFooterModeControls`
(runtime-mode select + Build/Plan toggle). Chips are separated by
`<ComposerControlSeparator />`, and each "resting block" is wrapped in
`className="flex w-max min-w-max shrink-0 items-center gap-1"` (`ChatComposer.tsx:3836-3840`).

**Model picker trigger override in footer** — `ChatComposer.tsx:3789-3793`
```jsx
triggerClassName={
  composerControlsInStrip
    ? "min-w-13 shrink text-xs! @max-[640px]/composer-surface:[&_[data-chat-provider-model-picker-label]]:w-0 @max-[640px]/composer-surface:[&_[data-chat-provider-model-picker-label]]:flex-none"
    : "-ms-2.5"
}
```

**No-provider fallback chip** — `ChatComposer.tsx:3756-3771`
```jsx
<Button type="button" size="sm" variant="ghost" data-chat-provider-unavailable="true"
  className="shrink-0 gap-2 px-2 text-secondary-label sm:px-3">
  <CircleAlertIcon className="size-4" />
  {providerSetupInstanceId ? "Open provider settings" : "No provider available"}
</Button>
```

### `ComposerFooterModeControls` — Build/Plan toggle + "Full access" select
`ChatComposer.tsx:901-1006`

Runtime-mode labels/icons — `ChatComposer.tsx:806-828`:
| value | label | icon |
|---|---|---|
| `approval-required` | **Supervised** | `LockIcon` |
| `auto-accept-edits` | **Auto-accept edits** | `PenLineIcon` |
| `auto` | **Auto** | `SparklesIcon` |
| `full-access` | **Full access** | `LockOpenIcon` |

**Build/Plan toggle** — `ChatComposer.tsx:920-956`
```jsx
<ComposerControlSeparator size={size} />
<ComposerControl
  size={size}
  className={cn(
    "shrink-0 whitespace-nowrap",
    props.interactionMode === "plan"
      ? "bg-accent text-accent-foreground hover:bg-accent/80"
      : size === "xs"
        ? undefined
        : "text-secondary-label hover:text-foreground",
  )}
  type="button"
  onClick={props.onToggleInteractionMode}
  aria-label={interactionModeTooltip}
/>
  <ComposerControlIcon icon={PencilRulerIcon} size={size} className="text-current opacity-100" />   {/* plan */}
  <ComposerControlIcon icon={BotIcon} size={size} opticalSize={size === "xs" ? "default" : "large"} /> {/* build */}
  <span className="sr-only sm:not-sr-only">{props.interactionMode === "plan" ? "Plan" : "Build"}</span>
```
So the "on" state of a toggle chip = `bg-accent text-accent-foreground hover:bg-accent/80`.

**Runtime-mode select chip** — `ChatComposer.tsx:965-982`
```jsx
<ComposerSelectControl
  size={size}
  className={size === "xs" ? undefined : "font-medium"}
  aria-label="Runtime mode"
>
  <ComposerControlIcon icon={RuntimeModeIcon} size={size} />
  <SelectValue>{runtimeModeOption.label}</SelectValue>
</ComposerSelectControl>
```

**Its two-line select items** — `ChatComposer.tsx:987-1000`
```jsx
<SelectItem key={mode} value={mode} hideIndicator className="min-w-64 py-2">
  <div className="flex min-w-0 items-center gap-3">
    <div className="grid min-w-0 flex-1 gap-0.5">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <OptionIcon className="size-3.5 shrink-0 text-muted-foreground" />
        {option.label}
      </span>
      <span className="text-muted-foreground text-xs leading-4">{option.description}</span>
    </div>
  </div>
</SelectItem>
```

## 3a. `components/ui/alert-dialog.tsx`

- **Backdrop** — `:26` `cn(DIALOG_BACKDROP_CLASS, className)`
  (`DIALOG_BACKDROP_CLASS` = `"dialog-backdrop fixed inset-0 z-50 transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"`)
- **Viewport** — `:36-39`
  ```
  "fixed inset-0 z-50 grid grid-rows-[1fr_auto_1fr] justify-items-center p-4"
  ```
  with `bottomStickOnMobile` adding (`:59`) `"max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12"`
- **Popup** — `:62-66`
  ```js
  cn(DIALOG_POPUP_CLASS, "row-start-2 max-h-full max-w-lg text-popover-foreground", bottomStickOnMobile && DIALOG_MOBILE_SHEET_CLASS, className)
  ```
- **Header** — `:79` `"flex flex-col gap-2 p-6 text-center max-sm:pb-4 sm:text-left"`
- **Footer** — `:95-99`
  ```js
  cn(
    "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]",
    variant === "default" && "border-t bg-muted/72 py-4",
    variant === "bare" && "pb-6",
  )
  ```
- **Title** — `:110` `"font-heading font-semibold text-xl leading-none"`
- **Description** — `:120` `"text-muted-foreground text-sm"`

## 3b. `components/ui/sheet.tsx`

- **Backdrop** — `:25-27`
  ```
  "fixed inset-0 z-50 bg-background/60 backdrop-blur-xs transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"
  ```
- **Viewport** — `:45-52`
  ```js
  cn("fixed inset-0 z-50 grid",
    side === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
    side === "top" && "grid grid-rows-[auto_1fr] pb-12",
    side === "left" && "flex justify-start",
    side === "right" && "flex justify-end",
    variant === "inset" && "sm:p-4")
  ```
- **Popup base** — `:93`
  ```
  "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)]"
  ```
  side=right — `:104-105`
  ```
  "col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8"
  ```
  variant=inset — `:106-107`
  ```
  "before:hidden sm:rounded-2xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]"
  ```
- **Close button** — `:118-122` `className="absolute end-2 top-2"` on `<Button size="icon" variant="ghost">` with `<XIcon />`
- **Header** — `:131-134`
  ```
  "flex flex-col gap-2 p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pb-3 max-sm:pb-4"
  ```
- **Footer** — `:150-156`
  ```js
  cn("flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end",
     variant === "default" && "border-t bg-muted/72 py-4",
     variant === "bare" && "in-[[data-slot=sheet-popup]:has([data-slot=sheet-panel])]:pt-3 pt-4 pb-6")
  ```
- **Title** — `:170` `"font-heading font-semibold text-xl leading-none"`
- **Description** — `:180` `"text-muted-foreground text-sm"`
- **Panel (scroll body)** — `:194-197`
  ```
  "p-6 in-[[data-slot=sheet-popup]:has([data-slot=sheet-header])]:pt-1 in-[[data-slot=sheet-popup]:has([data-slot=sheet-footer]:not(.border-t))]:pb-1"
  ```

## 3c. `components/ui/number-field.tsx`

Usage shape (see `settings/SourceControlSettings.tsx:398-417`):
```jsx
<NumberField value={n} min={0} step={5} size="sm" className="w-32" onValueChange={...}>
  <NumberFieldGroup>
    <NumberFieldDecrement aria-label="Decrease fetch interval" />
    <NumberFieldInput aria-label="Automatic Git fetch interval in seconds" />
    <NumberFieldIncrement aria-label="Increase fetch interval" />
  </NumberFieldGroup>
</NumberField>
<span className="text-xs text-muted-foreground">seconds</span>
```

- **Root** — `:30` `"flex w-full flex-col items-start gap-2"` (+ `data-size`)
- **Group (the bordered box)** — `:47`
  ```
  "relative flex w-full justify-between rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/48 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-within,[aria-invalid]]:shadow-none"
  ```
- **Decrement** — `:63` (renders `<MinusIcon />`)
  ```
  "relative flex shrink-0 cursor-pointer items-center justify-center rounded-s-[calc(var(--radius-lg)-1px)] in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent"
  ```
- **Increment** — `:81` (same, `rounded-e-…`, renders `<PlusIcon />`)
- **Input** — `:99`
  ```
  "h-8.5 in-data-[size=lg]:h-9.5 in-data-[size=sm]:h-7.5 w-full min-w-0 grow bg-transparent in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] text-center tabular-nums in-data-[size=lg]:leading-9.5 in-data-[size=sm]:leading-7.5 leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] sm:h-7.5 sm:in-data-[size=lg]:h-8.5 sm:in-data-[size=sm]:h-6.5 sm:in-data-[size=lg]:leading-8.5 sm:in-data-[size=sm]:leading-8.5 sm:leading-7.5"
  ```
- **ScrubArea** — `:125` `"flex cursor-ew-resize"`

## 3d. `components/ui/toast.tsx` — root / title / description / action

**Viewport** — `toast.tsx:561-571`
```js
cn(
  "fixed z-100 mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-header-offset:52px] [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
  "data-[position*=top]:top-[calc(var(--toast-inset)+var(--toast-header-offset))]",
  "data-[position*=bottom]:bottom-(--toast-inset)",
  "data-[position*=left]:left-(--toast-inset)",
  "data-[position*=right]:right-(--toast-inset)",
  "data-[position*=center]:-translate-x-1/2 data-[position*=center]:left-1/2",
)
```

**Root — the visual card** (first line only; the rest is stack transform math) — `toast.tsx:589`
```
"dropdown-glass absolute z-[calc(9999-var(--toast-index))] w-full overflow-visible select-none rounded-lg text-popover-foreground shadow-xl shadow-black/25 [transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s]"
```
(`dropdown-glass` is the custom utility in `index.css`: translucent `--popover` +
`backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation))` +
`border: 1px solid color-mix(in srgb, var(--contrast-foreground) 10%, transparent)`.)

**Content** — `toast.tsx:678-686`
```js
cn(
  "pointer-events-auto min-h-0 overflow-y-visible pl-3.5 text-sm transition-opacity duration-250 [overflow-x:clip] data-expanded:opacity-100",
  stackedActionLayout
    ? "flex flex-col gap-2 py-2.5 pr-3.5"
    : cn("py-3", "flex items-center justify-between gap-1.5", inlineContentEndPad),
  hideCollapsedContent && "not-data-expanded:pointer-events-none not-data-expanded:opacity-0",
)
```

**Body wrapper / text column** — `toast.tsx:347` and `:363-367`
```jsx
<div className={cn("flex min-w-0 gap-2", !stackedActionLayout && "flex-1")}>
  <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-0.5", stackedActionLayout && "pr-5")}>
```

**Title** — `toast.tsx:369`
```jsx
<Toast.Title className="min-w-0 wrap-break-word font-medium" data-slot="toast-title" />
```

**Description** — `toast.tsx:191-194`
```js
const descriptionClassName = cn(
  "min-w-0 select-text wrap-break-word text-muted-foreground",
  errorDescriptionClampClass(toastType, toastDescription),
);
```

**Leading type icon** — `toast.tsx:356-361`
```jsx
<div className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0" data-slot="toast-icon">
  <Icon className="in-data-[type=loading]:animate-spin in-data-[type=error]:text-destructive in-data-[type=info]:text-info in-data-[type=success]:text-success in-data-[type=warning]:text-warning in-data-[type=loading]:opacity-80" />
</div>
```
**Status color roles: `text-destructive` / `text-info` / `text-success` / `text-warning`.**

**Action** — `toast.tsx:405-410`
```jsx
<Toast.Action
  className={cn(buttonVariants({ size: "xs", variant: actionVariant }), "shrink-0")}
  data-slot="toast-action"
>
```
Secondary/extra actions are `<Button size="xs" variant={secondaryActionVariant} />`,
in a row `cn("flex items-center gap-1.5", stackedActionLayout ? "w-full justify-end" : "shrink-0")` (`:377-380`).

**Corner dismiss orb** — `toast.tsx:104-109`
```js
const toastCornerDismissClass = "absolute z-20 -top-1.5 -right-1.5";
const toastCornerOrbClass = cn(
  "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-popover/92 text-muted-foreground shadow-sm outline-none backdrop-blur-sm",
  "transition-[color,background-color,box-shadow] hover:bg-popover hover:text-foreground",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
);
```
Its icon: `<XIcon className="size-3" strokeWidth={2.25} />`.

## 3e. `components/ui/radio-group.tsx`

- **RadioGroup** — `:11` `"flex flex-col gap-3"`
- **Radio root** — `:22`
  ```
  "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border border-input bg-background not-dark:bg-clip-padding shadow-xs/5 outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/48 data-disabled:opacity-64 sm:size-4 dark:not-data-checked:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [[data-disabled],[data-checked],[aria-invalid]]:shadow-none"
  ```
- **Indicator** — `:29`
  ```
  "-inset-px absolute flex size-4.5 items-center justify-center rounded-full before:size-2 before:rounded-full before:bg-primary-foreground data-unchecked:hidden data-checked:bg-primary sm:size-4 sm:before:size-1.5"
  ```
Radio is **18px mobile / 16px desktop**, checked fill = `bg-primary` with a `bg-primary-foreground` dot.

## 3f. `components/ui/combobox.tsx` (trigger + item)

- **`ComboboxTrigger`** — `:133-139` — **carries no classes of its own**; it forwards
  `className` verbatim. Call sites `render={...}` another styled control into it, e.g.
  `Sidebar.tsx:3621-3627` renders a `<SidebarMenuButton className="min-w-0 flex-1 ps-[calc(var(--sidebar-row-content-inset)-1px)] focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar" />`.
- **Popup shell** — `:172`
  ```
  "dropdown-glass relative flex max-h-full min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-lg shadow-[0_16px_40px_-18px_rgb(0_0_0/55%)] transition-[scale,opacity] dark:shadow-[0_18px_44px_-18px_rgb(0_0_0/80%)]"
  ```
  inner popup — `:178` `"flex min-w-0 max-h-[min(var(--available-height),23rem)] flex-1 flex-col overflow-hidden text-foreground"`
- **Item** — `:201`
  ```
  "flex min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-pointer items-center rounded-sm px-2 py-1 text-base outline-none hover:bg-accent data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-selected:bg-foreground/[0.08] data-selected:text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground [&[data-highlighted][data-selected]]:bg-accent [&[data-highlighted][data-selected]]:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
  ```
  item content wrapper — `:209-212` `cn("min-w-0 flex-1 [&_svg:not([class*='text-'])]:text-muted-foreground", contentClassName)`
- **Separator** — `:224` `"mx-2 my-1 h-px bg-border last:hidden"`
- **Group** — `:234` `"[[role=group]+&]:mt-1.5"`
- **GroupLabel** — `:245` `"px-2 py-1.5 font-medium text-muted-foreground text-xs"`
- **Empty** — `:255-258` `"not-empty:p-2 text-center text-base text-muted-foreground sm:text-sm"`
- **List** — `:276` `"not-empty:scroll-py-1 not-empty:px-1 not-empty:py-1"` inside `<ScrollArea scrollbarGutter scrollFade>`

## 3g. `components/ui/autocomplete.tsx` (item + group label)

- **Item** — `autocomplete.tsx` `AutocompleteItem`
  ```
  "flex min-h-8 cursor-default select-none items-center rounded-sm px-2 py-1 text-base outline-none hover:bg-accent data-disabled:pointer-events-none data-selected:bg-accent/50 data-selected:text-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground [&[data-highlighted][data-selected]]:bg-accent [&[data-highlighted][data-selected]]:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='text-'])]:text-muted-foreground"
  ```
- **GroupLabel** — `AutocompleteGroupLabel`
  ```
  "px-2 py-1.5 font-medium text-muted-foreground text-xs"
  ```
Both are the base for the command palette (`ui/command.tsx` `CommandItem` adds
`"py-1.5 data-selected:bg-foreground/[0.06] data-highlighted:bg-foreground/[0.09] …"`).

## 4. `components/settings/SettingsPanels.tsx` — how settings pages compose

Page shell is always:
```jsx
<SettingsPageContainer>          {/* topbar-scroll-fade scrollbar-gutter-both flex-1 overflow-y-auto + WorkspacePageContainer gap-12 */}
  <SettingsSection title="General"> {/* space-y-3, h2 + space-y-1 body */}
    <SettingsRow ... />            {/* rounded-xl px-3 sm:px-4 py-3 */}
  </SettingsSection>
</SettingsPageContainer>
```
`SettingsSection`/`SettingsRow` come from `settingsLayout.tsx`. **There are no borders between
rows** — rows are separated by whitespace only (`space-y-1` on the section body) and each row
is a `rounded-xl` hover target. Section gap is `gap-12` (from `SettingsPageContainer`).

### 4a. Switch row (the most common) — `SettingsPanels.tsx:2070-2103`
```jsx
<SettingsRow
  {...searchableSetting("project-grouping")}
  description="Combine matching repositories across environments."
  resetAction={
    settings.sidebarProjectGroupingMode !== DEFAULT_UNIFIED_SETTINGS.sidebarProjectGroupingMode ? (
      <SettingResetButton label="project grouping" onClick={() => updateSettings({ ... })} />
    ) : null
  }
  control={
    <Switch
      checked={isProjectGroupingEnabled(settings.sidebarProjectGroupingMode)}
      onCheckedChange={(checked) => { ... }}
      aria-label="Project grouping"
    />
  }
/>
```
(`searchableSetting(id)` spreads `{ id, title }`.)

### 4b. Select row — `SettingsPanels.tsx:2249-2272`
```jsx
<SettingsRow
  {...searchableSetting("diff-layout")}
  description="Show diffs stacked or side by side. The toggle in the diff toolbar changes this too."
  resetAction={... <SettingResetButton label="diff layout" onClick={...} /> ...}
  control={
    <Select value={settings.diffLayout} onValueChange={(value) => { ... }}>
      <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Diff layout">
        <SelectValue>{DIFF_LAYOUT_LABELS[settings.diffLayout]}</SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}> … </SelectPopup>
    </Select>
  }
/>
```
**Canonical control sizing in a settings row: `size="sm"`, width `className="w-full sm:w-40"`.**

### 4c. Input control — `SettingsPanels.tsx:1832-1837`
```jsx
<Input
  size="sm"
  type="number"
  min={MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
  max={MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
  className="w-full sm:w-24"
  value={draft}
  ...
/>
```

### 4d. Row with expanded child content — `SettingsPanels.tsx:1803-1811`
```jsx
<SettingsRow title={title} description={description} resetAction={resetAction} control={control}>
  {preview}
</SettingsRow>
```
When `children` are present, `SettingsRow` swaps its padding to `pt-3 pb-1` (settingsLayout.tsx:238).

### 4e. Danger / destructive pattern — `settings/ProjectSettingsPanel.tsx:1239-1259`
There is **no special card**: a normal `SettingsSection title="Danger"` whose row's `control`
is a destructive-outline button.
```jsx
<SettingsSection title="Danger">
  <SettingsRow
    title={group.memberProjects.length > 1 ? "Remove this project everywhere" : "Remove project"}
    description="Deletes the project entry and its threads. Files on disk are not touched."
    control={
      <Button size="sm" variant="destructive-outline" onClick={() => void removeMembers(group.memberProjects)}>
        <Trash2Icon />
        {group.memberProjects.length > 1 ? "Remove all entries" : "Remove project"}
      </Button>
    }
  />
</SettingsSection>
```
`variant="destructive-outline"` (button.tsx:43-44) =
```
"border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none [:hover,[data-pressed]]:border-destructive/32 [:hover,[data-pressed]]:bg-destructive/4"
```

**Warning-tone row** — `ProjectSettingsPanel.tsx:1231-1235`: `<SettingsRow ... className="text-warning" />`.

**Inline destructive callout blocks** used elsewhere:
- `ConnectionsSettings.tsx:2628` — `"rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"`
- `ThemeSearchSection.tsx:352` — `"rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"`
- `ResourceTelemetryDiagnostics.tsx:1064` — `"flex items-start gap-2 border-t border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive sm:px-5"`

**Bordered "card with divided rows"** (used inside dialogs, not on settings pages) —
`SettingsPanels.tsx:801-802`
```jsx
<div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
  <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
```
Last row omits `border-b`.

## 5. `components/ProjectFavicon.tsx` + `projectIconColors.ts`

**Not a letter avatar and not a colored square.** A project icon is a bare **lucide glyph
tinted with a Tailwind text color**, or an emoji, or a real favicon `<img>`. Default box is
**14px (`size-3.5`)**; call sites override with `className="size-4"` / `"size-3"` etc.

Resolution order (`ProjectFavicon.tsx:108-165`):
1. `projectIcon.kind === "emoji"` → emoji span
2. `projectIcon.kind === "lucide"` → `DynamicIcon` tinted by `projectIconColorClassName(color)`
3. real favicon image, if the asset resolved and isn't the fallback URL
4. automatic icon from `selectProjectIcon(projectName, cwd)` (lucide or emoji)

**Lucide override wrapper** — `ProjectFavicon.tsx:113-127`
```jsx
const iconClassName = cn(
  "inline-flex size-3.5 shrink-0 items-center justify-center",
  colorClassName,
  input.className,
);
<span aria-hidden="true" className={iconClassName}>
  <Suspense fallback={<DynamicProjectIconFallback />}>
    <DynamicIcon name={...} className={cn("size-full", colorClassName)} fallback={DynamicProjectIconFallback} />
  </Suspense>
</span>
```
Suspense/parse fallback — `:44` `<FolderCodeIcon className="size-full text-[inherit]" />`

**Emoji fallback** — `ProjectFavicon.tsx:193-201`
```jsx
<span aria-hidden="true"
  className={cn("inline-flex size-3.5 shrink-0 items-center justify-center leading-none [container-type:size]", className)}>
  <span className="text-[length:80cqh] leading-none">{emoji}</span>
</span>
```
(emoji scales to 80% of the container height via container query units)

**Plain icon fallback** — `ProjectFavicon.tsx:206`
```jsx
<Icon className={cn("size-3.5 shrink-0 text-icon-muted", colorClassName, className)} />
```
Default tint when no color assigned: **`text-icon-muted`**.

**Favicon image** — `ProjectFavicon.tsx:249`
```jsx
<img src={displayedSrc} alt="" className={cn("size-3.5 shrink-0 rounded-sm object-contain", className)} />
```

**Automatic icon → color map** — `ProjectFavicon.tsx:72-95`
`ai:violet, book:amber, braces:purple, circuit:teal, cloud:sky, code:blue, database:cyan,
desktop:indigo, folder-code:orange, game:emerald, image:pink, layers:fuchsia, mobile:lime,
music:fuchsia, package:orange, security:teal, server:blue, shopping:rose, terminal:green,
test:yellow, video:red, web:sky`

**Color classes** — `projectIconColors.ts:9-116` — every entry is exactly:
```
className:       "text-<hue>-600 dark:text-<hue>-400"
swatchClassName: "bg-<hue>-500"
```
for hues: `gray, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue,
indigo, violet, purple, fuchsia, pink, rose`.
Helper: `projectIconColorClassName(color)` (`:123-125`).

**This `text-<hue>-600 dark:text-<hue>-400` pair is the app's standard accent-tint formula** —
reuse it for automation-type icons.

## 6. `components/ThreadStatusIndicators.tsx` — status dot / working / done

### The status pill table (source of truth) — `components/Sidebar.logic.ts:705-790`
`resolveThreadStatusPill()` returns `{ label, colorClass, dotClass, pulse }`:

| label | colorClass | dotClass | pulse |
|---|---|---|---|
| Pending Approval | `text-amber-600 dark:text-amber-300/90` | `bg-amber-500 dark:bg-amber-300/90` | false |
| Awaiting Input | `text-indigo-600 dark:text-indigo-300/90` | `bg-indigo-500 dark:bg-indigo-300/90` | false |
| Working | `text-sky-600 dark:text-sky-300/80` | `bg-sky-500 dark:bg-sky-300/80` | **true** |
| Connecting | `text-sky-600 dark:text-sky-300/80` | `bg-sky-500 dark:bg-sky-300/80` | **true** |
| Plan Ready | `text-violet-600 dark:text-violet-300/90` | `bg-violet-500 dark:bg-violet-300/90` | false |
| Monitoring | `text-sky-600 dark:text-sky-300/80` | `bg-sky-500 dark:bg-sky-300/80` | false |
| Completed | `text-emerald-600 dark:text-emerald-300/90` | `bg-emerald-500 dark:bg-emerald-300/90` | false |
| (none) | `null` — no pill rendered | | |

### `ThreadStatusLabel` — `ThreadStatusIndicators.tsx:473-520`
**Compact (dot only)** — `:484-495`
```jsx
<span
  aria-label={status.label}
  className={`inline-flex size-3.5 shrink-0 items-center justify-center ${status.colorClass}`}
/>
  <span className={`size-[9px] rounded-full ${status.dotClass} ${status.pulse ? "animate-status-pulse" : ""}`} />
```

**Full (dot + label)** — `:504-517`
```jsx
<span aria-label={status.label} className={`inline-flex items-center gap-1 text-[10px] ${status.colorClass}`} />
  <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass} ${status.pulse ? "animate-status-pulse" : ""}`} />
  <span className="hidden md:inline">{status.label}</span>
```
So: **9px dot when alone, 6px dot + `text-[10px]` label when paired.**
`animate-status-pulse` = `status-pulse 2s infinite` (stepped opacity 1 → 0.5, defined in `index.css`).

### PR state colors — `ThreadStatusIndicators.tsx:118 / 128 / 138`
```
open   → "text-emerald-600 dark:text-emerald-300/90"
closed → "text-red-600 dark:text-red-300/90"
merged → "text-violet-600 dark:text-violet-300/90"
```
Hover-only variant for settled rows — `:90-94`
```
"group-hover/v2-row:text-emerald-600 dark:group-hover/v2-row:text-emerald-300/90"   (open)
"group-hover/v2-row:text-violet-600 dark:group-hover/v2-row:text-violet-300/90"     (merged)
"group-hover/v2-row:text-red-600 dark:group-hover/v2-row:text-red-300/90"           (closed)
```

### Terminal-running indicator — `ThreadStatusIndicators.tsx:426-436`
```js
{ label: "Terminal process running", colorClass: "text-teal-600 dark:text-teal-300/90", pulse: true }
```
rendered `:637` as `<TerminalIcon className={`size-3 ${terminalStatus.pulse ? "animate-status-pulse" : ""}`} />`

### Worktree indicator — `ThreadStatusIndicators.tsx:466`
```jsx
<FolderGit2Icon className="size-3 text-muted-foreground/40" />
```

### Semantic-token variant (`components/AgentsPanel.tsx:39-50`)
For a fresh surface, this is the more portable palette — it uses roles, not hues:
```js
pending / running / waiting → { dotClass: "bg-info",                  label: "Working" }
idle                        → { dotClass: "bg-muted-foreground/50",   label: "Idle · resumable" }
completed                   → { dotClass: "bg-success",               label: "Completed" }
failed                      → { dotClass: "bg-destructive",           label: "Failed" }
cancelled / interrupted     → { dotClass: "bg-muted-foreground/60",   label: "Stopped" }
```

### Connection dot — `components/ConnectionStatusDot.tsx:47`
```jsx
<span className={cn("relative inline-flex size-2 rounded-full", dotClassName)} />
```

## 7. `font-heading` — verdict: **the token does NOT exist**

`grep -rn "font-heading" apps/web/src` → exactly 4 hits, all four the same string:
```
src/components/ui/alert-dialog.tsx:110   cn("font-heading font-semibold text-xl leading-none", className)
src/components/ui/dialog.tsx:131         cn("font-heading font-semibold text-xl leading-none", className)
src/components/ui/sheet.tsx:170          cn("font-heading font-semibold text-xl leading-none", className)
src/components/ui/empty.tsx:81           cn("font-heading font-semibold text-xl", className)
```
`grep -rn -- "--font-heading" apps packages native` (excluding node_modules) → **zero hits.**

`apps/web/src/index.css` declares only two font tokens (`index.css:140-143`):
```css
@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono:
    ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
}
```
plus a runtime-only `--font-composer` set by `appearanceFonts.ts` (`applyAppearanceFontVariables`,
which writes `--font-sans`, `--font-mono`, `--font-composer` and never `--font-heading`).

**Conclusion:** Tailwind v4 generates `font-heading` only from a `--font-heading` theme key, so
`font-heading` is a **dead class** — those four titles render in `--font-sans` like everything
else. For mockups: **use the system sans stack everywhere; there is no separate display face.**
Dialog/sheet/empty titles are just `font-semibold text-xl leading-none`.

---

# Summary of conventions

## Typography
- **No heading font.** Everything is `--font-sans` (system stack). `font-heading` is dead.
- Page title (breadcrumb `<h1>/<h2>`): inherits `text-sm font-medium` from
  `WorkspaceBreadcrumb`'s `<ol className="... text-sm ...">` + `WorkspaceBreadcrumbItem`'s
  `font-medium`. Topbar titles are **14px**, not large.
- Settings section title: `text-lg font-semibold tracking-[-0.025em] text-foreground`.
- Dialog / sheet / empty-state title: `font-semibold text-xl leading-none`.
- Settings row title: `text-sm font-medium tracking-[-0.005em] text-foreground`.
- Settings row description: `text-[13px] leading-[1.45] text-muted-foreground/80` (the only
  place 13px is used, 11 occurrences repo-wide).
- List-row title (PR row, thread row): `text-sm font-medium text-foreground`.
- List-row metadata: `text-xs text-muted-foreground/70`.
- Group / section headers above lists: `text-xs font-medium text-muted-foreground/70`.
- Micro labels, chart axes, status labels, badges: `text-[10px]` or `text-[11px]`.
- **Body size is 14px (`text-sm`) for rows and controls; 12px (`text-xs`) for metadata.**
  Counts: `text-xs` 429, `text-sm` 239, `text-[11px]` 106, `text-[10px]` 82, `text-[13px]` 11.
- Any number that updates or aligns in a column gets `tabular-nums` (127 uses).

## Control sizes
- Topbar height: `var(--workspace-topbar-height)` = **52px**. Titlebar controls
  `var(--workspace-titlebar-control-size)` = **1.75rem / 28px**.
- Button sizes: `default` = h-9 / sm:h-8 · `sm` = h-8 / sm:h-7 · `xs` = h-7 / sm:h-6 ·
  `compact` = h-7 · `micro` = h-5. Icon: `icon` = 9/8, `icon-sm` = 8/7, `icon-xs` = 7/6,
  `icon-micro` = 5.
- Settings rows use `size="sm"` controls with `className="w-full sm:w-40"` (or `sm:w-24` for
  short numerics). Section header actions and in-card buttons use `xs` / `icon-xs`.
  Inline affordances (reset arrow, info tooltip) use `icon-micro`.
- Composer chips: `h-7 min-h-7 gap-1.5 px-2.5` expanded; Button-`xs` metrics when resting.
- Send button: `h-9 w-9 sm:h-8 sm:w-8 rounded-full`.
- Sidebar rows: `h-8` (`SidebarMenuButton` default), slim thread rows `h-9`.
- PR list rows: `px-3 py-2` with `[contain-intrinsic-block-size:54px]`.
- Icons: `size-4` in rows and buttons, `size-3.5` in dense/meta contexts, `size-3` for
  micro glyphs, `size-2`/`size-[9px]`/`h-1.5 w-1.5` for status dots.

## Spacing rhythm
- Page frame: `WorkspacePageContainer` = `mx-auto flex w-full flex-col gap-6 px-5 pt-6 pb-12 sm:px-6`
  with `max-w-4xl` (readable) / `max-w-5xl` (wide) / `max-w-6xl` (expanded).
- Header padding: `pl-[calc(env(safe-area-inset-left)+0.75rem)] … sm:pl-[calc(…+1.25rem)]`, gap-3.
- Settings: section gap `gap-12`, rows `space-y-1`, section internals `space-y-3`.
- Lists: groups `space-y-3`, rows within a group `space-y-0.5`.
- Toolbars/chip strips: `gap-1` to `gap-2`; header action clusters `gap-2 @3xl:gap-3`.

## Borders & radius
- `--radius: 0.625rem` (10px) → `rounded-lg` = 10px, `rounded-md` = 8px, `rounded-sm` = 6px,
  `rounded-xl` = 14px, `rounded-2xl` = 18px, `rounded-3xl` = 22px.
- `--control-radius: 0.5rem` (8px) — buttons, chips, sidebar rows, input-groups.
- **Cards are rare.** The dominant pattern is *borderless rows separated by whitespace*, each
  `rounded-xl` with a hover fill. Real bordered cards (`rounded-xl border bg-card`) appear only
  in dialogs, and use `border-b` between rows with the last row unbordered.
- Popups/menus: `rounded-lg` + `dropdown-glass` + `shadow-[0_16px_40px_-18px_rgb(0_0_0/55%)]`.
- Dialogs: `rounded-2xl` + `dialog-glass` + `border`.
- Composer: `rounded-[22px]` with a 1px `after:` outline ring and
  `shadow-[0_12px_28px_-18px_rgb(0_0_0/40%)]` (no shadow in dark).
- Hairline rules use `border-border`, `border-border/60`, `divide-border/50`.
- Elevation is mostly `shadow-xs/5`; real depth only on floating layers.

## Color roles
- Surfaces: `bg-background` (page), `bg-card` / `bg-popover` (raised), `bg-sidebar` (nav),
  `bg-muted/…` and `bg-accent/…` for hovers.
- Text: `text-foreground` → `text-secondary-label` → `text-muted-foreground` →
  `text-muted-foreground/70` → `text-muted-foreground/50`. Icons default to `text-icon-muted`.
- Row states: hover `bg-accent/60` (content) or `bg-sidebar-row-hover` (nav);
  selected/active `bg-accent` / `bg-sidebar-row-active` / `bg-sidebar-row-selected`.
- Primary action: `bg-primary text-primary-foreground`; in the composer/chat it is
  `bg-message-action text-message-action-foreground hover:bg-message-action-hover`.
- Status semantics (two idioms, both in use):
  - **Token idiom** (preferred for new surfaces): `bg-info` / `bg-success` / `bg-warning` /
    `bg-destructive`, text `text-info-foreground` / `text-success-foreground` /
    `text-warning-foreground` / `text-destructive-foreground`, tinted surfaces at `/8` light
    and `/16` dark (see `badge.tsx`).
  - **Hue idiom** (thread + PR status): `<hue>-600` light / `<hue>-300/90` dark, with
    sky = working, amber = needs approval, indigo = awaiting input, violet = plan ready/merged,
    emerald = completed/open, red = closed/failed, teal = terminal running.
- Project/entity accents: `text-<hue>-600 dark:text-<hue>-400` with swatch `bg-<hue>-500`.
- Motion: only `animate-skeleton` (2.4s) and `animate-status-pulse` (2s), both stepped;
  everything else is a transition. No continuous repaints.
