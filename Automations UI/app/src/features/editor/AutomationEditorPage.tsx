import { useBlocker, useLocation, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { Action, Automation, Trigger } from "@/model/types";
import { store, useQuery, isNotFoundError } from "@/data/store";
import { ORG_ID } from "@/data/seed";
import { useCapabilities } from "@/data/capabilities";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Tooltip } from "@/ui/tooltip";
import { Skeleton } from "@/ui/skeleton";
import { Switch } from "@/ui/switch";
import { ConfirmDialog } from "@/ui/dialog";
import { ErrorAlert } from "@/ui/alert";
import { SectionHeader, SettingsCard, SettingsCardGroup } from "@/ui/settings";
import { HeaderActions } from "@/shell/header-portals";
import { SpendingFrozenTooltipContent } from "@/ui/spending-frozen";
import {
  canonical, codeScanForm, consumePrefill, emptyForm, formFromAutomation, formFromTemplate, isCodeScanForm, slackReplyModeOf, syncRepliesWithSlackMode,
  toCreatePayload, toUpdatePayload, validate, type FormState, type UpdateAutomationRequest,
} from "./form";
import { AddTriggerMenu, PylonTriggerDisabledBanner, TriggerCard, hasSubHourlySchedule, slackChannelIdsOf, subHourlyAllowed, type WebhookCreds } from "./TriggerEditor";
import { AgentCard } from "./AgentCard";
import { NotificationsSection } from "./NotificationsSection";
import { AdvancedAccordion, ChildSessionsRow, LimitsRow, MetadataRows, NetworkPolicyRow, QueueingRow, ScratchpadRow, SecurityProfileRow, type McpNetEntry } from "./AdvancedSection";
import { absoluteDate } from "@/lib/time";

/** Trigger types that may appear at most once (other rows' pickers disable them). */
const SINGLETON_EVENTS = new Set(["schedule:recurring", "webhook:incoming", "code_scan:finding"]);
const PRIMARY_ACTIONS = new Set(["start_session", "message_session", "remediate_finding", "triage_session", "monitor_session", "incident_session"]);

function EditorSkeleton() {
  return (
    <div className="mx-auto h-fit w-full max-w-[800px] px-3 py-[28px]">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[38px] w-full rounded" />
        <Skeleton className="h-[120px] w-full rounded-[10px]" />
        <Skeleton className="h-[120px] w-full rounded-[10px]" />
        <Skeleton className="h-[80px] w-full rounded-[10px]" />
      </div>
    </div>
  );
}

/** Mock transport: the store merges patches, so `clear_*` wire flags are consumed here (null already clears). */
function toStorePatch(body: UpdateAutomationRequest): Partial<Automation> {
  const { clear_max_acu_limit: _a, clear_invocation_limit: _b, clear_max_concurrent_runs: _c, clear_max_queue_depth: _d, clear_devin_mode: _e, clear_net_policy: _f, ...rest } = body;
  void _a; void _b; void _c; void _d; void _e; void _f;
  return rest as Partial<Automation>;
}

/**
 * Create/edit editor (AutomationEditorPage-tUXHQ5Au.js; create composition 3265-3501, edit 4590-5310).
 * Stable-gutter vertical scroller, centered `max-w-[800px] px-3 py-[28px]`, `gap-6` sections, inert/aria-busy while saving.
 * `/security/automations/*` renders the code-scan variant (fixed `code_scan:finding` trigger, `remediate_finding` action).
 */
