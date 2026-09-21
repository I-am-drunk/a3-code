import { t } from "@/i18n/t";

/**
 * Minimal port of rrule-DcV3ZM4v.js visual semantics used by the editor:
 * parse FREQ/INTERVAL/BYDAY/BYMONTHDAY/BYHOUR/BYMINUTE/DTSTART(TZID)/COUNT,
 * serialize back, classify presets, produce the human summary shown on cards.
 */
export type Freq = "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
export type ParsedRule = {
  freq: Freq;
  interval: number;
  byDay: number[];       // 0=Sunday … 6=Saturday (ir)
  byMonthDay: number | null;
  byHour: number | null;
  byMinute: number | null;
  tz: string;
  dtstart: string | null; // YYYYMMDDTHHMMSS in tz
  count: number | null;
  raw: string;
};

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: t("monday") }, { value: 2, label: t("tuesday") }, { value: 3, label: t("wednesday") },
  { value: 4, label: t("thursday") }, { value: 5, label: t("friday") }, { value: 6, label: t("saturday") }, { value: 0, label: t("sunday") },
];

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function parseRRule(raw: string): ParsedRule | null {
  if (!raw || !raw.trim()) return null;
  const out: ParsedRule = { freq: "DAILY", interval: 1, byDay: [], byMonthDay: null, byHour: null, byMinute: null, tz: browserTz(), dtstart: null, count: null, raw };
  const lines = raw.split(/\n|;(?=DTSTART)/);
  for (const part of lines.join("\n").split("\n")) {
    const line = part.trim();
    if (!line) continue;
    if (line.startsWith("DTSTART")) {
      const m = line.match(/^DTSTART(?:;TZID=([^:]+))?:(\d{8}T\d{6})Z?/);
      if (m) { if (m[1]) out.tz = m[1]; out.dtstart = m[2]; }
      continue;
    }
    const body = line.replace(/^RRULE:/, "");
    for (const kv of body.split(";")) {
      const [k, v] = kv.split("=");
      if (!k || v === undefined) continue;
      switch (k) {
        case "FREQ": if (["MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"].includes(v)) out.freq = v as Freq; else return null; break;
        case "INTERVAL": out.interval = Math.max(1, parseInt(v, 10) || 1); break;
        case "BYDAY": out.byDay = v.split(",").map((d) => DAY_CODES.indexOf(d)).filter((i) => i >= 0); break;
        case "BYMONTHDAY": out.byMonthDay = parseInt(v, 10) || null; break;
        case "BYHOUR": out.byHour = parseInt(v, 10); break;
        case "BYMINUTE": out.byMinute = parseInt(v, 10); break;
        case "COUNT": out.count = parseInt(v, 10); break;
        case "TZID": out.tz = v; break;
        default: break;
      }
    }
  }
  return out;
}

export function serializeRRule(p: Omit<ParsedRule, "raw">): string {
  const parts = [`FREQ=${p.freq}`];
  if (p.interval > 1) parts.push(`INTERVAL=${p.interval}`);
  if (p.freq === "WEEKLY" && p.byDay.length) parts.push(`BYDAY=${p.byDay.map((d) => DAY_CODES[d]).join(",")}`);
  if (p.freq === "MONTHLY" && p.byMonthDay) parts.push(`BYMONTHDAY=${p.byMonthDay}`);
  if (p.freq !== "MINUTELY" && p.freq !== "HOURLY" && p.byHour !== null) parts.push(`BYHOUR=${p.byHour}`);
  if (p.freq !== "MINUTELY" && p.byMinute !== null) parts.push(`BYMINUTE=${p.byMinute}`);
  if (p.count) parts.push(`COUNT=${p.count}`);
  const rule = `RRULE:${parts.join(";")}`;
  if (p.dtstart) return `DTSTART;TZID=${p.tz}:${p.dtstart}\n${rule}`;
  return `${rule};TZID=${p.tz}`.replace("RRULE:", "").replace(/;TZID=.*$/, "") + `;TZID=${p.tz}`;
}

/** Jittered minute: `[5,10,20,25,35,40,50,55][Math.floor(Math.random()*8)]`. */
export function jitteredMinute(): number {
  return [5, 10, 20, 25, 35, 40, 50, 55][Math.floor(Math.random() * 8)]!;
}

export function presetRule(kind: "hourly" | "daily" | "weekly", minute: number, tz = browserTz()): string {
  if (kind === "hourly") return serializeRRule({ freq: "HOURLY", interval: 1, byDay: [], byMonthDay: null, byHour: null, byMinute: minute, tz, dtstart: null, count: null });
  if (kind === "daily") return serializeRRule({ freq: "DAILY", interval: 1, byDay: [], byMonthDay: null, byHour: 9, byMinute: minute, tz, dtstart: null, count: null });
  return serializeRRule({ freq: "WEEKLY", interval: 1, byDay: [1], byMonthDay: null, byHour: 9, byMinute: minute, tz, dtstart: null, count: null });
}

