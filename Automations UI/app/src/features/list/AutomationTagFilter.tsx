import { Check, Filter, Search, Tags, X } from "lucide-react";
import { useMemo, useRef, useState, Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { Badge } from "@/ui/badge";
import { isReservedTagKey, tagDotColor, type TagCount, type TagFilter } from "@/model/tags";

/** Exact port of AutomationTagFilter-D8SPb3pA.js `j`. */

/** Minimal `<Trans components>` equivalent: renders `<name>…</name>` slots in a catalog string as components. */
function renderSlots(text: string, slots: Record<string, (children: string) => ReactNode>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = slots[m[1]!];
    out.push(<Fragment key={i++}>{render ? render(m[2]!) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AutomationTagFilter({
  tagCounts, selectedFilters, onFiltersChange, chipsOnly, iconOnly,
}: { tagCounts: TagCount[]; selectedFilters: TagFilter[]; onFiltersChange: (f: TagFilter[]) => void; chipsOnly?: boolean; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, { value: string; count: number }[]>();
    for (const tc of tagCounts) {
      if (isReservedTagKey(tc.key)) continue;
      const list = m.get(tc.key) ?? [];
      list.push({ value: tc.value, count: tc.count });
      m.set(tc.key, list);
    }
    return m;
  }, [tagCounts]);

  const visible = useMemo(() => {
    if (!query) return grouped;
    const q = query.toLowerCase();
    const m = new Map<string, { value: string; count: number }[]>();
    for (const [k, vals] of grouped) {
      if (k.toLowerCase().includes(q)) m.set(k, vals);
      else {
        const f = vals.filter((v) => v.value.toLowerCase().includes(q));
        if (f.length) m.set(k, f);
      }
    }
    return m;
  }, [grouped, query]);

  const isSelected = (k: string, v: string) => selectedFilters.some((f) => f.key === k && f.value === v);
  const toggle = (k: string, v: string) => {
    if (isSelected(k, v)) onFiltersChange(selectedFilters.filter((f) => !(f.key === k && f.value === v)));
    else onFiltersChange([...selectedFilters, { key: k, value: v }]);
  };
  const remove = (k: string, v: string) => onFiltersChange(selectedFilters.filter((f) => !(f.key === k && f.value === v)));

  if (chipsOnly) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedFilters.filter((f) => !isReservedTagKey(f.key)).map((f) => (
          <button
            key={`${f.key}:${f.value}`}
            type="button"
            onClick={() => remove(f.key, f.value)}
            className="flex max-w-full items-center gap-1 rounded-md border border-border-secondary px-2 py-0.5 text-12 text-text-primary hover:bg-tint-secondary"
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", tagDotColor(f.key))} />
            <span className="max-w-[160px] truncate text-text-secondary">{f.key}</span>
            <span>:</span>
            <span className="max-w-[160px] truncate">{f.value}</span>
            <X size={12} className="ml-0.5 text-text-secondary" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }
          }}
        >
          {iconOnly ? (
            <Tooltip content={t("filter")}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("filter")}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-[6px]",
                    "text-text-secondary hover:bg-tint-secondary hover:text-text-primary",
                    selectedFilters.length > 0 && "text-text-primary",
                  )}
                >
                  <Filter className="size-4" />
                  {selectedFilters.length > 0 && (
                    <Badge variant="blue" className="absolute -right-1 -top-1 h-auto min-w-[14px] rounded-full px-1 py-0 text-11 justify-center">{selectedFilters.length}</Badge>
                  )}
                </button>
              </PopoverTrigger>
            </Tooltip>
          ) : (
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-13 font-medium",
                  "border-border-secondary text-text-primary hover:bg-tint-secondary",
                  selectedFilters.length > 0 && "border-border-primary",
                )}
              >
                <Filter size={14} />
                <span>{t("filter")}</span>
                {selectedFilters.length > 0 && <Badge variant="blue" className="ml-0.5 h-auto min-w-[18px] rounded-full px-1 py-0 text-11 justify-center">{selectedFilters.length}</Badge>}
              </button>
            </PopoverTrigger>
          )}
          <PopoverContent align="end" sideOffset={4} className="w-[280px] overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2">
              <Search size={14} className="shrink-0 text-text-secondary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchMetadata")}
                className="min-w-0 flex-1 bg-transparent text-13 text-text-primary outline-none"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto overflow-x-hidden py-1">
              {tagCounts.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <Tags size={24} className="text-text-secondary" />
                  <p className="text-13 font-medium text-text-primary">{t("noMetadataYet")}</p>
                  <p className="text-12 text-text-secondary">{renderSlots(t("noMetadataYetDescription"), { advanced: (c) => <span className="font-medium">{c}</span> })}</p>
                </div>
              )}
              {tagCounts.length > 0 && visible.size === 0 && <p className="px-3 py-2 text-13 text-text-secondary">{t("noMatchingMetadata")}</p>}
              {Array.from(visible).map(([key, vals]) => (
                <div key={key} className="flex flex-col">
                  <span className="truncate px-3 pb-1 pt-2 text-12 font-medium uppercase text-text-secondary">{key}</span>
                  {vals.map((v) => {
                    const sel = isSelected(key, v.value);
                    return (
                      <button
                        key={`${key}:${v.value}`}
                        type="button"
                        onClick={() => toggle(key, v.value)}
                        className={cn("flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-tint-secondary", sel && "bg-tint-secondary/50")}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", tagDotColor(key))} />
                        <span className="min-w-0 flex-1 break-all text-13 text-text-primary">{v.value}</span>
                        <span className="text-12 text-text-secondary">{v.count}</span>
                        {sel && <Check size={14} className="shrink-0 text-text-accent-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
