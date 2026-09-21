import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AutomationTemplate } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { CURRENT_USER_ID, MCP_CATALOG } from "@/data/seed";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { SegmentedTab, SegmentedTabs, TabCount } from "@/ui/segmented";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { INTEGRATION_LABELS, MCP_LABELS, TEMPLATE_CATEGORIES, TemplateCard, TemplateCardSkeleton, normalizeTemplateCategory, type TemplateCategory } from "./TemplateCard";


/** Exact port of templates-79NPCJA-.js `Y` — AutomationTemplatesPage. */
export function TemplatesPage() {
  useEffect(() => { document.title = t("templates"); }, []);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cat, setCat] = useState<"all" | TemplateCategory>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);
  const closeSearch = () => { setQuery(""); setSearchOpen(false); };

  const templates = useQuery("templates", () => store.templates());
  const mine = useQuery("automations", () => store.list());
  const usedIds = useMemo(() => new Set((mine.data ?? []).filter((a) => a.created_by === CURRENT_USER_ID).map((a) => a.template_id).filter(Boolean) as string[]), [mine.data]);
  const installed = useMemo(() => new Set(MCP_CATALOG.filter((m) => m.is_installed).map((m) => m.slug)), []);

  // Availability (spec §7.1): a template is removed when a required integration is exactly `disconnected`
  // or one of its trigger event types is runtime-unsupported. While connections load the gallery stays
  // loading; if the connection lookup failed, server templates pass through unfiltered.
  const { connections, connectionsState, unsupportedEventTypes } = useCapabilities();
  const base = useMemo<AutomationTemplate[]>(() => {
    const all = templates.data ?? [];
    if (connectionsState === "error") return all;
    return all.filter((tpl) =>
      !tpl.required_integrations.some((i) => connections[i] === "disconnected") &&
      !tpl.triggers.some((tr) => unsupportedEventTypes.includes(tr.event_type)));
  }, [templates.data, connections, connectionsState, unsupportedEventTypes]);
  const ranked = useMemo(() => [...base].sort((a, b) => {
    const ua = usedIds.has(a.template_id);
    if (ua !== usedIds.has(b.template_id)) return ua ? 1 : -1;
    const ready = (x: AutomationTemplate) => x.required_integrations.every((i) => connections[i] === "connected") && x.required_mcps.every((m) => installed.has(m));
    const ra = ready(a), rb = ready(b);
    return ra === rb ? 0 : ra ? -1 : 1;
  }), [base, usedIds, installed, connections]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    const tokens = q.split(/\s+/);
    return ranked.filter((tpl) => {
      const hay = [tpl.name, tpl.description, tpl.category, ...tpl.tags, ...tpl.required_integrations.map((i) => `${i} ${INTEGRATION_LABELS[i] ?? ""}`), ...tpl.required_mcps.map((m) => `${m} ${MCP_LABELS[m] ?? ""}`)].join(" ").toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [ranked, query]);

  const counts = useMemo(() => {
    const c: Record<TemplateCategory, number> = { monitoring: 0, cicd: 0, security: 0, pm: 0 };
    for (const tpl of base) c[normalizeTemplateCategory(tpl.category)] += 1;
    return c;
  }, [base]);
  const byCategory = useMemo(() => (cat === "all" ? searched : searched.filter((tpl) => normalizeTemplateCategory(tpl.category) === cat)), [searched, cat]);
  const grouped = useMemo(() => TEMPLATE_CATEGORIES.map((tab) => ({ tab, templates: byCategory.filter((tpl) => normalizeTemplateCategory(tpl.category) === tab.key) })).filter((g) => g.templates.length > 0), [byCategory]);

  const loading = templates.isLoading || connectionsState === "loading", error = templates.isError;
  const showResults = !loading && (!error || base.length > 0);

  return (
    <div style={{ scrollbarGutter: "stable" }} className="flex size-full flex-col items-center overflow-y-auto py-3 sm:py-6">
      <div className="flex w-full max-w-[max(800px,50vw)] flex-col gap-4 px-2">
        <div className="mx-1 flex items-center justify-between gap-2"><h2 className="text-18 font-medium">{t("templates")}</h2></div>
        <div className="flex flex-col">
          <div className="mx-1 flex items-center justify-between gap-2 py-2">
            <SegmentedTabs variant="rounded" background={false} value={[cat]} className="min-w-0 overflow-x-auto">
              <SegmentedTab pressed={cat === "all"} onClick={() => setCat("all")} className="shrink-0 whitespace-nowrap">{t("all")}<TabCount value={base.length} /></SegmentedTab>
              {TEMPLATE_CATEGORIES.map((c) => (
                <SegmentedTab key={c.key} pressed={cat === c.key} onClick={() => setCat(c.key)} className="shrink-0 whitespace-nowrap">{t(c.labelKey)}<TabCount value={counts[c.key]} /></SegmentedTab>
              ))}
            </SegmentedTabs>
            <div className="flex shrink-0 items-center gap-0.5">
              {searchOpen ? (
                <InputGroup className="w-48">
                  <InputGroupAddon><Search /></InputGroupAddon>
                  <InputGroupInput ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }} onBlur={() => { if (!query.trim()) setSearchOpen(false); }} placeholder={t("searchTemplates")} />
                  <InputGroupAddon align="inline-end"><Button variant="ghost" size="sm" aria-label={t("closeSearch")} onClick={closeSearch}><X /></Button></InputGroupAddon>
                </InputGroup>
              ) : (
                <Tooltip content={t("search")}><Button variant="ghost" size="sm" aria-label={t("search")} onClick={() => setSearchOpen(true)}><Search /></Button></Tooltip>
              )}
            </div>
          </div>
          <div className="mx-1 flex flex-col gap-8 pt-4">
            {!loading && error && (
              <div role="alert" className={base.length > 0 ? "flex items-center justify-center gap-3 rounded-lg border border-border-secondary px-4 py-3" : "flex items-center justify-center gap-3 py-12"}>
                <span id="automation-templates-load-error" className="text-13 leading-[18px] text-text-secondary">{t("templatesLoadError")}</span>
                <Button variant="secondary" size="sm" aria-describedby="automation-templates-load-error" onClick={() => templates.refetch()}>{t("retry")}</Button>
              </div>
            )}
            {loading && <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <TemplateCardSkeleton key={i} />)}</div>}
            {showResults && cat === "all" && grouped.map((g) => (
              <div key={g.tab.key} className="flex flex-col gap-3">
                <h3 className="text-14 font-medium leading-5 text-text-primary">{t(g.tab.labelKey)}</h3>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{g.templates.map((tpl) => <TemplateCard key={tpl.template_id} template={tpl} />)}</div>
              </div>
            ))}
            {showResults && cat !== "all" && <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{byCategory.map((tpl) => <TemplateCard key={tpl.template_id} template={tpl} />)}</div>}
            {showResults && byCategory.length === 0 && <p className="py-8 text-center text-13 text-text-secondary">{query.trim() ? t("noTemplatesMatch") : t("noTemplatesFound")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
