import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Action, NotifyAction, SlackChannel, SlackThreadMode, StartSessionAction } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Select } from "@/ui/select";
import { SectionHeader } from "@/ui/settings";
import { inputClass } from "@/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/ui/menu";

/** `$` (NotificationsSection-nD9RC7ou.js:40506) — trigger types that make the Slack destination thread-aware. */
const SLACK_TRIGGER_EVENT_TYPES = ["slack:message", "slack:reaction_added"];
/** `ce` — thread-mode labels used by the Slack summary row (`ge`). */
const THREAD_MODES: { value: Exclude<SlackThreadMode, null>; labelKey: string }[] = [
  { value: "notify", labelKey: "slackThreadModeNotify" },
  { value: "attach", labelKey: "slackThreadModeAttach" },
  { value: "forward", labelKey: "slackThreadModeForward" },
];
/** `le` — email timing values are exactly always/failure/success (spec §12.1). */
const TIMING_OPTIONS: { value: NotifyAction["when"]; labelKey: string }[] = [
  { value: "always", labelKey: "notifyWhenAlways" },
  { value: "failure", labelKey: "notifyWhenFailure" },
  { value: "success", labelKey: "notifyWhenSuccess" },
];

/** `getChannelLabel` — `#name`; duplicate names are disambiguated with the workspace name. Unknown ids → undefined. */
export function slackChannelLabel(channels: SlackChannel[] | undefined, channelId: string | null | undefined): string | undefined {
  if (!channelId || !channels) return undefined;
  const c = channels.find((x) => x.channel_id === channelId);
  if (!c) return undefined;
  const dup = channels.some((x) => x.name === c.name && x.channel_id !== c.channel_id);
  return dup ? `#${c.name} (${c.workspace_name})` : `#${c.name}`;
}

/** Built-in channel picker (`g`) hosted inside the `Post to Slack` submenu: search + joined channels + join hint. */
function SlackChannelPicker({ value, onValueChange, channels, isLoading }: {
  value: string; onValueChange: (channelId: string) => void; channels: SlackChannel[] | undefined; isLoading: boolean;
}) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const list = useMemo(
    () => (channels ?? []).filter((c) => !s || `#${c.name}`.toLowerCase().includes(s) || c.workspace_name.toLowerCase().includes(s)),
    [channels, s],
  );
  return (
    <div className="m-1 w-fit min-w-[250px]">
      <div className="px-1 pb-1.5 pt-0.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t("searchChannels")}
          aria-label={t("searchSlackChannels")}
          className={cn(inputClass, "h-8 w-full text-13")}
        />
      </div>
      {isLoading ? (
        <div className="px-2 py-1.5 text-13 text-text-secondary">{t("loadingChannels")}</div>
      ) : list.length === 0 ? (
        <div className="px-2 py-1.5 text-13 text-text-secondary">{t(s ? "noChannelsFound" : "noSlackChannelsFound")}</div>
      ) : (
        <div className="max-h-[240px] overflow-y-auto">
          {list.map((c) => (
            <DropdownMenuItem key={c.channel_id} onClick={() => onValueChange(c.channel_id)} className="relative pr-8">
              {`#${c.name}`}
              {c.channel_id === value && <Check className="absolute right-2.5 !size-4 !text-text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
      )}
      <p className="px-2 pb-1 pt-1.5 text-12 text-text-secondary">{t("inviteDevinToChannelToAdd")}</p>
    </div>
  );
}

/** `_e` — email notification row. */
function EmailNotificationRow({ action, readonly, onChange, onRemove }: { action: NotifyAction; readonly?: boolean; onChange: (a: NotifyAction) => void; onRemove: () => void }) {
  const options = useMemo(() => TIMING_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), []);
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border-secondary bg-bg-elevated p-3.5">
      <span className="text-13 text-text-primary">{t("actionTypeNotify")}</span>
      <Select
        ariaLabel={t("selectNotificationTiming")}
        options={options}
        value={action.when ?? "always"}
        onValueChange={(v) => { if (!readonly && (v === "always" || v === "failure" || v === "success")) onChange({ ...action, when: v }); }}
        disabled={readonly}
        size="compact"
        triggerClassName="w-fit min-w-[unset]"
      />
      {!readonly && <Button variant="ghost" size="sm" className="ml-auto" onClick={onRemove}>{t("remove")}</Button>}
    </div>
  );
}

/** `ge` — Slack response destination summary row. */
function SlackNotificationRow({ action, readonly, channelLabel, onRemove }: { action: StartSessionAction; readonly?: boolean; channelLabel?: string; onRemove: () => void }) {
  const modeDef = THREAD_MODES.find((m) => m.value === action.slack_thread_mode);
  const modeLabel = t(modeDef ? modeDef.labelKey : "postSessionUpdatesToChannel");
  const summary = action.slack_thread_mode === "post_response"
    ? (channelLabel ? t("postAgentResponseTo", { channel: channelLabel }) : t("postAgentResponseToSlackChannel"))
    : action.slack_thread_mode
      ? (action.slack_thread_mode === "forward" && channelLabel ? `${modeLabel}: ${channelLabel}` : modeLabel)
      : channelLabel ? t("postSessionUpdatesTo", { channel: channelLabel }) : t("postSessionUpdatesToSlackChannel");
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border-secondary bg-bg-elevated p-3.5">
      <div className="flex items-baseline gap-3">
        <span className="text-13 text-text-primary">{t("postToSlack")}</span>
        <span className="text-12 text-text-secondary">{summary}</span>
      </div>
      {!readonly && <Button variant="ghost" size="sm" className="ml-auto" onClick={onRemove}>{t("remove")}</Button>}
    </div>
  );
}

