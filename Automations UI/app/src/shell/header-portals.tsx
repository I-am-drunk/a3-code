import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Port of the shipped header-portal plumbing (`Cn`/`J`/`wn`/`On`/`kn`/`zn`/`Bn`/`Vn` in
 * app-initial-D6_xyb6T2.js). Pages do not render their own header: they portal breadcrumb
 * or action content into the shared 44px page header, which shows itself only when it has
 * route crumbs, portaled breadcrumb content, or portaled actions.
 */
type HeaderPortals = {
  breadcrumbsContainer: HTMLElement | null;
  actionsContainer: HTMLElement | null;
  setBreadcrumbsContainer: (el: HTMLElement | null) => void;
  setActionsContainer: (el: HTMLElement | null) => void;
  hasBreadcrumbContent: boolean;
  setHasBreadcrumbContent: (v: boolean) => void;
  hasActionsContent: boolean;
  setHasActionsContent: (v: boolean) => void;
  pageHeaderHidden: boolean;
  setPageHeaderHidden: (v: boolean) => void;
};

const Ctx = createContext<HeaderPortals | undefined>(undefined);

export function HeaderPortalsProvider({ children }: { children: ReactNode }) {
  const [breadcrumbsContainer, setBreadcrumbsContainer] = useState<HTMLElement | null>(null);
  const [actionsContainer, setActionsContainer] = useState<HTMLElement | null>(null);
  const [hasBreadcrumbContent, setHasBreadcrumbContent] = useState(false);
  const [hasActionsContent, setHasActionsContent] = useState(false);
  const [pageHeaderHidden, setPageHeaderHidden] = useState(false);
  return (
    <Ctx.Provider value={{ breadcrumbsContainer, actionsContainer, setBreadcrumbsContainer, setActionsContainer, hasBreadcrumbContent, setHasBreadcrumbContent, hasActionsContent, setHasActionsContent, pageHeaderHidden, setPageHeaderHidden }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHeaderPortals() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHeaderPortals must be used within HeaderPortalsProvider");
  return ctx;
}

/** `wn` — the header-side mount point for portaled actions (renders as `display: contents`). */
export function HeaderActionsContainer({ children }: { children?: ReactNode }) {
  const { setActionsContainer } = useHeaderPortals();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) setActionsContainer(ref.current); return () => setActionsContainer(null); }, [setActionsContainer]);
  return <div ref={ref} className="contents">{children}</div>;
}

/** `kn` — page-side: portal actions into the header and flag that actions exist. */
export function HeaderActions({ children }: { children: ReactNode }) {
  const { actionsContainer, setHasActionsContent } = useHeaderPortals();
  useEffect(() => { setHasActionsContent(true); return () => setHasActionsContent(false); }, [setHasActionsContent]);
  return actionsContainer ? createPortal(children, actionsContainer) : null;
}

/** `On` — page-side: portal extra breadcrumb items into the header's breadcrumb list. */
export function HeaderBreadcrumbs({ children }: { children?: ReactNode }) {
  const { breadcrumbsContainer, setHasBreadcrumbContent } = useHeaderPortals();
  useEffect(() => { if (children) { setHasBreadcrumbContent(true); return () => setHasBreadcrumbContent(false); } }, [children, setHasBreadcrumbContent]);
  return breadcrumbsContainer ? createPortal(children, breadcrumbsContainer) : null;
}

/** `En` — page-side: hide the page header entirely while mounted. */
export function HidePageHeader() {
  const { setPageHeaderHidden } = useHeaderPortals();
  useEffect(() => { setPageHeaderHidden(true); return () => setPageHeaderHidden(false); }, [setPageHeaderHidden]);
  return null;
}

export function useHasBreadcrumbContent() { return useContext(Ctx)?.hasBreadcrumbContent ?? false; }
export function useHasActionsContent() { return useContext(Ctx)?.hasActionsContent ?? false; }
export function usePageHeaderHidden() { return useContext(Ctx)?.pageHeaderHidden ?? false; }
export function useBreadcrumbsRef() {
  const { setBreadcrumbsContainer } = useHeaderPortals();
  return useCallback((el: HTMLElement | null) => setBreadcrumbsContainer(el), [setBreadcrumbsContainer]);
}