export function oneTimeRule(date: Date, tz = browserTz()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const dt = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}00`;
  return `DTSTART;TZID=${tz}:${dt}\nRRULE:FREQ=DAILY;COUNT=1`;
}

export type Preset = "hourly" | "daily" | "weekly" | "one_time" | "custom";
export function classify(p: ParsedRule | null): Preset {
  if (!p) return "custom";
  if (p.count === 1 && p.dtstart) return "one_time";
  if (p.freq === "HOURLY" && p.interval === 1 && !p.byDay.length) return "hourly";
  if (p.freq === "DAILY" && p.interval === 1 && p.byHour !== null) return "daily";
  if (p.freq === "WEEKLY" && p.interval === 1 && p.byDay.length === 1 && p.byHour !== null) return "weekly";
  return "custom";
}

export function isOneTimeInFuture(p: ParsedRule): boolean {
  if (!p.dtstart) return false;
  const d = dtstartToDate(p);
  return d.getTime() > Date.now();
}
export function dtstartToDate(p: ParsedRule): Date {
  const s = p.dtstart!;
  return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15));
}

const two = (n: number) => String(n).padStart(2, "0");
export function timeLabel(h: number | null, m: number | null): string {
  return `${two(h ?? 0)}:${two(m ?? 0)}`;
}

export function ordinal(day: number): string {
  const v = day % 100;
  if (v >= 11 && v <= 13) return t("rruleDayOrdinalTh", { day });
  switch (day % 10) {
    case 1: return t("rruleDayOrdinalSt", { day });
    case 2: return t("rruleDayOrdinalNd", { day });
    case 3: return t("rruleDayOrdinalRd", { day });
    default: return t("rruleDayOrdinalTh", { day });
  }
}

/** Human summary (rrule-DcV3ZM4v.js summary generation, via copy keys rrule*). */
export function summarize(raw: string): string {
  const p = parseRRule(raw);
  if (!p) return t("rruleNoSchedule");
  if (p.count === 1 && p.dtstart) {
    const d = dtstartToDate(p);
    return t("rruleRunOnceOnInTimeZone", { datetime: d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }), timeZone: p.tz });
  }
  const time = timeLabel(p.byHour, p.byMinute);
  let freq: string;
  switch (p.freq) {
    case "MINUTELY": freq = p.interval === 1 ? t("rruleEveryMinute") : t("rruleEveryNMinutes", { interval: p.interval }); return freq;
    case "HOURLY": freq = p.interval === 1 ? t("rruleEveryHour") : t("rruleEveryNHours", { interval: p.interval }); return p.byMinute !== null ? `${freq} ${t("rruleAtMinute", { minute: two(p.byMinute) })}` : freq;
    case "DAILY": freq = p.interval === 1 ? t("rruleEveryDayLong") : t("rruleEveryNDays", { interval: p.interval }); break;
    case "WEEKLY": {
      const names = p.byDay.map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.label ?? "");
      const isWeekdays = p.byDay.length === 5 && [1, 2, 3, 4, 5].every((d) => p.byDay.includes(d));
      const isWeekends = p.byDay.length === 2 && p.byDay.includes(0) && p.byDay.includes(6);
      if (p.interval === 1 && p.byDay.length === 1) freq = t("rruleEveryNamedDay", { day: names[0] });
      else if (p.interval === 1 && isWeekdays) freq = `${t("rruleWeekly")} ${t("rruleOnWeekdays")}`;
      else if (p.interval === 1 && isWeekends) freq = `${t("rruleWeekly")} ${t("rruleOnWeekends")}`;
      else freq = `${p.interval === 1 ? t("rruleWeekly") : t("rruleEveryNWeeks", { interval: p.interval })} ${t("rruleOnDays", { days: names.join(", ") })}`;
      break;
    }
    case "MONTHLY": freq = p.interval === 1 ? t("rruleMonthlyOnDay", { dayOrdinal: ordinal(p.byMonthDay ?? 1) }) : t("rruleEveryNMonthsOnDay", { interval: p.interval, dayOrdinal: ordinal(p.byMonthDay ?? 1) }); break;
  }
  return `${freq} ${t("rruleAtTimeInTimeZone", { time, timeZone: p.tz })}`;
}

/** Validator subset — rejects empty, EXDATE/RDATE, SECONDLY, COUNT+UNTIL, unknown props. */
export function validateRRule(raw: string): string | null {
  const v = raw.trim();
  if (!v) return t("scheduleTriggerRequired");
  if (/EXDATE|RDATE/.test(v)) return "EXDATE/RDATE are not supported";
  if (/FREQ=SECONDLY/.test(v)) return "SECONDLY is not supported";
  if (/COUNT=/.test(v) && /UNTIL=/.test(v)) return "COUNT and UNTIL cannot be combined";
  const p = parseRRule(v);
  if (!p) return "Unsupported FREQ";
  if (!/FREQ=/.test(v)) return "Missing FREQ";
  for (const kv of v.replace(/DTSTART[^\n]*\n?/, "").replace(/^RRULE:/, "").split(";")) {
    const k = kv.split("=")[0];
    if (k && !["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYHOUR", "BYMINUTE", "COUNT", "TZID", "UNTIL", "WKST", "BYMONTH", "RRULE:FREQ"].includes(k.replace(/^RRULE:/, ""))) return `Unknown property ${k}`;
  }
  if (p.byHour !== null && (p.byHour < 0 || p.byHour > 23)) return t("hourRange");
  if (p.byMinute !== null && (p.byMinute < 0 || p.byMinute > 59)) return t("minuteRange");
  if (p.count !== null && p.count !== 1) return "COUNT must be 1 for one-time schedules";
  return null;
}

export function isSubHourly(p: ParsedRule | null): boolean {
  return !!p && p.freq === "MINUTELY";
}