export function AutomationEditorPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const search = useSearch({ strict: false }) as { template?: string };
  const navigate = useNavigate();
  const router = useRouter();
  const { pathname } = useLocation();
  const caps = useCapabilities();
  const isEdit = !!params.id;
  const securityRoute = pathname.startsWith("/security/");

  const existing = useQuery(`automation:${params.id}`, () => store.get(params.id!), { enabled: isEdit });
  const templates = useQuery("templates", () => store.templates(), { enabled: !isEdit && !!search.template });
  const tagSuggestions = useQuery("tags", () => store.tags());
  const slackChannels = useQuery("slack-channels", () => store.slackChannels());
  const mcpCatalog = useQuery("mcp-servers", () => store.mcpServers());

  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState<FormState | null>(null);
  const [touched, setTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [webhookCreds, setWebhookCreds] = useState<WebhookCreds>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [mcpHosts, setMcpHosts] = useState<string[]>([]);
  const [networkConfirm, setNetworkConfirm] = useState(false);
  const bypassGuard = useRef(false);
  const inflight = useRef(false);

  // §8.1 initial values: edit → loaded record (`Pa` projection); security create → code-scan defaults; create → prefill / template / blank.
  useEffect(() => {
    if (form) return;
    let f: FormState | null = null;
    if (isEdit) {
      if (!existing.data) return;
      f = formFromAutomation(existing.data);
    } else {
      const pre = consumePrefill();
      if (pre) f = { ...emptyForm(), ...pre } as FormState;
      else if (search.template) {
        if (!templates.data) return;
        const tpl = templates.data.find((x) => x.template_id === search.template);
        f = tpl ? formFromTemplate(tpl) : emptyForm();
      } else f = emptyForm();
      if (securityRoute && !isCodeScanForm(f.triggers)) f = { ...codeScanForm(), name: f.name };
    }
    setForm(f); setBaseline(f);
  }, [form, isEdit, existing.data, search.template, templates.data, securityRoute]);

  const patch = useCallback((p: Partial<FormState>) => { setForm((f) => (f ? { ...f, ...p } : f)); setTouched(true); }, []);
  const hasDiff = useMemo(() => (form && baseline ? canonical(form) !== canonical(baseline) : false), [form, baseline]);
  const dirty = isEdit ? hasDiff : touched;
  const validation = useMemo(() => (form ? validate(form) : null), [form]);

  // §8.3 navigation guard (`la`): blocked while dirty unless saving or bypassed after success; before-unload uses the same predicate.
  const shouldBlock = () => dirty && !saving && !bypassGuard.current;
  const blocker = useBlocker({ shouldBlockFn: shouldBlock, enableBeforeUnload: shouldBlock, withResolver: true });

  const isCodeScan = securityRoute || (form ? isCodeScanForm(form.triggers) : false) || (existing.data?.triggers ?? []).some((tr) => tr.event_type === "code_scan:finding");
  const canManage = isCodeScan ? caps.canManageCodeScan : caps.canManageAutomations;
  const readOnly = isEdit && !canManage;
  const webhookUrl = `${window.location.origin}/api/webhooks/automations/${ORG_ID}/${params.id ?? webhookCreds?.automation_id ?? "<pending>"}`;

  /* ---------------- definition mutations (Zn / er / $n) ---------------- */
  const setTriggers = (next: Trigger[]) => {
    if (!form) return;
    // Removing the code-scan trigger removes `remediate_finding`, restoring a blank `start_session` when no session action remains (module 3021-3032).
    let actions = form.actions;
    if (!next.some((tr) => tr.event_type === "code_scan:finding") && actions.some((a) => a.type === "remediate_finding")) {
      const rest = actions.filter((a) => a.type !== "remediate_finding");
      actions = rest.some((a) => a.type === "start_session") ? rest : [...rest, { type: "start_session", prompt: "", bypass_approval: true }];
    }
    if (!next.some((tr) => tr.event_type === "webhook:incoming")) setWebhookCreds(null);
    patch({ triggers: next, actions });
  };
  const addTrigger = async (tr: Trigger) => {
    if (!form) return;
    const list = form.triggers.length === 1 && !form.triggers[0]!.event_type ? [] : form.triggers;
    if (tr.event_type === "webhook:incoming" && !isEdit && !webhookCreds) {
      // TR-05: mint first; only the secret hash enters the trigger at save time (`fr`).
      const creds = await store.mintWebhook();
      setWebhookCreds(creds);
    }
    setTriggers([...list, tr]);
  };
  const setActions = (next: Action[]) => {
    if (!form) return;
    const mode = slackReplyModeOf(next);
    const triggers = mode != null && mode !== slackReplyModeOf(form.actions) ? syncRepliesWithSlackMode(form.triggers, mode) : form.triggers;
    patch({ actions: next, triggers });
  };
  const clearSlackReplyMode = () => {
    if (!form) return;
    patch({ actions: form.actions.map((a) => (a.type === "start_session" ? { ...a, slack_thread_mode: null, slack_channel_id: undefined } : a)) });
  };

  /* ---------------- routing (xa / sr) ---------------- */
  const detailTarget = (id: string) => (isCodeScan ? { to: "/security/automations/$id", params: { id } } : { to: "/automations/$id", params: { id } });
  const listTarget = () => (isCodeScan ? { to: "/security", search: { tab: "automations" } } : { to: "/automations" });
  const goDetail = (id: string) => navigate(detailTarget(id) as never);

  /* ---------------- save (§15.3) ---------------- */
  const performSave = async () => {
    if (!form || inflight.current) return;
    inflight.current = true; setSaving(true); setSaveError(null);
    try {
      const resolveChannel = (id: string) => { const c = slackChannels.data?.find((x) => x.channel_id === id); return c ? { workspace_id: c.workspace_id, id: c.channel_id } : undefined; };
      const webhook = webhookCreds && form.triggers.some((tr) => tr.event_type === "webhook:incoming") ? { automationId: webhookCreds.automation_id, hash: webhookCreds.webhook_secret_hash } : null;
      if (isEdit && existing.data) {
        const forceScratchpad = form.actions.some((a) => a.type === "monitor_session" || a.type === "triage_session");
        const includeDefinition = !existing.data.actions.some((a) => a.type === "incident_session");
        const body = toUpdatePayload(form, existing.data, { webhook, resolveChannel, forceScratchpad, includeDefinition });
        await store.update(params.id!, toStorePatch(body));
        bypassGuard.current = true;
        goDetail(params.id!);
      } else {
        const body = toCreatePayload(form, { webhook, resolveChannel });
        const created = await store.create(body as unknown as Omit<Automation, "automation_id" | "created_at" | "updated_at"> & { automation_id?: string });
        bypassGuard.current = true;
        // Type-aware success route: Security tab for code scan, standard detail otherwise (module 3082-3094).
        if (isCodeScan) navigate(listTarget() as never); else goDetail(created.automation_id);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally { inflight.current = false; setSaving(false); }
  };
  const save = async () => {
    if (!form || inflight.current) return;
    setShowErrors(true);
    const v = validate(form);
    if (!v.ok) return;
    // Update: changing network settings on a monitoring Devin asks for confirmation (module 4318-4330).
    if (isEdit && existing.data && existing.data.actions.some((a) => a.type === "monitor_session")) {
      const net = JSON.stringify(form.netPolicyEnabled ? { allow: form.netPolicyEntries } : null) !== JSON.stringify(existing.data.net_policy ?? null);
      const loadedMcps = new Set(existing.data.recommended_mcps ?? []);
      const mcpChanged = form.recommendedMcps.size !== loadedMcps.size || [...form.recommendedMcps].some((m) => !loadedMcps.has(m));
      if (net || (mcpChanged && form.netPolicyEnabled)) { setNetworkConfirm(true); return; }
    }
    await performSave();
  };

  // Cancel: history back when possible, else type-aware list (create, module 3105-3120) / detail (edit, `La`).
  const cancel = () => {
    if (isEdit) { navigate(detailTarget(params.id!) as never); return; }
    if (router.history.canGoBack()) { router.history.back(); return; }
    navigate(listTarget() as never);
  };
  const reset = () => { if (existing.data) { const f = formFromAutomation(existing.data); setForm(f); setBaseline(f); setShowErrors(false); setSaveError(null); } };

  /* ---------------- frame states (module 4291-4306) ---------------- */
  if (isEdit && !existing.data && existing.isError) {
    return isNotFoundError(existing.error)
      ? <div className="flex h-full min-w-0 flex-1 items-center justify-center px-3 py-[28px]"><p className="text-text-secondary">{t("automationNotFound")}</p></div>
      : <div className="flex h-full min-w-0 flex-1 items-center justify-center px-3 py-[28px]"><ErrorAlert message={t("automationLoadError")} onRetry={() => existing.refetch()} /></div>;
  }
  if (!form) {
    return <div className="flex h-full min-w-0 flex-1"><div style={{ scrollbarGutter: "stable" }} className="min-w-0 flex-1 overflow-y-auto"><EditorSkeleton /></div></div>;
  }

  const hasStart = form.actions.some((a) => a.type === "start_session");
  const hasSlackMessage = form.triggers.some((tr) => tr.event_type === "slack:message");
  const monitor = form.actions.find((a) => a.type === "monitor_session");
  const triage = form.actions.find((a) => a.type === "triage_session");
  const monitorMode = monitor?.type === "monitor_session";
  const triageMode = triage?.type === "triage_session";
  const lockedSlackChannelId = monitorMode ? monitor.slack_monitor_config.source_channel_id : triageMode ? triage.slack_config.source_channel_id : form.triggers.filter((tr) => tr.event_type === "slack:message").flatMap(slackChannelIdsOf)[0] ?? null;
  const primaryActions = form.actions.map((a, i) => [a, i] as const).filter(([a]) => PRIMARY_ACTIONS.has(a.type));
  const otherActions = form.actions.map((a, i) => [a, i] as const).filter(([a]) => a.type !== "notify" && !PRIMARY_ACTIONS.has(a.type));
  const slackReplyMode = slackReplyModeOf(form.actions);
  const hasWebhook = form.triggers.some((tr) => tr.event_type === "webhook:incoming");
  const mcpCatalogUnavailable = form.recommendedMcps.size > 0 && !mcpCatalog.data;
  const subHourlyBlocked = !subHourlyAllowed(caps.planSlug) && hasSubHourlySchedule(form.triggers);
  const restrictedReason = subHourlyBlocked ? t("subHourlyBlockMessage") : null;
  const metadataBlocked = showErrors && !!validation?.metadataError;
  // §8.4 gate (`fa`/`da` + create 3249-3258): pending save, frozen, catalog, unminted webhook, ACU value, restricted trigger, revealed metadata error; edit also needs a diff.
  const invalid = caps.spendingFrozen || mcpCatalogUnavailable || (hasWebhook && !isEdit && !webhookCreds) || !!validation?.acuError || !!restrictedReason || metadataBlocked;
  const saveDisabled = saving || invalid || (isEdit && !hasDiff);
  const saveTooltip = caps.spendingFrozen ? <SpendingFrozenTooltipContent /> : mcpCatalogUnavailable ? t("mcpCatalogUnavailableBeforeSaving") : restrictedReason ?? (metadataBlocked || (showErrors && validation && !validation.ok) ? t("resolveErrors") : null);
  const firstError = showErrors && validation && !validation.ok ? validation.errors[0] ?? validation.metadataError ?? validation.acuError : null;
  const mcpEntries: McpNetEntry[] = mcpHosts.map((h) => ({ value: h, source: "mcp" }));
  const disabledFor = (own: string) => new Set([...form.triggers.map((tr) => tr.event_type).filter((e) => e && e !== own && SINGLETON_EVENTS.has(e)), ...(monitorMode ? ["slack:message"] : [])]);

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div style={{ scrollbarGutter: "stable" }} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto h-fit w-full max-w-[800px] px-3 py-[28px]">
          <HeaderActions>
            <div className="flex items-center gap-3">
              {readOnly ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex h-7 shrink-0 items-center gap-1 rounded-[6px] bg-tint-blue px-2 text-13 font-medium text-text-blue"><Lock size={14} />{t("readOnly")}</span>
                  <Tooltip content={<span className="flex items-center gap-1.5"><Lock size={14} /><span>{t("noPermissionEdit")}</span></span>}>
                    <span><Button variant="primary" disabled>{t("save")}</Button></span>
                  </Tooltip>
                </div>
              ) : (
                <>
                  <Button variant="secondary" onClick={isEdit && hasDiff ? cancel : isEdit ? reset : cancel} disabled={saving}>{t("cancel")}</Button>
                  <Tooltip content={saveTooltip} disabled={!saveTooltip}>
                    <span><Button variant="primary" onClick={save} disabled={saveDisabled}>{isEdit ? t("save") : monitorMode || triageMode ? t("createTriageDevin") : t("createAutomation")}</Button></span>
                  </Tooltip>
                </>
              )}
            </div>
          </HeaderActions>
          <div className="flex flex-col gap-6" inert={saving || undefined} aria-busy={saving}>
            {(saveError || firstError) && <ErrorAlert message={saveError ?? firstError} onRetry={saveError ? performSave : undefined} />}
            <div>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t("automationNamePlaceholder")} disabled={readOnly} className={cn("h-[38px] w-full text-17 font-medium", showErrors && !form.name.trim() && "ring-1 ring-text-destructive")} />
              {isEdit && existing.data && (
                <div className="mt-4 flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <Switch checked={existing.data.enabled} disabled={readOnly} onCheckedChange={(v) => store.update(params.id!, { enabled: v })} />
                    <span className="text-13 text-text-secondary">{t("active")}</span>
                  </label>
                  <div className="h-4 w-px bg-border-primary" />
                  <span className="text-13 text-text-secondary">{existing.data.updated_by && existing.data.updated_by !== existing.data.created_by ? t("editedByOn", { name: store.userName(existing.data.updated_by), date: absoluteDate(existing.data.updated_at) }) : t("createdByOn", { name: store.userName(existing.data.created_by), date: absoluteDate(existing.data.created_at) })}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <SectionHeader title={t("triggers")} description={t("triggersDescription")} action={!readOnly && !isCodeScan && !monitorMode ? <AddTriggerMenu triggers={form.triggers} onAdd={addTrigger} disabledEventTypes={disabledFor("")} showMonitor={!isEdit} onSelectMonitor={() => setTriggers([{ event_type: "slack:message", conditions: [] }])} /> : undefined} />
              <PylonTriggerDisabledBanner triggers={form.triggers} />
              <div className="flex flex-col gap-2">
                {form.triggers.map((tr, i) => (
                  <TriggerCard
                    key={tr.trigger_id ?? i}
                    trigger={tr}
                    onChange={(x) => setTriggers(form.triggers.map((y, j) => (j === i ? x : y)))}
                    onRemove={() => setTriggers(form.triggers.filter((_, j) => j !== i))}
                    canRemove={!isCodeScan}
                    readonly={readOnly}
                    showError={showErrors && validation?.triggerErrors.has(i)}
                    webhookCreds={webhookCreds}
                    webhookUrl={webhookUrl}
                    webhookSecretNote={t(isEdit ? "webhookSecretNoteSaved" : "webhookSecretNote")}
                    showWebhookTestCommand
                    regeneratingWebhookSecret={regenerating}
                    onRegenerateSecret={async () => { setRegenerating(true); try { setWebhookCreds(await store.mintWebhook()); } finally { setRegenerating(false); } }}
                    connections={Object.fromEntries(Object.entries(caps.connections).map(([k, v]) => [k, v === "connected"]))}
                    disabledEventTypes={disabledFor(tr.event_type)}
                    lockRestrictedTriggers={isCodeScan}
                    hasStartSessionAction={hasStart}
                    slackReplyMode={slackReplyMode}
                    onClearSlackReplyMode={clearSlackReplyMode}
                    monitorMode={monitorMode}
                    showMonitor={!isEdit}
                    onMonitorChange={(on) => { if (!on && monitorMode) setActions([{ type: "start_session", prompt: monitor.setup_prompt, bypass_approval: true }]); }}
                    triageMode={triageMode}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <SectionHeader title={t("agentDefinition")} description={t("agentDefinitionDescription")} />
              <div className="flex flex-col gap-4">
                {primaryActions.map(([a, i], k) => (
                  <AgentCard
                    key={i}
                    action={a}
                    index={k}
                    count={primaryActions.length}
                    onChange={(na: Action) => setActions(form.actions.map((x, j) => (j === i ? na : x)))}
                    onRemove={() => setActions(form.actions.filter((_, j) => j !== i))}
                    readonly={readOnly}
                    showError={showErrors && validation?.actionErrors.has(i)}
                    hasSlackMessageTrigger={hasSlackMessage}
                    isCodeScan={isCodeScan}
                    locked={isEdit}
                    disableNewSession={form.actions.some((x, j) => j !== i && x.type === "start_session")}
                    monitorMode={monitorMode}
                    devinMode={form.devinMode}
                    onDevinModeChange={(m) => patch({ devinMode: m })}
                    runAsUser={form.runAsUser}
                    onRunAsUserChange={(v) => patch({ runAsUser: v })}
                    mcps={form.recommendedMcps}
                    onMcpsChange={(s) => patch({ recommendedMcps: s })}
                    recommendedMcps={baseline?.recommendedMcps ?? form.recommendedMcps}
                    linearEnabled={form.linearToolsEnabled}
                    onLinearEnabledChange={(v) => patch({ linearToolsEnabled: v })}
                    slackToolChannels={form.slackToolChannels}
                    onSlackToolChannelsChange={(v) => patch({ slackToolChannels: v })}
                    slackToolsEnabled={form.slackToolsEnabled}
                    onSlackToolsEnabledChange={(v) => patch({ slackToolsEnabled: v })}
                    slackDmEnabled={form.slackDmEnabled}
                    onSlackDmEnabledChange={(v) => patch({ slackDmEnabled: v })}
                    slackForceEnabled={monitorMode || triageMode}
                    lockedSlackChannelId={lockedSlackChannelId}
                    profileDraft={form.security}
                    automationId={params.id ?? null}
                    onMcpHostsChange={(h) => setMcpHosts((prev) => (prev.length === h.length && prev.every((x, i) => x === h[i]) ? prev : h))}
                    isLast={k === primaryActions.length - 1}
                  />
                ))}
                {otherActions.map(([a, i]) => (
                  <div key={i} className="flex items-center gap-3 rounded-[10px] border border-border-secondary bg-bg-elevated p-3.5 opacity-75">
                    <span className="text-13 text-text-primary">{a.type}</span>
                    {!readOnly && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setActions(form.actions.filter((_, j) => j !== i))}>{t("remove")}</Button>}
                  </div>
                ))}
              </div>
            </div>

            <NotificationsSection actions={form.actions} onActionsChange={setActions} readonly={readOnly} triggerEventTypes={form.triggers.map((tr) => tr.event_type).filter(Boolean)} />

            <AdvancedAccordion open={advancedOpen} onOpenChange={setAdvancedOpen}>
              {hasStart && (
                <SettingsCardGroup>
                  <SettingsCard>
                    <ChildSessionsRow form={form} patch={patch} readOnly={readOnly} />
                    {isEdit && <ScratchpadRow form={form} patch={patch} readOnly={readOnly} forceEnabled={monitorMode || triageMode} />}
                  </SettingsCard>
                </SettingsCardGroup>
              )}
              <SettingsCardGroup>
                <SettingsCard>
                  <SecurityProfileRow form={form} patch={patch} readOnly={readOnly} automationId={params.id ?? null} saving={saving} />
                  <NetworkPolicyRow form={form} patch={patch} readOnly={readOnly} mcpEntries={mcpEntries} automationId={params.id ?? null} />
                </SettingsCard>
              </SettingsCardGroup>
              <SettingsCardGroup>
                <SettingsCard>
                  <MetadataRows rows={form.metadata} onChange={(metadata) => patch({ metadata })} readOnly={readOnly} showErrors={showErrors} suggestions={tagSuggestions.data ?? {}} error={showErrors && validation?.metadataError ? validation.metadataError : undefined} />
                  <LimitsRow form={form} patch={patch} readOnly={readOnly} enabled={form.limitsEnabled} onEnabledChange={(v) => patch({ limitsEnabled: v })} />
                  <QueueingRow form={form} patch={patch} readOnly={readOnly} />
                </SettingsCard>
              </SettingsCardGroup>
            </AdvancedAccordion>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(o) => { if (!o) blocker.reset?.(); }}
        title={t("discardTitle")}
        description={t("discardDescription")}
        confirmLabel={t("discard")}
        cancelLabel={t("cancel")}
        hideClose
        onConfirm={() => blocker.proceed?.()}
      />
      <ConfirmDialog
        open={networkConfirm}
        onOpenChange={setNetworkConfirm}
        title={t("updateNetworkConfigTitle")}
        description={t("updateNetworkConfigDescription")}
        confirmLabel={t("continue")}
        cancelLabel={t("cancel")}
        confirmVariant="primary"
        onConfirm={async () => { setNetworkConfirm(false); await performSave(); }}
      />
    </div>
  );
}

export type { Automation };
