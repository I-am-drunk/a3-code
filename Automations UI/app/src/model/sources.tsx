import { Calendar, Camera, ShieldCheck, Webhook } from "lucide-react";
import { GitHubIcon, GitLabIcon, IncidentIoIcon, JiraIcon, LinearIcon, PylonIcon, SlackIcon } from "@/icons/brand";
import type { Condition, Trigger } from "./types";
import { t } from "@/i18n/t";

/** Static source label map — TriggerEditor-D8VGRxC1.js:249-255,309-330. */
export const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  slack: "Slack",
  linear: "Linear",
  jira: "Jira",
  pylon: "Pylon",
  incident_io: "incident.io",
  schedule: "Schedule",
  webhook: "Webhook",
  code_scan: "Security scan",
  snapshot_build: "Snapshot build",
};

export function sourceOf(eventType: string | undefined | null): string {
  if (!eventType) return "";
  return eventType.split(":")[0] ?? "";
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? (source ? source.charAt(0).toUpperCase() + source.slice(1) : "");
}

export function SourceIcon({ source, size = 16, className }: { source: string; size?: number; className?: string }) {
  const s = size;
  switch (source) {
    case "github": return <GitHubIcon size={s} className={className} />;
    case "gitlab": return <GitLabIcon size={s} className={className} />;
    case "slack": return <SlackIcon size={s} className={className} />;
    case "linear": return <LinearIcon size={s} className={className} />;
    case "jira": return <JiraIcon size={s} className={className} />;
    case "pylon": return <PylonIcon size={s} className={className} />;
    case "incident_io": return <IncidentIoIcon size={s} className={className} />;
    case "schedule": return <Calendar size={s} className={className} aria-hidden="true" />;
    case "webhook": return <Webhook size={s} className={className} aria-hidden="true" />;
    case "code_scan": return <ShieldCheck size={s} className={className} aria-hidden="true" />;
    case "snapshot_build": return <Camera size={s} className={className} aria-hidden="true" />;
    default: return null;
  }
}

export function hasSourceIcon(source: string): boolean {
  return source in SOURCE_LABELS;
}

/** Event schema projection consumed by the editor (spec §9.1, Appendix I §12.1). */
export type SchemaField = {
  field: string;
  label: string;
  type: "string" | "enum" | "repo" | "number" | "boolean" | "channel" | "list";
  required?: boolean;
  options?: { value: string; label: string }[];
  group?: string;
};
export type EventSchema = { event_type: string; name: string; fields: SchemaField[] };

const repoField: SchemaField = { field: "repository", label: "Repository", type: "repo", group: "Repository" };
const actionEnum = (values: string[]): SchemaField => ({
  field: "action", label: "Action", type: "enum", options: values.map((v) => ({ value: v, label: v })),
});

/**
 * Runtime schema inventory reproduced from the events the bundle handles directly.
 * Order of sources follows `Object.entries(schemasBySource)` as served for the observed
 * tenant: GitHub, Schedule, Webhook, Security scan, Snapshot build (live-ui 03).
 */
export const EVENT_SCHEMAS: Record<string, EventSchema[]> = {
  github: [
    { event_type: "github:issue_comment", name: "Issue comment", fields: [repoField, actionEnum(["created", "edited", "deleted"]), { field: "comment.body", label: "Comment body", type: "string", group: "Comment" }] },
    { event_type: "github:issues", name: "Issue", fields: [repoField, actionEnum(["opened", "edited", "closed", "reopened", "labeled", "assigned"]), { field: "issue.labels", label: "Labels", type: "list", group: "Issue" }] },
    { event_type: "github:pull_request", name: "Pull request", fields: [repoField, actionEnum(["opened", "synchronize", "closed", "reopened", "ready_for_review", "labeled"]), { field: "pull_request.base.ref", label: "Base branch", type: "string", group: "Pull Request" }, { field: "pull_request.draft", label: "Draft", type: "boolean", group: "Pull Request" }] },
    { event_type: "github:pull_request_review", name: "PR review", fields: [repoField, actionEnum(["submitted", "edited", "dismissed"]), { field: "review.state", label: "Review state", type: "enum", group: "Review", options: ["approved", "changes_requested", "commented"].map((v) => ({ value: v, label: v })) }] },
    { event_type: "github:pull_request_review_comment", name: "PR review comment", fields: [repoField, actionEnum(["created", "edited", "deleted"]), { field: "comment.body", label: "Comment body", type: "string", group: "Comment" }] },
    { event_type: "github:check_run", name: "Check run", fields: [repoField, actionEnum(["completed", "created", "rerequested"]), { field: "check_run.conclusion", label: "Conclusion", type: "enum", group: "Check Run", options: ["success", "failure", "cancelled", "timed_out", "neutral"].map((v) => ({ value: v, label: v })) }] },
    { event_type: "github:push", name: "Push", fields: [repoField, { field: "ref", label: "Ref", type: "string", group: "Commit" }, { field: "paths", label: "Paths", type: "list", group: "Commit" }] },
  ],
  schedule: [{ event_type: "schedule:recurring", name: "Recurring", fields: [] }],
  webhook: [{ event_type: "webhook:incoming", name: "Incoming webhook", fields: [] }],
  code_scan: [{ event_type: "code_scan:finding", name: "Security scan finding", fields: [{ field: "severity", label: "Severity", type: "enum", options: ["critical", "high", "medium", "low"].map((v) => ({ value: v, label: v })) }] }],
  snapshot_build: [{ event_type: "snapshot_build:completed", name: "Snapshot build completed", fields: [{ field: "status", label: "Status", type: "enum", options: ["succeeded", "failed"].map((v) => ({ value: v, label: v })) }] }],
  slack: [
    { event_type: "slack:message", name: "Message", fields: [{ field: "channel", label: "Channel", type: "channel" }, { field: "text", label: "Message text", type: "string" }, { field: "is_thread_reply", label: "Is thread reply", type: "boolean" }] },
    { event_type: "slack:reaction_added", name: "Reaction added", fields: [{ field: "channel", label: "Channel", type: "channel" }, { field: "reaction", label: "Reaction", type: "string" }] },
  ],
};

