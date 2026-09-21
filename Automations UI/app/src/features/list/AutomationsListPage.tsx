import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, ChartColumn, ChevronDown, Info, Plus, Search, LayoutTemplate, X, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Automation, AutomationTemplate } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { CURRENT_USER_ID, SLACK_CHANNELS } from "@/data/seed";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { SegmentedTab, SegmentedTabs, TabCount } from "@/ui/segmented";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { SpendingFrozenTooltipContent } from "@/ui/spending-frozen";
import { DevinMark } from "@/icons/devin";
import { computeTagCounts, decodeTagFilters, encodeTagFilters, type TagFilter } from "@/model/tags";
import { AutomationTagFilter } from "./AutomationTagFilter";
import { AutomationsTable, AUTOMATIONS_PAGE_SIZE, ListPagination, ListSkeleton, useListPaging } from "./ListPagination";
import { TemplateCard, TemplateCardSkeleton, TEMPLATE_CATEGORIES, normalizeTemplateCategory, type TemplateCategory } from "@/features/templates/TemplateCard";
import { AutomationsIntroDialog } from "./AutomationsIntroDialog";
import { useGenerateWithDevin } from "@/features/editor/useGenerateWithDevin";

/* ---------------- Route search <-> filters (automations-0Mti9mBk.js pt/dt) ---------------- */
type Filters = { activeTab: "all" | "mine"; search: string; tagFilters: TagFilter[] };

/** `xe` + `be` + `ye.md` — shared page shell constants (app-initial-D152LYkn.js). */
const PAGE_PADDING_X = "px-4 sm:px-6";
const PAGE_PADDING_Y = "py-4 sm:py-8";
const PAGE_MAX_W_MD = "max-w-[min(1200px,max(50vw,800px))]";

const CREATION_CARD = "group relative flex flex-col gap-3 overflow-hidden rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-primary";

function DottedCorner() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 h-[110px] w-[150px] text-text-blue"
      style={{
        backgroundImage: "radial-gradient(circle, currentColor 1.3px, transparent 1.4px)",
        backgroundSize: "9px 9px",
        maskImage: "radial-gradient(130% 130% at 100% 0%, black 25%, transparent 68%)",
        WebkitMaskImage: "radial-gradient(130% 130% at 100% 0%, black 25%, transparent 68%)",
      }}
    />
  );
}

function CreationCardBody({ icon, title, description, footer, highlighted }: { icon: React.ReactNode; title: string; description: string; footer: string; highlighted?: boolean }) {
  return (
    <>
      {highlighted && <DottedCorner />}
      <span className={cn("flex size-7 items-center justify-center rounded-md", highlighted ? "bg-tint-blue text-text-blue" : "bg-tint-secondary text-text-primary")}>{icon}</span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-13 font-medium text-text-primary">{title}</span>
        <span className="text-pretty text-12 leading-4 text-text-secondary">{description}</span>
      </span>
      <span className={cn("mt-auto flex items-center gap-1 text-12", highlighted ? "text-text-blue" : "text-text-secondary")}>{footer}<ArrowRight size={12} /></span>
    </>
  );
}

function CreationLinkCard({ to, disabled, children }: { to: string; disabled?: boolean; children: React.ReactNode }) {
  return disabled
    ? <div className={cn(CREATION_CARD, "opacity-60")}>{children}</div>
    : <Link to={to} className={cn(CREATION_CARD, "hover:bg-tint-tertiary")}>{children}</Link>;
}

