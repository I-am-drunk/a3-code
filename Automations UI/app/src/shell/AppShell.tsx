import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Cloud, Filter, GitPullRequest, History, MessageSquare, Moon, Plus, RotateCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TooltipProvider } from "@/ui/tooltip";
import { HeaderPortalsProvider } from "./header-portals";
import { PageHeaderBar, usePageHeaderFlags } from "./PageHeaderBar";
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "./sidebar";

/**
 * Shell around the Automations surface: the observed desktop frame (traffic lights,
 * Back/Forward/Refresh, document title) plus Devin's own web layout underneath it —
 * collapsible sidebar (`sidebar-BZG39jXG.js`), shared 44px page header with route
 * breadcrumbs and portaled page actions (`app-initial-D6_xyb6T2.js` `Qn`), and a single
 * `main` region that each page fills with its own scroll container.
 */
export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("theme") as "dark" | "light") || "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const nav: { label: string; to: string; icon: ReactNode }[] = [
  { label: "New session", to: "/sessions", icon: <Plus size={16} /> },
  { label: "Sessions", to: "/sessions", icon: <MessageSquare size={16} /> },
  { label: "Automations", to: "/automations", icon: <History size={16} /> },
  { label: "Security", to: "/security", icon: <ShieldCheck size={16} /> },
  { label: "Review", to: "/review", icon: <GitPullRequest size={16} /> },
  { label: "Wiki", to: "/wiki", icon: <BookOpen size={16} /> },
];

function Titlebar({ title }: { title: string }) {
  const { theme, toggle } = useTheme();
  const btn = "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-text-secondary hover:bg-tint-secondary hover:text-text-primary";
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-border-secondary bg-bg-page px-3 text-12 text-text-secondary select-none">
      <div className="flex shrink-0 items-center gap-2 pl-1">
        <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="mx-auto flex min-w-0 items-center gap-2">
        <button className={btn} aria-label="Go Back (⌃-)" onClick={() => history.back()}><ArrowLeft size={14} /></button>
        <button className={btn} aria-label="Go Forward (⌃⇧-)" onClick={() => history.forward()}><ArrowRight size={14} /></button>
        <button className={btn} aria-label="Refresh Page (⌘R)" onClick={() => location.reload()}><RotateCw size={13} /></button>
        <span className="ml-2 min-w-0 truncate text-13 text-text-primary">{title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={toggle} className={btn} aria-label="Toggle theme">{theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}</button>
      </div>
    </div>
  );
}

function RailContent({ path }: { path: string }) {
  return (
    <>
      <nav className="flex flex-col gap-0.5 px-2 pt-2">
        {nav.map((n, i) => {
          const active = n.to === "/automations" && path.startsWith("/automations");
          return (
            <Link key={i} to={n.to} className={cn("flex h-[32px] items-center gap-3 rounded-[6px] px-2.5 text-14 text-text-primary hover:bg-tint-secondary", active && "bg-tint-secondary")}>
              <span className="text-text-primary">{n.icon}</span>{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-5 flex items-center justify-between px-4 text-13 text-text-secondary">
        <span>Spaces</span>
        <span className="flex items-center gap-2.5 text-text-secondary"><Search size={14} /><Plus size={14} /><Filter size={14} /></span>
      </div>
      <div className="mt-3 flex flex-col gap-3 px-4">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-14 text-text-primary">Generate new automation</span><span className="flex items-center gap-1.5 text-12 text-text-secondary"><Cloud size={12} />4h ago</span></div>
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-text-accent-primary" />
        </div>
        <div className="flex flex-col gap-0.5"><span className="truncate text-14 text-text-primary">Greeting</span><span className="flex items-center gap-1.5 text-12 text-text-secondary"><Cloud size={12} />2d ago</span></div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border-secondary px-3 py-2 text-13 text-text-primary">
        <span>0 MCP servers</span>
        <span className="flex items-center gap-2 text-text-secondary"><Settings2 size={14} /><SlidersHorizontal size={14} /></span>
      </div>
    </>
  );
}

/** `Qn`: content column = optional floating sidebar toggle + page header + `main`. */
function ContentColumn() {
  const { open } = useSidebar();
  const { hidden } = usePageHeaderFlags();
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col bg-bg-page">
      {hidden && !open && <div className="absolute left-2 top-2 z-20 max-md:hidden"><SidebarTrigger /></div>}
      <PageHeaderBar />
      <main id="main" tabIndex={-1} className="flex w-full flex-1 overflow-y-hidden outline-none">
        <Outlet />
      </main>
    </div>
  );
}

function Frame() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile, setOpen } = useSidebar();
  // Off-canvas drawer closes on navigation (mobile only).
  useEffect(() => { if (isMobile) setOpen(false); }, [path, isMobile, setOpen]);
  const title = path.includes("/create") ? "Create automation" : path.includes("/edit") ? "Edit automation" : path.includes("/templates") ? "Templates" : "Automations";
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-bg-page text-text-primary">
      <Titlebar title={title} />
      <div className="flex min-h-0 flex-1">
        <Sidebar><RailContent path={path} /></Sidebar>
        <ContentColumn />
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <HeaderPortalsProvider>
          <Frame />
        </HeaderPortalsProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
