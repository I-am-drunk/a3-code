import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Automation, AutomationEvent, AutomationIssue, AutomationTemplate, ConsumptionRow, Invocation, McpServer, ResolvedSecurity, SecurityProfile, SlackChannel, GitConnection, Repo } from "@/model/types";
import { AUTOMATIONS, MCP_CATALOG, SECURITY_PROFILES, SLACK_CHANNELS, TEMPLATES, USERS, GIT_CONNECTIONS, REPOS } from "./seed";
import { generateConsumption, generateEvents, generateInvocations, generateIssues, sparklineBuckets } from "./history";
import { sourceOf } from "@/model/sources";
import { capabilities } from "./capabilities";

/**
 * Replaceable backend port (spec §22.2 `AutomationRepository`). Everything here is in-memory with
 * small simulated latency so loading/skeleton states render. Request shapes mirror the org API
 * (Appendix A): events/invocations paging + ISO bounds + repeated status, consumption since/until.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let automations: Automation[] = structuredClone(AUTOMATIONS);
let version = 0;
const notify = () => { version++; listeners.forEach((l) => l()); };
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const notFound = () => Object.assign(new Error("not_found"), { status: 404 });

/** Optimistic Enable/Disable controller state (spec §17.5): one pending toggle per id, snapshot + rollback on failure. */
const pendingToggles = new Set<string>();
/** Set from the console (`window.__automationsStore.failNextToggle = true`) to exercise the rollback branch. */
const flags = { failNextToggle: false, failNextInvocations: false };