/**
 * Exact port of NotificationsSection-nD9RC7ou.js `he` (spec §12): header + `Add notification` menu,
 * at most one `{type:'notify'}` email action, and the Slack response destination stored on the first
 * `start_session` (`slack_channel_id` / `slack_thread_mode`).
 * Optional: `triggerEventTypes` (thread-mode remap for Slack triggers), `onChannelToJoinChange`
 * (channel the page must join before create/update; null when cleared).
 */
export function NotificationsSection({ actions, onActionsChange, readonly, triggerEventTypes = [], onChannelToJoinChange }: {
  actions: Action[]; onActionsChange: (a: Action[]) => void; readonly?: boolean;
  triggerEventTypes?: string[]; onChannelToJoinChange?: (channelId: string | null) => void;
}) {
  const channels = useQuery("slack-channels", () => store.slackChannels());
  const notifyIdx = actions.findIndex((a) => a.type === "notify");
  const notify = notifyIdx >= 0 ? (actions[notifyIdx] as NotifyAction) : undefined;
  const startIdx = actions.findIndex((a) => a.type === "start_session");
  const start = startIdx >= 0 ? (actions[startIdx] as StartSessionAction) : undefined;
  const hasSlackTrigger = triggerEventTypes.some((e) => SLACK_TRIGGER_EVENT_TYPES.includes(e));
  const hasSlackNotification = !!start && (!!start.slack_thread_mode || !!start.slack_channel_id);

  const setAt = (i: number, a: Action) => { const next = [...actions]; next[i] = a; onActionsChange(next); };
  const addEmail = () => { if (notifyIdx < 0) onActionsChange([...actions, { type: "notify", when: "always" }]); };
  const updateStart = (a: StartSessionAction) => { if (startIdx >= 0) setAt(startIdx, a); };
  const selectChannel = (channelId: string) => {
    if (!start) return;
    const mode = start.slack_thread_mode ?? null;
    const remapToResponse =
      mode === "notify" || mode === "attach" || (!hasSlackTrigger && mode === "forward") ||
      (hasSlackTrigger && mode == null && !!start.slack_channel_id) || (mode == null && !start.slack_channel_id);
    const nextMode: SlackThreadMode = channelId ? (remapToResponse ? "post_response" : mode) : null;
    updateStart({ ...start, slack_channel_id: channelId || undefined, slack_thread_mode: nextMode });
    onChannelToJoinChange?.(channelId || null);
  };
  const removeSlack = () => {
    if (!start) return;
    updateStart({ ...start, slack_thread_mode: null, slack_channel_id: undefined });
    onChannelToJoinChange?.(null);
  };

  return (
    <div className="flex flex-col gap-4 rounded-[10px]">
      <SectionHeader
        title={t("notifications")}
        description={t("notificationsDescription")}
        action={readonly ? undefined : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary"><Plus size={16} />{t("addNotification")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={notifyIdx >= 0} onClick={addEmail}>{t("actionTypeNotify")}</DropdownMenuItem>
              {start && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t("postToSlack")}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <SlackChannelPicker value={start.slack_channel_id ?? ""} onValueChange={selectChannel} channels={channels.data} isLoading={channels.isLoading} />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      {notify && (
        <EmailNotificationRow action={notify} readonly={readonly} onChange={(a) => setAt(notifyIdx, a)} onRemove={() => onActionsChange(actions.filter((_, i) => i !== notifyIdx))} />
      )}
      {hasSlackNotification && start && (
        <SlackNotificationRow action={start} readonly={readonly} channelLabel={slackChannelLabel(channels.data, start.slack_channel_id)} onRemove={removeSlack} />
      )}
    </div>
  );
}