/** `Xt` — first-use creation entry cards + suggested templates. */
function CreationEntry({ createDisabled = false }: { createDisabled?: boolean }) {
  const { generateWithDevin, isGenerating } = useGenerateWithDevin();
  const templates = useQuery("templates", () => store.templates());
  const [cat, setCat] = useState<"all" | TemplateCategory>("all");
  const filtered = (templates.data ?? []).filter((tpl) => cat === "all" || normalizeTemplateCategory(tpl.category) === cat);
  return (
    <div className="flex flex-col gap-12 pt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tooltip content={<SpendingFrozenTooltipContent />} disabled={!createDisabled}>
          <button type="button" onClick={() => generateWithDevin()} disabled={isGenerating || createDisabled} className={cn(CREATION_CARD, "bg-tint-blue hover:brightness-[0.98] disabled:opacity-60")}>
            <CreationCardBody highlighted icon={<DevinMark size={16} />} title={t("generateWithDevin")} description={t("generateWithDevinCardDescription")} footer={t("mostPopular")} />
          </button>
        </Tooltip>
        <Tooltip content={<SpendingFrozenTooltipContent />} disabled={!createDisabled}>
          <CreationLinkCard to="/automations/create" disabled={createDisabled}>
            <CreationCardBody icon={<Plus size={16} />} title={t("createManually")} description={t("createManuallyCardDescription")} footer={t("lessCommon")} />
          </CreationLinkCard>
        </Tooltip>
        <Tooltip content={<SpendingFrozenTooltipContent />} disabled={!createDisabled}>
          <CreationLinkCard to="/automations/templates" disabled={createDisabled}>
            <CreationCardBody icon={<LayoutTemplate size={16} />} title={t("createFromTemplate")} description={t("createFromTemplateCardDescription")} footer={t("lessCommon")} />
          </CreationLinkCard>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-14 font-medium text-text-secondary">{t("suggestedAutomations")}</h3>
        <SegmentedTabs variant="rounded" background={false} value={[cat]} className="min-w-0 overflow-x-auto">
          <SegmentedTab pressed={cat === "all"} onClick={() => setCat("all")} className="shrink-0 whitespace-nowrap">{t("all")}</SegmentedTab>
          {TEMPLATE_CATEGORIES.map((c) => (
            <SegmentedTab key={c.key} pressed={cat === c.key} onClick={() => setCat(c.key)} className="shrink-0 whitespace-nowrap">{t(c.labelKey)}</SegmentedTab>
          ))}
        </SegmentedTabs>
        {!templates.isLoading && templates.isError && (
          <div role="alert" className="flex items-center justify-center gap-3 rounded-lg border border-border-secondary px-4 py-3">
            <span id="suggested-automation-templates-load-error" className="text-13 leading-[18px] text-text-secondary">{t("templatesLoadError")}</span>
            <Button variant="secondary" size="sm" aria-describedby="suggested-automation-templates-load-error" onClick={() => templates.refetch()}>{t("retry")}</Button>
          </div>
        )}
        {(templates.isLoading || filtered.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.isLoading ? Array.from({ length: 6 }).map((_, i) => <TemplateCardSkeleton key={i} />) : filtered.map((tpl: AutomationTemplate) => <TemplateCard key={tpl.template_id} template={tpl} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Intro dismissal storage key (verbatim: dismissal hook keyed by `automations-intro`). */
const INTRO_DISMISSED_KEY = "automations-intro";
/** Shared exclusion predicate `Qe` (app-initial-CLVUQCN6.js): On-call responders never appear in the main list. */
function isExcludedFromMainList(a: Automation): boolean { return a.tags?.["oncall_responder"] === "true"; }
/** `_n` — code-scan automations route under /security. */
function isCodeScanAutomation(a: Automation): boolean { return a.triggers.some((tr) => tr.event_type === "code_scan:finding"); }
function isEditable(el: Element | null): boolean {
  return el instanceof HTMLElement ? el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable : false;
}

/* ---------------- `xn` — AutomationsPage ---------------- */
export function AutomationsListPage() {
  const search = useSearch({ from: "/automations/" });
  const navigate = useNavigate();
  const initial = useMemo<Filters>(() => ({ activeTab: search.tab === "mine" ? "mine" : "all", search: search.q ?? "", tagFilters: decodeTagFilters(search.tags) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<Filters["activeTab"]>(initial.activeTab);
  const [searchText, setSearchText] = useState(initial.search);
  const [tagFilters, setTagFilters] = useState<TagFilter[]>(initial.tagFilters);
  const [searchOpen, setSearchOpen] = useState(initial.search.length > 0);
  const caps = useCapabilities();
  const canManage = caps.canManageAutomations;
  const spendingFrozen = caps.spendingFrozen;
  const analyticsDestination = caps.analyticsDestination;
  const [introOpen, setIntroOpen] = useState(() => caps.introEnabled && !localStorage.getItem(INTRO_DISMISSED_KEY));
  const searchRef = useRef<HTMLInputElement>(null);

  const writeUrl = useCallback((patch: Partial<Filters>) => {
    const next: Filters = { activeTab, search: searchText, tagFilters, ...patch };
    navigate({
      to: "/automations",
      replace: true,
      search: () => ({ tab: next.activeTab === "mine" ? ("mine" as const) : undefined, q: next.search || undefined, tags: encodeTagFilters(next.tagFilters) }),
    });
  }, [activeTab, searchText, tagFilters, navigate]);

  const primary = useQuery("automations", () => store.list());
  const secondaryEnabled = caps.oncall;
  const secondary = useQuery("automations:responders", () => store.listResponders(), { enabled: secondaryEnabled });
  const list = {
    isLoading: primary.isLoading || (secondaryEnabled && secondary.isLoading),
    isError: primary.isError || (secondaryEnabled && secondary.isError),
    refetch: () => { primary.refetch(); if (secondaryEnabled) secondary.refetch(); },
  };
  const sparks = useQuery("sparklines", () => store.sparklines());
  const automations: Automation[] = useMemo(
    () => [...(primary.data ?? []), ...(secondaryEnabled ? secondary.data ?? [] : [])].filter((a) => !isExcludedFromMainList(a)),
    [primary.data, secondary.data, secondaryEnabled],
  );
  const sparklineMap = useMemo(() => new Map(Object.entries(sparks.data ?? {})), [sparks.data]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "f") return;
      if (document.querySelector("[role=dialog],[role=alertdialog]")) return;
      const active = document.activeElement;
      if (isEditable(active) && active !== searchRef.current) return;
      e.preventDefault();
      setSearchOpen(true);
      requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const getCreatorName = useCallback((a: Automation) => a.created_by_service_user_name ?? store.userName(a.created_by) ?? "", []);
  const getMonitorChannelLabel = useCallback((a: Automation) => {
    const act = a.actions.find((x) => x.type === "monitor_session" || x.type === "triage_session");
    if (!act) return null;
    const id = act.type === "monitor_session" ? act.slack_monitor_config?.source_channel_id : act.type === "triage_session" ? act.slack_config?.source_channel_id : null;
    const ch = SLACK_CHANNELS.find((c) => c.channel_id === id);
    return ch ? `#${ch.name}` : null;
  }, []);

  const tabItems = useMemo(() => (activeTab === "mine" ? automations.filter((a) => a.created_by === CURRENT_USER_ID) : automations), [automations, activeTab]);
  const tagCounts = useMemo(() => computeTagCounts(tabItems, tagFilters), [tabItems, tagFilters]);
  const { visibleItems, pagedItems, pagination, sortState, sortHandlers } = useListPaging({ items: tabItems, search: searchText, tagFilters, getCreatorName, getChannelLabel: getMonitorChannelLabel, resetKey: activeTab });

  const setTab = (tab: Filters["activeTab"]) => { setActiveTab(tab); writeUrl({ activeTab: tab }); };
  const setSearchValue = (v: string) => { setSearchText(v); writeUrl({ search: v }); };
  const setTags = (f: TagFilter[]) => { setTagFilters(f); writeUrl({ tagFilters: f }); };
  const closeSearch = () => { setSearchValue(""); setSearchOpen(false); };

  const mineCount = useMemo(() => automations.filter((a) => a.created_by === CURRENT_USER_ID).length, [automations]);
  const hasSource = automations.length > 0;
  const { generateWithDevin, isGenerating } = useGenerateWithDevin();
  const showErrorInline = list.isError && hasSource;

  return (
    <>
      <div style={{ scrollbarGutter: "stable" }} className={cn("flex size-full flex-col items-center overflow-y-auto", PAGE_PADDING_Y)}>
        <div className={cn("flex w-full flex-col gap-4", PAGE_PADDING_X, PAGE_MAX_W_MD)}>
          <div className="mx-1 flex flex-col gap-1">
            <h2 className="text-18 font-medium">{t("title")}</h2>
            <p className="text-13 text-text-secondary">{t("subtitle")}</p>
          </div>
          {list.isLoading && <ListSkeleton />}
          {!list.isLoading && (
            <div className="flex flex-col">
              <div className="mx-1 flex items-center justify-between gap-2">
                <SegmentedTabs variant="rounded" background={false} value={[activeTab]}>
                  <SegmentedTab pressed={activeTab === "all"} onClick={() => setTab("all")}>{t("all")}<TabCount value={automations.length} /></SegmentedTab>
                  <SegmentedTab pressed={activeTab === "mine"} onClick={() => setTab("mine")}>{t("createdByYou")}<TabCount value={mineCount} /></SegmentedTab>
                </SegmentedTabs>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {searchOpen ? (
                      <InputGroup className="w-56">
                        <InputGroupAddon><Search /></InputGroupAddon>
                        <InputGroupInput
                          ref={searchRef}
                          value={searchText}
                          onChange={(e) => setSearchValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
                          onBlur={() => { if (!searchText.trim()) setSearchOpen(false); }}
                          placeholder={t("searchPlaceholder")}
                        />
                        <InputGroupAddon align="inline-end">
                          <Button variant="ghost" size="sm" aria-label={t("closeSearch")} onClick={closeSearch}><X /></Button>
                        </InputGroupAddon>
                      </InputGroup>
                    ) : (
                      <Tooltip content={t("search")}>
                        <Button variant="ghost" size="sm" aria-label={t("search")} onClick={() => setSearchOpen(true)}><Search /></Button>
                      </Tooltip>
                    )}
                    <AutomationTagFilter iconOnly tagCounts={tagCounts} selectedFilters={tagFilters} onFiltersChange={setTags} />
                    {analyticsDestination && (
                      <Tooltip content={t("analytics")}>
                        <Button variant="ghost" size="sm" aria-label={t("analytics")} asChild>
                          {analyticsDestination === "analytics"
                            ? <Link to="/settings/$" params={{ _splat: "analytics" }} search={{ tab: "consumption", view: "automations", from: "automations" } as never}><ChartColumn /></Link>
                            : <Link to="/settings/$" params={{ _splat: "usage" }} search={{ tab: "automations" } as never}><ChartColumn /></Link>}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <Tooltip content={<SpendingFrozenTooltipContent />} disabled={!spendingFrozen}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="primary" disabled={spendingFrozen}>{t("createAutomation")}<ChevronDown /></Button>
                        </DropdownMenuTrigger>
                      </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => generateWithDevin()} disabled={isGenerating}>
                          <DevinMark size={16} />
                          <span className="mr-auto">{t("generateWithDevin")}</span>
                          <Tooltip side="right" sideOffset={16} content={
                            <div className="flex max-w-[240px] flex-col gap-0.5">
                              <span className="font-medium">{t("recommended")}</span>
                              <span className="text-text-secondary">{t("generateWithDevinDescription")}</span>
                            </div>
                          }>
                            <Info size={16} className="text-text-secondary" />
                          </Tooltip>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to="/automations/create"><Plus />{t("manualOption")}</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to="/automations/templates"><LayoutTemplate />{t("templateOption")}</Link></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {tagFilters.length > 0 && (
                <div className="mx-1 pb-1"><AutomationTagFilter chipsOnly tagCounts={tagCounts} selectedFilters={tagFilters} onFiltersChange={setTags} /></div>
              )}
              <div className="flex flex-col gap-5 pt-4">
                {list.isError && (
                  <div role="alert" className={cn("flex items-center justify-center gap-3", hasSource ? "rounded-lg border border-border-secondary px-4 py-3" : "py-12")}>
                    <span id="automations-list-load-error" className="text-13 leading-[18px] text-text-secondary">{t("automationsLoadError")}</span>
                    <Button variant="secondary" size="sm" aria-describedby="automations-list-load-error" onClick={() => list.refetch()}>{t("retry")}</Button>
                  </div>
                )}
                {visibleItems.length > 0 ? (
                  <>
                    <AutomationsTable
                      automations={pagedItems}
                      sparklineMap={sparklineMap}
                      sparklineIsLoading={sparks.isLoading}
                      sparklineIsError={sparks.isError}
                      getCreatorName={getCreatorName}
                      getMonitorChannelLabel={getMonitorChannelLabel}
                      firstColumnLabel={t("nameColumn")}
                      dateField="lastTriggered"
                      dateColumnClassName="w-[100px]"
                      getBasePath={(a) => (isCodeScanAutomation(a) ? "/security/automations" : undefined)}
                      sortState={sortState}
                      sortHandlers={sortHandlers}
                    />
                    {pagination.total > AUTOMATIONS_PAGE_SIZE && <ListPagination {...pagination} />}
                  </>
                ) : hasSource ? (
                  tagFilters.length > 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <Filter size={24} className="text-text-secondary" />
                      <p className="text-14 font-medium text-text-primary">{t("noAutomationsMatchFilters")}</p>
                      <p className="max-w-[320px] text-13 text-text-secondary">{t("noAutomationsMatchFiltersDetail", { count: tagFilters.length })}</p>
                      <button type="button" onClick={() => setTags([])} className="mt-1 text-13 font-medium text-text-accent-primary hover:underline">{t("clearAllFilters")}</button>
                    </div>
                  ) : (
                    <p className="px-3 py-12 text-center text-13 leading-[18px] text-text-secondary">{t("noMatchingAutomations")}</p>
                  )
                ) : showErrorInline || list.isError ? null : (
                  canManage ? <CreationEntry createDisabled={spendingFrozen} /> : <p className="px-3 py-12 text-center text-13 leading-[18px] text-text-secondary">{t("noAutomationsYet")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <AutomationsIntroDialog open={introOpen} onOpenChange={(o) => { if (!o) { setIntroOpen(false); localStorage.setItem(INTRO_DISMISSED_KEY, "1"); } }} />
    </>
  );
}
