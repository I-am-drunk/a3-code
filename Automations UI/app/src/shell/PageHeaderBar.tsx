import { Link, useMatches, useRouterState } from "@tanstack/react-router";
import { createElement, Fragment, useMemo, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, breadcrumbLinkClass } from "./breadcrumb";
import { HeaderActionsContainer, useBreadcrumbsRef, useHasActionsContent, useHasBreadcrumbContent, usePageHeaderHidden } from "./header-portals";
import { SidebarTrigger, useSidebar } from "./sidebar";

/**
 * Port of the shared 44px page header (`Yn`) and its breadcrumb renderer (`gn`) from
 * app-initial-D6_xyb6T2.js. Crumbs come from route `staticData.crumb` / `loaderData.crumb`
 * (`In`), trailing crumbs flagged `hideIfTrailing` are dropped, and pages portal their action
 * buttons into the right-hand container via `HeaderActions`.
 */
export type CrumbLabel = string | ComponentType;
export type CrumbDef = { label: CrumbLabel; hideIfTrailing?: boolean; externalLink?: boolean };
export type FakeParentCrumb = { label: CrumbLabel; href: string; search?: Record<string, unknown> };
export type CrumbItem = { label: CrumbLabel; href?: string; search?: Record<string, unknown>; externalLink?: boolean };

type MatchLike = { pathname: string; staticData?: { crumb?: CrumbDef; fakeParentCrumb?: FakeParentCrumb; hideBreadcrumbBorder?: boolean; hidePageHeader?: boolean }; loaderData?: unknown };

export function useRouteCrumbs(): CrumbItem[] {
  const matches = useMatches() as unknown as MatchLike[];
  return useMemo(() => {
    const items = matches.flatMap((m) => {
      const loader = (m.loaderData ?? {}) as { crumb?: CrumbDef; fakeParentCrumb?: FakeParentCrumb };
      const fake = loader.fakeParentCrumb ?? m.staticData?.fakeParentCrumb;
      const crumb = loader.crumb ?? m.staticData?.crumb;
      if (!crumb) return [];
      const self = { href: m.pathname, label: crumb.label, externalLink: crumb.externalLink, hideIfTrailing: crumb.hideIfTrailing };
      return fake ? [{ label: fake.label, href: fake.href, search: fake.search }, self] : [self];
    });
    let n = items.length;
    while (n > 0 && (items[n - 1] as { hideIfTrailing?: boolean }).hideIfTrailing) n--;
    return items.slice(0, n).map(({ hideIfTrailing: _h, ...rest }: CrumbItem & { hideIfTrailing?: boolean }) => rest);
  }, [matches]);
}

export function usePageHeaderFlags() {
  const matches = useMatches() as unknown as MatchLike[];
  const hidden = usePageHeaderHidden() || matches.some((m) => m.staticData?.hidePageHeader === true);
  const showBorder = !matches.some((m) => m.staticData?.hideBreadcrumbBorder === true);
  return { hidden, showBorder };
}

const trimSlash = (p: string) => p.replace(/\/$/, "");
const renderLabel = (label: CrumbLabel): ReactNode => (typeof label === "function" ? createElement(label) : label);
// Crumb hrefs are already-resolved pathnames, so bypass the typed route table.
const AnyLink = Link as unknown as ComponentType<{ to: string; search?: unknown; className?: string; children?: ReactNode }>;

