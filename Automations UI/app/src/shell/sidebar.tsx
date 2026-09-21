import { PanelLeft } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/ui/icon-button";
import { Tooltip } from "@/ui/tooltip";

/**
 * Port of the shipped sidebar mechanics (sidebar-BZG39jXG.js + the `sidebar-mode` store in
 * app-initial-D6_xyb6T2.js):
 *  - desktop open state persists in localStorage `sidebar-mode`, defaulting to open only when
 *    the window is at least 1024px wide;
 *  - below `md` (768px) the sidebar is an off-canvas drawer with a dimmed backdrop and is never
 *    persisted;
 *  - ⌘B / Ctrl+B toggles; the header `SidebarTrigger` shows whenever the rail is collapsed.
 * The 336px width matches the observed desktop reference window.
 */
export const SIDEBAR_WIDTH = "336px";
const STORAGE_KEY = "sidebar-mode";
const MOBILE_QUERY = "(max-width: 767px)";

type SidebarCtx = { open: boolean; isMobile: boolean; setOpen: (open: boolean) => void; toggle: () => void };
const Ctx = createContext<SidebarCtx | null>(null);

function readStoredMode(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as unknown;
    return v === "open" ? true : v === "closed" ? false : null;
  } catch { return null; }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange(); mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [desktopOpen, setDesktopOpen] = useState<boolean>(() => readStoredMode() ?? window.innerWidth >= 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(desktopOpen ? "open" : "closed")); } catch { /* ignore */ } }, [desktopOpen]);

  const open = isMobile ? mobileOpen : desktopOpen;
  const setOpen = useCallback((v: boolean) => { if (isMobile) setMobileOpen(v); else setDesktopOpen(v); }, [isMobile]);
  const toggle = useCallback(() => { if (isMobile) setMobileOpen((v) => !v); else setDesktopOpen((v) => !v); }, [isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(() => ({ open, isMobile, setOpen, toggle }), [open, isMobile, setOpen, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        aria-hidden={!open || undefined}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-x-0 top-[34px] bottom-0 z-40 cursor-default before:absolute before:inset-0 before:bg-black/50 before:content-[''] md:hidden",
          "motion-safe:transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        data-slot="sidebar"
        data-side="left"
        data-state={open ? "expanded" : "collapsed"}
        aria-hidden={!open || undefined}
        inert={!open || undefined}
        style={{ "--sidebar-width": SIDEBAR_WIDTH } as CSSProperties}
        className={cn(
          "group/sidebar border-border-secondary text-text-primary flex h-full shrink-0 flex-col overflow-hidden border-r bg-[var(--sidebar-bg)] [--sidebar-bg:rgb(var(--bg-page))]",
          "w-[var(--sidebar-width)]",
          "max-md:fixed max-md:top-[34px] max-md:bottom-0 max-md:z-50 max-md:w-[var(--sidebar-width)] max-md:duration-150 max-md:ease-out motion-safe:max-md:transition-transform",
          open ? "max-md:left-0 max-md:translate-x-0" : "max-md:left-0 max-md:-translate-x-full",
          !open && "md:hidden",
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
}

/** `Ee` — ghost md icon button with the collapse/expand label and ⌘B hint. */
export function SidebarTrigger({ className }: { className?: string }) {
  const { open, toggle } = useSidebar();
  const label = open ? "Collapse sidebar" : "Expand sidebar";
  return (
    <Tooltip side="bottom" content={<span className="flex items-center gap-1.5">{label}<kbd className="rounded-[3px] bg-tint-secondary px-1 text-11 text-text-secondary">⌘B</kbd></span>}>
      <IconButton data-slot="sidebar-trigger" variant="ghost" size="md" aria-label={label} onClick={toggle} className={className}>
        <PanelLeft size={18} />
      </IconButton>
    </Tooltip>
  );
}
