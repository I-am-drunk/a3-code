import catalog from "./en.automations.json";

/**
 * Exact English copy for the Automations surface.
 * Keys and values are the 1,030-row leaf catalog recovered from
 * `en-LsZoLY02.js` (identifier `m`, bytes 9124–63424).
 *
 * `t('showingRange', {from: 1, to: 50, total: 120})` → "1–50 of 120"
 * Plural keys use the i18next suffix convention: `eventsCount_one` / `_other`.
 */
type Catalog = Record<string, string>;
const dict: Catalog = catalog as Catalog;

export type TVars = Record<string, string | number | null | undefined>;

export function t(key: string, vars?: TVars): string {
  let template: string | undefined = dict[key];
  if (template === undefined && vars && typeof vars.count === "number") {
    template = dict[`${key}_${vars.count === 1 ? "one" : "other"}`];
  }
  if (template === undefined) {
    // Faithful to i18next `defaultValue` fallback used by format-DkE9yMWT.js
    return typeof vars?.defaultValue === "string" ? vars.defaultValue : key;
  }
  return interpolate(template, vars);
}

export function has(key: string): boolean {
  return key in dict;
}

export function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v === null || v === undefined ? "" : String(v);
  });
}

/**
 * Exact port of `format-DkE9yMWT.js`: one-colon fallback "Source: event name",
 * then localized lookup `automations.eventType_<source>_<event>` with defaultValue.
 */
export function formatEventType(eventType: string): string {
  const parts = eventType.split(":");
  let fallback = eventType;
  if (parts.length === 2) {
    const [source, event] = parts;
    fallback = `${source.charAt(0).toUpperCase()}${source.slice(1)}: ${event.replace(/_/g, " ")}`;
  }
  return t(`eventType_${eventType.replace(/:/g, "_")}`, { defaultValue: fallback });
}
