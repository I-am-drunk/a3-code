import type { AutomationEvent, AutomationIssue, ConsumptionRow, EventStatus, Invocation } from "@/model/types";

/** Deterministic pseudo-random so the mock backend is stable across reloads. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const MESSAGES: Record<string, string[]> = {
  github: ["PR #{n} opened: Fix null deref in session reaper", "PR #{n} opened: Add retry to webhook delivery", "Check run failed: unit-tests (ubuntu) on main", "PR #{n} opened: Bump vite to 7.3", "PR #{n} opened: Migrate settings page to base-ui"],
  slack: ["@Devin login redirect loops on Safari 17", "Customer reports 500 on /export when filters include emoji", "Billing page shows stale plan after upgrade", "Webhook retries stuck in queued state for org 4412"],
  webhook: ["Datadog monitor: API p99 latency > 1.2s (prod-us-east)", "Datadog monitor: error rate > 2% on checkout-service"],
  snapshot_build: ["Snapshot build completed for main @ 4e1f9c2"],
};

export function generateEvents(automationId: string, source: string, count: number, disabledSince?: string | null): AutomationEvent[] {
  const r = rng(automationId.split("").reduce((a, c) => a + c.charCodeAt(0), 7));
  const out: AutomationEvent[] = [];
  const now = Date.now();
  const spanMs = 30 * 86_400_000;
  for (let i = 0; i < count; i++) {
    const t = now - Math.floor(r() * spanMs);
    if (disabledSince && t > new Date(disabledSince).getTime()) continue;
    const roll = r();
    const status: EventStatus = i === 0 && source !== "schedule" ? "running" : roll < 0.72 ? "succeeded" : roll < 0.86 ? "failed" : roll < 0.94 ? "skipped" : roll < 0.97 ? "canceled" : "queued";
    const pool = MESSAGES[source];
    const msg = pool ? pool[Math.floor(r() * pool.length)]!.replace("{n}", String(1200 + Math.floor(r() * 400))) : null;
    out.push({
      event_id: `${automationId}_ev_${i}`,
      status,
      created_at: new Date(t).toISOString(),
      event_type: source === "schedule" ? "schedule:recurring" : `${source}:event`,
      trigger_id: null,
      event_message: msg,
      event_resource_url: source === "github" && msg?.startsWith("PR") ? `https://github.com/diddletime/web/pull/${msg.match(/#(\d+)/)?.[1] ?? "1"}` : null,
      error_message: status === "failed" ? ["Session exceeded ACU limit before completing", "Repository clone failed: permission denied", "Prompt rejected by governing security profile"][Math.floor(r() * 3)] : null,
      devin_session_id: status === "skipped" || status === "queued" ? null : `devin-${Math.floor(r() * 1e9).toString(36)}`,
      code_step_run_id: null,
    });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function generateIssues(automationId: string): AutomationIssue[] {
  const r = rng(automationId.length * 977);
  const titles = [
    ["Login redirect loops on Safari", "Users on Safari 17 are bounced between /login and /app after SSO."],
    ["Export fails with emoji filters", "The /export endpoint returns 500 when a saved filter contains emoji."],
    ["Stale plan after upgrade", "Billing page keeps showing the previous plan for ~10 minutes after upgrading."],
    ["Webhook retries stuck queued", "Retries for org 4412 never leave the queued state."],
    ["Slow dashboard load for large orgs", "Orgs with >5k sessions see 8–12s dashboard loads."],
  ];
  return titles.map(([title, desc], i) => {
    const first = Date.now() - Math.floor(r() * 26 * 86_400_000) - 86_400_000;
    return {
      issue_id: `${automationId}_iss_${i}`,
      title, short_description: desc,
      first_invocation_at: new Date(first).toISOString(),
      last_invocation_at: new Date(first + Math.floor(r() * 3 * 86_400_000)).toISOString(),
      occurrence_count: 1 + Math.floor(r() * 9),
    };
  });
}

export function generateConsumption(automationId: string, days = 30): ConsumptionRow[] {
  const r = rng(automationId.length * 31 + 5);
  const rows: ConsumptionRow[] = [];
  for (let i = 0; i < days; i++) {
    if (r() < 0.35) continue;
    const d = new Date(); d.setDate(d.getDate() - i);
    rows.push({ created_at: d.toISOString().slice(0, 10), acu_used: Math.round(r() * 60) / 10 });
  }
  return rows;
}

export function sparklineBuckets(events: AutomationEvent[], days = 30): number[] {
  const buckets = new Array<number>(days + 1).fill(0);
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days);
  for (const e of events) {
    const idx = Math.floor((new Date(e.created_at).getTime() - start.getTime()) / 86_400_000);
    if (idx >= 0 && idx <= days) buckets[idx]!++;
  }
  return buckets;
}

/** Linked invocations for one issue (spec §18.5): investigated records carry an investigation session id; the rest are grouped/skipped. */
export function generateInvocations(automationId: string, issueId: string, count = 6): Invocation[] {
  const r = rng(issueId.split("").reduce((a, c) => a + c.charCodeAt(0), 13));
  const pool = MESSAGES.slack!;
  const out: Invocation[] = [];
  const base = Date.now() - Math.floor(r() * 20 * 86_400_000);
  for (let i = 0; i < count; i++) {
    const investigated = i === 0 || r() < 0.3;
    out.push({
      invocation_id: `${issueId}_inv_${i}`,
      created_at: new Date(base - i * Math.floor(r() * 2 * 86_400_000) - i * 3_600_000).toISOString(),
      status: investigated ? (r() < 0.8 ? "succeeded" : "failed") : "skipped",
      event_message: pool[Math.floor(r() * pool.length)] ?? null,
      investigation_devin_id: investigated ? `devin-${Math.floor(r() * 1e9).toString(36)}` : null,
      devin_session_id: null,
      grouped: !investigated,
      issue_id: issueId,
    });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
