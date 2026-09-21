import { t } from "@/i18n/t";

/** AutomationListItem-DpZGEBDn.js:97-110 — `now`, `Xm ago` … `Xy ago`. */
export function shortAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t("shortAgoNow");
  if (m < 60) return t("shortAgoMinutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("shortAgoHours", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("shortAgoDays", { count: d });
  const w = Math.floor(d / 7);
  if (d < 30) return t("shortAgoWeeks", { count: w });
  const mo = Math.floor(d / 30);
  if (d < 365) return t("shortAgoMonths", { count: mo });
  return t("shortAgoYears", { count: Math.floor(d / 365) });
}

export function absoluteDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Abbreviated month/day/year — detail header origin line. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** format-C8G7tL8Z.js — narrow relative under 7 days, else abbreviated date. */
export function eventDate(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 7 * 86_400_000) {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always", style: "narrow" });
    const s = Math.round(diff / 1000);
    if (s < 60) return rtf.format(-s, "second");
    const m = Math.round(s / 60);
    if (m < 60) return rtf.format(-m, "minute");
    const h = Math.round(m / 60);
    if (h < 24) return rtf.format(-h, "hour");
    return rtf.format(-Math.round(h / 24), "day");
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function utcTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function localYmdHms(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
