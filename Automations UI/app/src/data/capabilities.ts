import { useSyncExternalStore } from "react";
import type { ConnectionState } from "@/model/types";

/**
 * Runtime gate port (spec §20.5, §21 gate truth tables, Appendix F G-08). Devin resolves these from
 * auth/permission/feature hooks whose product names are not preserved in the bundle, so they are
 * modeled here as one explicit, swappable object instead of literals scattered through the UI.
 * Toggle at runtime from the console: `window.__automationsCaps.set({ spendingFrozen: true })`.
 */
export type Capabilities = {
  /** Org-level automation management predicate (create/edit/delete/run/toggle). */
  canManageAutomations: boolean;
  /** Security (code-scan) automation management predicate. */
  canManageCodeScan: boolean;
  /** Enterprise ACU usage limit reached — disables Create/Generate/Run/Save with the shared tooltip. */
  spendingFrozen: boolean;
  /** Analytics icon destination branch, or null to hide the icon. */
  analyticsDestination: "analytics" | "usage" | null;
  /** `View errors` overflow item + failed-bar links to `/automations/<id>/error-logs`. */
  errorLogs: boolean;
  /** Preflight code-step capability (editor section + events column). */
  preflight: boolean;
  /** First-use intro modal runtime flag. */
  introEnabled: boolean;
  /** On-call responders second list source. */
  oncall: boolean;
  /** Legacy monitor → issue-tracking migration banner predicate. */
  legacyMonitorMigration: boolean;
  /** Consumption formatting preference. */
  consumptionDisplay: "acu" | "usd";
  /** Plan slug used by the sub-hourly schedule entitlement check. */
  planSlug: "free" | "core" | "team" | "enterprise";
  /** Integration connection states keyed by integration slug (`github`, `slack`, `linear`, …). */
  connections: Record<string, ConnectionState>;
  /** Connection lookup lifecycle — drives template availability filtering (spec §7.1). */
  connectionsState: "ready" | "loading" | "error";
  /** Trigger event types the runtime reports as unsupported. */
  unsupportedEventTypes: string[];
  permissions: { manageOrgSecrets: boolean; manageSecurityProfiles: "enterprise" | "org" | null };
};

let caps: Capabilities = {
  canManageAutomations: true,
  canManageCodeScan: true,
  spendingFrozen: false,
  analyticsDestination: "analytics",
  errorLogs: false,
  preflight: false,
  introEnabled: true,
  oncall: false,
  legacyMonitorMigration: false,
  consumptionDisplay: "acu",
  planSlug: "team",
  connections: { github: "connected", slack: "connected", sentry: "connected", datadog: "connected", linear: "connected", jira: "unknown", gitlab: "unknown", pylon: "unknown", incident_io: "unknown" },
  connectionsState: "ready",
  unsupportedEventTypes: [],
  permissions: { manageOrgSecrets: true, manageSecurityProfiles: "org" },
};

const listeners = new Set<() => void>();
export const capabilities = {
  get: () => caps,
  set(patch: Partial<Capabilities>) { caps = { ...caps, ...patch }; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useCapabilities(): Capabilities {
  return useSyncExternalStore(capabilities.subscribe, capabilities.get, capabilities.get);
}

declare global { interface Window { __automationsCaps?: typeof capabilities } }
if (typeof window !== "undefined") window.__automationsCaps = capabilities;
