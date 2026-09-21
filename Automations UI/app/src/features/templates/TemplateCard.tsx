import { Link } from "@tanstack/react-router";
import { Bug, FileText, HeartPulse, Monitor, Package, ShieldCheck, TestTube, TriangleAlert, Wrench, Brush } from "lucide-react";
import type { ReactNode } from "react";
import type { AutomationTemplate } from "@/model/types";
import { sourceOf, SourceIcon, hasSourceIcon } from "@/model/sources";
import { GitHubIcon, JiraIcon, LinearIcon, PylonIcon, SlackIcon, SentryIcon, DatadogIcon, McpGenericIcon } from "@/icons/brand";
import { Skeleton } from "@/ui/skeleton";
import { t } from "@/i18n/t";

/* ---------------- TemplateCard-mNWSVrH3.js ---------------- */
export type TemplateCategory = "monitoring" | "cicd" | "security" | "pm";
export const TEMPLATE_CATEGORIES: { key: TemplateCategory; labelKey: string }[] = [
  { key: "monitoring", labelKey: "categoryMonitoringTriage" },
  { key: "cicd", labelKey: "categoryCicdRelease" },
  { key: "security", labelKey: "categorySecurity" },
  { key: "pm", labelKey: "categoryProjectManagement" },
];
const CATEGORY_ALIASES: Record<string, TemplateCategory> = {
  "Monitoring & Triage": "monitoring", Monitoring: "monitoring", Triage: "monitoring",
  "CI/CD & Release": "cicd", "CI/CD": "cicd", Maintenance: "cicd", "Code Quality": "cicd",
  Security: "security", "Project Management": "pm",
};
export function normalizeTemplateCategory(c: string): TemplateCategory { return CATEGORY_ALIASES[c] ?? "cicd"; }

type IconFactory = (size: number) => ReactNode;
const GENERIC_ICONS: Record<string, IconFactory> = {
  ci: (s) => <Wrench size={s} />, alert: (s) => <TriangleAlert size={s} />, health: (s) => <HeartPulse size={s} />,
  bug: (s) => <Bug size={s} />, support: (s) => <Bug size={s} />, test: (s) => <TestTube size={s} />,
  package: (s) => <Package size={s} />, document: (s) => <FileText size={s} />, monitor: (s) => <Monitor size={s} />, security: (s) => <ShieldCheck size={s} />,
};
const MCP_ICONS: Record<string, IconFactory> = {
  sentry: (s) => <SentryIcon size={s} />, datadog: (s) => <DatadogIcon size={s} />, stripe: (s) => <McpGenericIcon size={s} />,
  sonarqube: (s) => <McpGenericIcon size={s} />, circleci: (s) => <McpGenericIcon size={s} />, metabase: (s) => <McpGenericIcon size={s} />,
  "cloudflare-audit-logs": (s) => <McpGenericIcon size={s} />, asana: (s) => <McpGenericIcon size={s} />, notion: (s) => <FileText size={s} />,
  figma: (s) => <McpGenericIcon size={s} />, atlassian: (s) => <JiraIcon size={s} />, jam: (s) => <McpGenericIcon size={s} />, hubspot: (s) => <McpGenericIcon size={s} />,
};
const INTEGRATION_ICONS: Record<string, IconFactory> = {
  github: (s) => <GitHubIcon size={s} />, slack: (s) => <SlackIcon size={s} />, linear: (s) => <LinearIcon size={s} />, jira: (s) => <JiraIcon size={s} />, pylon: (s) => <PylonIcon size={s} />,
};
export const MCP_LABELS: Record<string, string> = {
  sentry: "Sentry", datadog: "Datadog", stripe: "Stripe", sonarqube: "SonarQube", circleci: "CircleCI", metabase: "Metabase",
  "cloudflare-audit-logs": "Cloudflare", asana: "Asana", notion: "Notion", figma: "Figma", atlassian: "Jira", jam: "Jam", hubspot: "HubSpot",
};
export const INTEGRATION_LABELS: Record<string, string> = { github: "GitHub", slack: "Slack", linear: "Linear", jira: "Jira", pylon: "Pylon" };

export function getMcpIcon(slug: string, size: number) { return MCP_ICONS[slug]?.(size); }
export function getIntegrationIcon(slug: string, size: number) { return INTEGRATION_ICONS[slug]?.(size); }

/** `G` — first trigger source glyph wins; else icon key; else `ci`; else broom. */
export function getTemplateIcon(tpl: AutomationTemplate): ReactNode {
  const src = sourceOf(tpl.triggers[0]?.event_type);
  if (src && hasSourceIcon(src)) return <SourceIcon source={src} size={16} />;
  return (GENERIC_ICONS[tpl.icon] ?? GENERIC_ICONS.ci)?.(16) ?? <Brush size={16} />;
}

export function TemplateCard({ template }: { template: AutomationTemplate }) {
  const ints = template.required_integrations, mcps = template.required_mcps;
  const hasReq = ints.length > 0 || mcps.length > 0;
  return (
    <Link
      to="/automations/create"
      search={{ template: template.template_id }}
      className="flex min-h-[126px] flex-col gap-3 overflow-hidden rounded-xl border border-border-secondary bg-bg-elevated p-4 hover:border-border-primary hover:bg-bg-wash"
    >
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 text-text-primary">{getTemplateIcon(template)}</span>
        <span className="text-13 font-medium leading-snug text-text-primary">{template.name}</span>
      </div>
      <p className="line-clamp-2 min-h-0 shrink text-12 text-text-secondary">{template.description}</p>
      {hasReq && (
        <div className="flex flex-wrap gap-1.5">
          {ints.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded bg-tint-tertiary px-1.5 py-0.5 text-11">{getIntegrationIcon(s, 12)}{INTEGRATION_LABELS[s] ?? s}</span>
          ))}
          {mcps.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded bg-tint-tertiary px-1.5 py-0.5 text-11">{getMcpIcon(s, 12)}{MCP_LABELS[s] ?? s}</span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="min-h-[126px] rounded-xl border border-border-secondary p-4">
      <Skeleton className="mb-2 h-4 w-3/4 rounded" />
      <Skeleton className="mb-2 h-3 w-full rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  );
}

export function categoryLabel(key: TemplateCategory): string {
  return t(TEMPLATE_CATEGORIES.find((c) => c.key === key)!.labelKey);
}
