/**
 * Searchable IANA-derived timezone list in the observed label form
 * `(<GMT offset>) <long name> - <city>` (Appendix E: 419 labels; first entries
 * `(GMT+00:00) Greenwich Mean Time - Abidjan` …, last `(GMT+00:00) Coordinated Universal Time`).
 */
export type TzOption = { value: string; label: string };

function offsetLabel(tz: string, at = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    if (raw === "GMT" || raw === "UTC") return "GMT+00:00";
    return raw.replace(/^UTC/, "GMT");
  } catch { return "GMT+00:00"; }
}
/**
 * Zone family name. The observed labels (`Eastern Time - Toronto` during DST, but `Central European
 * Standard Time - Algiers`, `East Africa Time - Addis Ababa`, `Greenwich Mean Time - Abidjan`) match
 * Intl's `longGeneric` exactly, so that is used first with `long` as the fallback for older engines.
 */
function longName(tz: string, at = new Date()): string {
  for (const timeZoneName of ["longGeneric", "long"] as const) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName }).formatToParts(at);
      const v = parts.find((p) => p.type === "timeZoneName")?.value;
      if (v) return v;
    } catch { /* try the next form */ }
  }
  return tz;
}

let cache: TzOption[] | null = null;
export function timezoneOptions(): TzOption[] {
  if (cache) return cache;
  const intlWithSupported = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const zones = (intlWithSupported.supportedValuesOf?.("timeZone") ?? ["UTC", "America/New_York", "America/Toronto", "Europe/London"])
    .filter((z) => z !== "UTC" && !z.startsWith("Etc/"));
  const list: TzOption[] = zones.map((z) => {
    const city = (z.split("/").pop() ?? z).replace(/_/g, " ");
    return { value: z, label: `(${offsetLabel(z)}) ${longName(z)} - ${city}` };
  });
  list.sort((a, b) => a.value.split("/").pop()!.localeCompare(b.value.split("/").pop()!));
  list.push({ value: "UTC", label: "(GMT+00:00) Coordinated Universal Time" });
  cache = list;
  return list;
}