export const store = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
  flags,

  async list(): Promise<Automation[]> { await delay(350); return automations.map((a) => structuredClone(a)); },
  /** Second, runtime-gated list source (On-call responders). Empty unless the gate is on (spec §6.1). */
  async listResponders(): Promise<Automation[]> { await delay(200); return capabilities.get().oncall ? automations.filter((a) => a.actions.some((x) => x.type === "incident_session")).map((a) => structuredClone(a)) : []; },
  async get(id: string): Promise<Automation> {
    await delay(300);
    const a = automations.find((x) => x.automation_id === id);
    if (!a) throw notFound();
    return structuredClone(a);
  },
  async create(input: Omit<Automation, "automation_id" | "created_at" | "updated_at"> & { automation_id?: string }): Promise<Automation> {
    await delay(500);
    const a: Automation = {
      ...input,
      automation_id: input.automation_id ?? `auto_${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      created_by: "user_tk", last_invocation_at: null,
    };
    automations = [a, ...automations];
    notify();
    return structuredClone(a);
  },
  async update(id: string, patch: Partial<Automation>): Promise<Automation> {
    await delay(450);
    const idx = automations.findIndex((x) => x.automation_id === id);
    if (idx < 0) throw notFound();
    automations[idx] = { ...automations[idx]!, ...patch, updated_at: new Date().toISOString(), updated_by: "user_tk" };
    notify();
    return structuredClone(automations[idx]!);
  },
  /** Optimistic multi-cache toggle: suppress re-entry per id, write immediately, restore the snapshot on error. */
  isTogglePending: (id: string) => pendingToggles.has(id),
  async toggleEnabled(id: string, enabled: boolean): Promise<boolean> {
    if (pendingToggles.has(id)) return false;
    const idx = automations.findIndex((x) => x.automation_id === id);
    if (idx < 0) return false;
    const snapshot = automations[idx]!.enabled;
    pendingToggles.add(id);
    automations[idx] = { ...automations[idx]!, enabled };
    notify();
    await delay(450);
    try {
      if (flags.failNextToggle) { flags.failNextToggle = false; throw new Error("toggle_failed"); }
      const cur = automations.findIndex((x) => x.automation_id === id);
      if (cur >= 0) automations[cur] = { ...automations[cur]!, enabled, updated_at: new Date().toISOString(), updated_by: "user_tk" };
      return true;
    } catch (e) {
      const cur = automations.findIndex((x) => x.automation_id === id);
      if (cur >= 0) automations[cur] = { ...automations[cur]!, enabled: snapshot };
      throw e;
    } finally {
      pendingToggles.delete(id);
      notify();
    }
  },
  async delete(id: string): Promise<void> {
    await delay(400);
    automations = automations.filter((x) => x.automation_id !== id);
    notify();
  },
  async trigger(id: string, _body?: { prompt: string }): Promise<boolean> {
    await delay(700);
    const idx = automations.findIndex((x) => x.automation_id === id);
    if (idx < 0) return false;
    automations[idx] = { ...automations[idx]!, last_invocation_at: new Date().toISOString() };
    const list = eventsCache.get(id) ?? [];
    list.unshift({ event_id: `${id}_manual_${Date.now()}`, status: "queued", created_at: new Date().toISOString(), event_type: "manual", event_message: "Manual run", devin_session_id: null });
    eventsCache.set(id, list);
    notify();
    return true;
  },
  async templates(): Promise<AutomationTemplate[]> { await delay(400); return structuredClone(TEMPLATES); },
  async sparklines(): Promise<Record<string, number[]>> {
    await delay(650);
    const out: Record<string, number[]> = {};
    for (const a of automations) out[a.automation_id] = sparklineBuckets(eventsFor(a));
    return out;
  },
  async tags(): Promise<Record<string, string[]>> {
    await delay(200);
    const out: Record<string, Set<string>> = {};
    for (const a of automations) for (const [k, v] of Object.entries(a.tags ?? {})) (out[k] ??= new Set()).add(v);
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
  },
  async events(id: string, q: { since: string; until: string; status?: string[]; limit: number; offset: number; include_message?: boolean }): Promise<{ data: AutomationEvent[]; total: number; has_next: boolean }> {
    await delay(380);
    const a = automations.find((x) => x.automation_id === id);
    let rows = a ? eventsFor(a) : [];
    rows = rows.filter((e) => e.created_at >= q.since && e.created_at <= q.until);
    if (q.status?.length) rows = rows.filter((e) => q.status!.includes(e.status));
    const page = rows.slice(q.offset, q.offset + q.limit).map((e) => (q.include_message === false ? { ...e, event_message: null, event_message_parts: undefined } : e));
    return { data: structuredClone(page), total: rows.length, has_next: q.offset + q.limit < rows.length };
  },
  /** Lifetime existence probe used by the Preflight-enabled `No events yet` state (one row, no bounds). */
  async hasAnyEvents(id: string): Promise<boolean> { await delay(150); const a = automations.find((x) => x.automation_id === id); return !!a && eventsFor(a).length > 0; },
  async issues(id: string): Promise<AutomationIssue[]> { await delay(350); return generateIssues(id); },
  async invocations(id: string, q: { issue_id?: string; limit?: number; include_message?: boolean }): Promise<Invocation[]> {
    await delay(420);
    if (flags.failNextInvocations) { flags.failNextInvocations = false; throw new Error("invocations_failed"); }
    if (!q.issue_id) return [];
    return generateInvocations(id, q.issue_id).slice(0, q.limit ?? 20);
  },
  async consumption(id: string, since: string, until: string): Promise<ConsumptionRow[]> {
    await delay(420);
    const from = since.slice(0, 10), to = until.slice(0, 10);
    return generateConsumption(id).filter((r) => r.created_at >= from && r.created_at <= to);
  },
  async mcpServers(): Promise<McpServer[]> { await delay(600); return structuredClone(MCP_CATALOG); },
  async slackChannels(): Promise<SlackChannel[]> { await delay(300); return structuredClone(SLACK_CHANNELS); },
  /** Git connections (`M` query in the trigger editor's public-repo gate). */
  async gitConnections(): Promise<GitConnection[]> { await delay(250); return structuredClone(GIT_CONNECTIONS); },
  /** Repository list (`N.repos`; the shipped hook pages 100 at a time with a debounced name filter). */
  async repos(filterName?: string | null): Promise<Repo[]> {
    await delay(300);
    const q = (filterName ?? "").trim().toLowerCase();
    return structuredClone(q ? REPOS.filter((r) => r.full_name.toLowerCase().includes(q)) : REPOS);
  },
  /** Slack channel join performed before create/update mutations (spec Appendix F §2.14). */
  async joinSlackChannel(_channelId: string): Promise<{ ok: true } | { ok: false; error: "missing_scope" | "unavailable" }> { await delay(250); return { ok: true }; },
  async securityProfiles(): Promise<SecurityProfile[]> { await delay(350); return structuredClone(SECURITY_PROFILES); },
  /** Resolved governing security for an automation given the local draft selection (spec §13.3). */
  async resolvedSecurity(_id: string | null, selection: "inherit" | "disabled" | "profile" | null, profileId?: string | null): Promise<ResolvedSecurity> {
    await delay(300);
    const orgDefault = SECURITY_PROFILES.find((p) => p.is_default) ?? null;
    const chosen = selection === "profile" ? SECURITY_PROFILES.find((p) => p.secure_mode_profile_id === profileId) ?? null : selection === "disabled" ? null : orgDefault;
    return {
      resolved_default: orgDefault ? { secure_mode_profile_id: orgDefault.secure_mode_profile_id, name: orgDefault.name, is_default: true } : null,
      governing_profile_name: chosen?.name ?? null,
      governing_scope: selection === "profile" ? "automation" : selection === "disabled" ? null : "automations_default",
      governing_profile_scope: chosen?.scope ?? null,
      governing_has_net_policy: !!chosen?.has_net_policy,
      governing_net_policy: chosen?.net_policy ?? null,
      governing_mcp_server_ids: chosen?.mcp_server_ids ?? null,
      governing_unresolved: false,
    };
  },
  users: USERS,
  userName(id: string | null | undefined): string | null {
    return USERS.find((u) => u.id === id)?.name ?? null;
  },
  async mintWebhook(): Promise<{ automation_id: string; webhook_secret: string; webhook_secret_hash: string }> {
    await delay(500);
    const secret = `whsec_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    return { automation_id: `auto_${Math.random().toString(36).slice(2, 8)}`, webhook_secret: secret, webhook_secret_hash: `sha256:${Math.random().toString(16).slice(2, 18)}` };
  },
};