export const SCHEMA_SOURCE_ORDER = ["github", "slack", "schedule", "webhook", "code_scan", "snapshot_build"];

export function schemaFor(eventType: string): EventSchema | undefined {
  for (const list of Object.values(EVENT_SCHEMAS)) {
    const s = list.find((x) => x.event_type === eventType);
    if (s) return s;
  }
  return undefined;
}

export function eventName(eventType: string): string {
  return schemaFor(eventType)?.name ?? t(`eventType_${eventType.replace(/:/g, "_")}`, { defaultValue: eventType });
}

/** Xn — initial condition values (TriggerEditor-D8VGRxC1.js:373-391,2366-2377). */
export const DEFAULT_CONDITIONS: Record<string, Condition[]> = {
  "github:pull_request": [{ field: "action", operator: "eq", value: "opened" }],
  "github:issues": [{ field: "action", operator: "eq", value: "opened" }],
  "github:issue_comment": [{ field: "action", operator: "eq", value: "created" }],
  "github:pull_request_review": [{ field: "action", operator: "eq", value: "submitted" }],
  "github:pull_request_review_comment": [{ field: "action", operator: "eq", value: "created" }],
  "github:check_run": [{ field: "action", operator: "eq", value: "completed" }],
  "gitlab:merge_request": [{ field: "action", operator: "eq", value: "open" }],
  "gitlab:issue": [{ field: "action", operator: "eq", value: "open" }],
  "gitlab:pipeline": [{ field: "status", operator: "eq", value: "failed" }],
  "code_scan:finding": [{ field: "severity", operator: "in", value: ["critical", "high"] }],
};

export const SINGLETON_EVENTS = new Set(["webhook:incoming"]);
export const REPLY_SOURCES = new Set(["github", "gitlab", "jira", "linear"]);
export const REPLY_EXCLUDED_EVENTS = new Set(["github:push", "github:check_run", "gitlab:push", "gitlab:pipeline"]);

export const OPERATOR_LABEL: Record<string, string> = {
  eq: t("opEquals"), neq: t("opNotEquals"), in: t("opIn"), not_in: t("opNotIn"), contains: t("opContains"),
  not_contains: t("opNotContains"), starts_with: t("opStartsWith"), ends_with: t("opEndsWith"), matches: t("opMatches"),
  gt: t("opGt"), gte: t("opGte"), lt: t("opLt"), lte: t("opLte"), is_empty: t("opIsEmpty"), globs: t("opMatches"),
};

export function operatorsFor(field: SchemaField): string[] {
  switch (field.type) {
    case "enum": return ["eq", "neq", "in", "not_in"];
    case "boolean": return ["eq"];
    case "number": return ["eq", "neq", "gt", "gte", "lt", "lte"];
    case "list": return ["contains", "not_contains", "globs", "is_empty"];
    case "repo": return ["eq", "in"];
    case "channel": return ["eq", "in"];
    default: return ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "matches", "is_empty"];
  }
}

export function isSchedule(trigger: Trigger): boolean {
  return trigger.event_type === "schedule:recurring";
}
export function rruleOf(trigger: Trigger): string {
  const c = trigger.conditions?.[0]?.find((x) => x.field === "rrule");
  return typeof c?.value === "string" ? c.value : "";
}