function CrumbItems({ items, currentPath }: { items: CrumbItem[]; currentPath: string }) {
  if (items.length === 0) return null;
  const isCurrent = (c: CrumbItem) => trimSlash(c.href ?? "") === trimSlash(currentPath);
  const render = (c: CrumbItem, forcePage = false) =>
    c.externalLink ? renderLabel(c.label)
      : isCurrent(c) || forcePage ? <BreadcrumbPage className="min-w-0 font-medium hover:bg-transparent"><span className="truncate">{renderLabel(c.label)}</span></BreadcrumbPage>
      : c.href ? <AnyLink to={c.href} search={c.search} className={cn(breadcrumbLinkClass, "min-w-0")}><span className="truncate">{renderLabel(c.label)}</span></AnyLink>
      : <span className="truncate px-2">{renderLabel(c.label)}</span>;
  const collapsedMenu = (entries: CrumbItem[]) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><BreadcrumbEllipsis /></DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries.map((c, i) => c.href
          ? <DropdownMenuItem key={i} asChild><AnyLink to={c.href} search={c.search}>{renderLabel(c.label)}</AnyLink></DropdownMenuItem>
          : <DropdownMenuItem key={i}>{renderLabel(c.label)}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const first = items[0]!, last = items[items.length - 1]!, middle = items.slice(1, -1);
  const many = items.length > 1, hasMiddle = items.length > 2;
  return (
    <>
      {/* ≥lg: every crumb inline */}
      <BreadcrumbItem className="hidden min-w-0 lg:inline-flex">{render(first, !many)}</BreadcrumbItem>
      {items.slice(1).map((c, i) => (
        <Fragment key={i}>
          <BreadcrumbSeparator className="hidden lg:block" />
          <BreadcrumbItem className="hidden min-w-0 lg:inline-flex">{render(c, i === items.length - 2)}</BreadcrumbItem>
        </Fragment>
      ))}
      {/* md..lg: first, collapsed middle, last */}
      <BreadcrumbItem className="hidden min-w-0 md:inline-flex lg:hidden">{render(first, !many)}</BreadcrumbItem>
      {hasMiddle && (<><BreadcrumbSeparator className="hidden md:block lg:hidden" /><BreadcrumbItem className="hidden md:inline-flex lg:hidden">{collapsedMenu(middle)}</BreadcrumbItem></>)}
      {many && (<><BreadcrumbSeparator className="hidden md:block lg:hidden" /><BreadcrumbItem className="hidden min-w-0 md:inline-flex lg:hidden">{render(last, true)}</BreadcrumbItem></>)}
      {/* <md: everything before the last crumb collapses into a menu */}
      {many ? (
        <>
          <BreadcrumbItem className="hidden @[80px]/header:max-md:inline-flex">{collapsedMenu(items.slice(0, -1))}</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden @[80px]/header:max-md:block" />
          <BreadcrumbItem className="hidden min-w-0 max-md:inline-flex">{render(last, true)}</BreadcrumbItem>
        </>
      ) : (
        <BreadcrumbItem className="hidden min-w-0 max-md:inline-flex">{render(first, true)}</BreadcrumbItem>
      )}
    </>
  );
}

export function PageHeaderBar({ className }: { className?: string }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = useRouteCrumbs();
  const { hidden, showBorder } = usePageHeaderFlags();
  const hasBreadcrumbContent = useHasBreadcrumbContent();
  const hasActionsContent = useHasActionsContent();
  const { open } = useSidebar();
  const breadcrumbsRef = useBreadcrumbsRef();
  void hasBreadcrumbContent; void hasActionsContent; // header stays mounted so portals resolve
  return (
    <header
      className={cn(
        "flex h-11 flex-shrink-0 items-center justify-between overflow-hidden p-2 pr-[7px] border-b",
        showBorder ? "border-border-secondary" : "border-transparent",
        hidden && "md:hidden",
        className,
      )}
    >
      <div className="flex shrink-0 items-center"><SidebarTrigger className={cn(open && "md:hidden")} /></div>
      <div className="-m-1 flex min-w-0 flex-1 items-center gap-2 truncate p-1 @container/header">
        <Breadcrumb className="min-w-0 flex-shrink">
          <BreadcrumbList ref={breadcrumbsRef} className="-m-1 flex-nowrap overflow-hidden p-1">
            <CrumbItems items={crumbs} currentPath={currentPath} />
            <li role="presentation" aria-hidden="true" className="hidden" />
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex min-w-0 shrink items-center justify-end gap-2"><HeaderActionsContainer /></div>
    </header>
  );
}
