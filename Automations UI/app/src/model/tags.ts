/** tagColors-DaUCHgQm.js — first-seen key gets the next palette entry, cycling. */
const assigned: Record<string, string> = {};
const PALETTE = ["bg-text-blue", "bg-text-green", "bg-text-orange", "bg-text-purple", "bg-text-red"];
export function tagDotColor(key: string): string {
  if (!assigned[key]) assigned[key] = PALETTE[Object.keys(assigned).length % PALETTE.length]!;
  return assigned[key]!;
}

/** Reserved On-call metadata keys hidden from filters/chips (app-initial-CiFT6-kZ.js byte 8,854). */
export function isReservedTagKey(key: string): boolean {
  return key === "oncall_responder" || key === "oncall_digest" || key === "oncall_incident" || key.startsWith("oncall_report:");
}

export type TagFilter = { key: string; value: string };
export type TagCount = TagFilter & { count: number };

/** OR within a key, AND across keys (useQuery-CpMyOosR.js matcher). */
export function matchesTagFilters(item: { tags?: Record<string, string> }, filters: TagFilter[]): boolean {
  if (filters.length === 0) return true;
  const byKey = new Map<string, Set<string>>();
  for (const f of filters) {
    const s = byKey.get(f.key) ?? new Set<string>();
    s.add(f.value);
    byKey.set(f.key, s);
  }
  return Array.from(byKey).every(([k, values]) => values.has(item.tags?.[k] ?? ""));
}

/**
 * Facet counts: for key K ignore current selections of K but keep other-key filters;
 * selected values remain visible with zero counts (spec §6.2).
 */
export function computeTagCounts(items: { tags?: Record<string, string> }[], selected: TagFilter[]): TagCount[] {
  const keys = new Set<string>();
  for (const it of items) for (const k of Object.keys(it.tags ?? {})) if (!isReservedTagKey(k)) keys.add(k);
  for (const f of selected) if (!isReservedTagKey(f.key)) keys.add(f.key);
  const out: TagCount[] = [];
  for (const key of keys) {
    const others = selected.filter((f) => f.key !== key);
    const counts = new Map<string, number>();
    for (const it of items) {
      const v = it.tags?.[key];
      if (!v) continue;
      if (!matchesTagFilters(it, others)) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const f of selected) if (f.key === key && !counts.has(f.value)) counts.set(f.value, 0);
    for (const [value, count] of counts) out.push({ key, value, count });
  }
  return out;
}

export function encodeTagFilters(filters: TagFilter[]): string | undefined {
  if (!filters.length) return undefined;
  return filters.map((f) => `${encodeURIComponent(f.key)}:${encodeURIComponent(f.value)}`).join(",");
}
export function decodeTagFilters(raw: string | undefined): TagFilter[] {
  if (!raw) return [];
  const out: TagFilter[] = [];
  for (const part of raw.split(",")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    try {
      const key = decodeURIComponent(part.slice(0, idx));
      const value = decodeURIComponent(part.slice(idx + 1));
      if (key && value && !isReservedTagKey(key)) out.push({ key, value });
    } catch { /* malformed pair discarded */ }
  }
  return out;
}