declare global { interface Window { __automationsStore?: typeof store } }
if (typeof window !== "undefined") window.__automationsStore = store;

const eventsCache = new Map<string, AutomationEvent[]>();
function eventsFor(a: Automation): AutomationEvent[] {
  let list = eventsCache.get(a.automation_id);
  if (!list) {
    const src = sourceOf(a.triggers[0]?.event_type);
    const count = a.last_invocation_at ? (src === "slack" ? 140 : src === "github" ? 90 : 34) : 0;
    list = generateEvents(a.automation_id, src, count, a.enabled ? null : a.updated_at);
    eventsCache.set(a.automation_id, list);
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* Minimal query hook (TanStack-shaped result: data/isLoading/isError/refetch). */
export type QueryResult<T> = { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; isFetching: boolean };
export type QueryOptions<T> = {
  enabled?: boolean;
  /** Keep the previous key's data while the new key loads. */
  keepPrevious?: boolean;
  /** Retry count for failures (default 3). 403/404 never retry (spec §17.1). */
  retry?: number;
  /** Poll interval in ms, or a function of the latest data returning ms/false (spec §18.2 active polling). */
  refetchInterval?: number | false | ((data: T | undefined) => number | false);
};

export function isNotFoundError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { status?: number }).status === 404;
}

export function useQuery<T>(key: string, fn: () => Promise<T>, opts?: QueryOptions<T>): QueryResult<T> {
  const enabled = opts?.enabled ?? true;
  const retry = opts?.retry ?? 3;
  const ver = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const [state, setState] = useState<{ key: string; data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; isFetching: boolean; tick: number }>({ key, data: undefined, isLoading: enabled, isError: false, error: null, isFetching: enabled, tick: 0 });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  const intervalRef = useRef(opts?.refetchInterval); intervalRef.current = opts?.refetchInterval;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, key, isFetching: true, isLoading: s.key === key && s.data !== undefined ? false : s.data === undefined }));
    const run = async () => {
      let attempt = 0;
      for (;;) {
        try { return await fnRef.current(); }
        catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 403 || status === 404 || attempt >= retry) throw e;
          attempt++; await delay(Math.min(1000 * 2 ** (attempt - 1), 30_000));
        }
      }
    };
    run().then((data) => { if (alive) setState({ key, data, isLoading: false, isError: false, error: null, isFetching: false, tick }); })
      .catch((error) => { if (alive) setState((s) => ({ ...s, key, isLoading: false, isError: true, error, isFetching: false })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick, ver, retry]);
  // Active polling: re-run when the interval (possibly derived from the latest data) says so.
  const data = state.key === key || opts?.keepPrevious ? state.data : undefined;
  useEffect(() => {
    if (!enabled) return;
    const iv = intervalRef.current;
    const ms = typeof iv === "function" ? iv(data) : iv;
    if (!ms) return;
    const h = window.setTimeout(() => setTick((x) => x + 1), ms);
    return () => window.clearTimeout(h);
  }, [enabled, data, tick]);
  return { data, isLoading: enabled && (state.key !== key ? true : state.isLoading), isError: state.key === key && state.isError, error: state.error, isFetching: state.isFetching, refetch: () => setTick((x) => x + 1) };
}

/** Subscribe to the toggle-pending set for one automation id (re-renders through the store version). */
export function useTogglePending(id: string): boolean {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store.isTogglePending(id);
}
