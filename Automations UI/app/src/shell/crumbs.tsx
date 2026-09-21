import { useParams } from "@tanstack/react-router";
import { store, useQuery } from "@/data/store";
import { t } from "@/i18n/t";
import { Skeleton } from "@/ui/skeleton";

/** Breadcrumb label components, mirroring the route `staticData.crumb.label` components in app-initial-CiFT6-kZ.js. */
export function AutomationsCrumb() { return <>{t("title")}</>; }
export function TemplatesCrumb() { return <>{t("templates")}</>; }
export function NewAutomationCrumb() { return <>{t("newAutomation")}</>; }
export function ErrorLogsCrumb() { return <>{t("errorLogs", { defaultValue: "Error logs" })}</>; }

/** `Go`/`ad`: the automation's name, an 16px×96px skeleton while loading, `Automation` as fallback. */
export function AutomationNameCrumb() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const q = useQuery(`automation:${id}`, () => store.get(id!), { enabled: !!id });
  if (q.isLoading && !q.data) return <Skeleton className="h-4 w-24" />;
  return <>{q.data?.name ?? t("automationTitle")}</>;
}
