import { Link, useParams } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { store, useQuery } from "@/data/store";
import { t } from "@/i18n/t";
import { eventDate } from "@/lib/time";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

/**
 * `/automations/<id>/error-logs`.
 *
 * Evidence status: Devin's route module (`automations._id_.error-logs-BACxz10I.js`) only redirects to the
 * org-scoped `/org/$orgName/automations/$id/error-logs` route, whose page module is not part of the captured
 * bundle. This page is therefore RECONSTRUCTED from the three catalog keys that belong to it
 * (`errorLogs`, `errorLogsDescription`, `errorLogsLoadError`) plus the shared events API shape — it is not
 * a decompiled port. Keep it minimal and replace it when the org-scoped module is captured.
 */
const LIMIT = 50;
const RANGE_DAYS = 90;

export function ErrorLogsPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const range = useMemo(() => {
    const until = new Date();
    const since = new Date(until.getTime() - RANGE_DAYS * 86_400_000);
    return { since: since.toISOString(), until: until.toISOString() };
  }, []);
  const events = useQuery(`error-logs:${id}`, () =>
    store.events(id, { since: range.since, until: range.until, status: ["failed"], limit: LIMIT, offset: 0, include_message: true }),
  );
  const rows = events.data?.data ?? [];

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-20 font-medium text-text-primary">{t("errorLogs")}</h1>
          {!events.isLoading && !events.isError && (
            <p className="text-13 text-text-secondary">{t("errorLogsDescription", { count: rows.length })}</p>
          )}
        </div>

        {events.isLoading ? (
          <div className="flex flex-col divide-y divide-border-secondary rounded-lg border border-border-secondary">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="ml-auto h-3 w-16" />
              </div>
            ))}
          </div>
        ) : events.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border-secondary px-4 py-10 text-center">
            <span className="text-13 text-text-secondary">{t("errorLogsLoadError")}</span>
            <Button variant="secondary" size="sm" onClick={() => events.refetch()}>{t("retry")}</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-border-secondary px-4 py-10">
            <span className="text-13 text-text-secondary">{t("noEvents")}</span>
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-border-secondary rounded-lg border border-border-secondary">
            {rows.map((ev) => {
              const sid = ev.devin_session_id ?? ev.investigation_devin_id ?? null;
              return (
                <li key={ev.event_id} className="flex items-start gap-3 px-4 py-3">
                  <span aria-hidden className="mt-[7px] size-2 shrink-0 rounded-full bg-text-red" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-13 text-text-primary">{ev.event_message ?? t("noEventMessage")}</span>
                    {ev.error_message && <span className="text-12 leading-4 text-text-secondary">{ev.error_message}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {sid && (
                      <Link to="/sessions/$id" params={{ id: sid }} className="inline-flex items-center gap-1 text-12 text-text-secondary hover:text-text-primary">
                        {t("viewSession")}
                        <ExternalLink size={12} />
                      </Link>
                    )}
                    <time dateTime={ev.created_at} className="whitespace-nowrap text-12 tabular-nums text-text-secondary">{eventDate(ev.created_at)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
