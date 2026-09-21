import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { AppShell } from "@/shell/AppShell";
import { AutomationNameCrumb, AutomationsCrumb, ErrorLogsCrumb, NewAutomationCrumb, TemplatesCrumb } from "@/shell/crumbs";
import { AutomationsListPage } from "@/features/list/AutomationsListPage";
import { TemplatesPage } from "@/features/templates/TemplatesPage";
import { AutomationEditorPage } from "@/features/editor/AutomationEditorPage";
import { AutomationDetailPage } from "@/features/detail/AutomationDetailPage";
import { PlaceholderPage } from "@/shell/PlaceholderPage";
import { ErrorLogsPage } from "@/features/error-logs/ErrorLogsPage";

/**
 * Route tree mirroring Devin's `/org/$orgName/automations` subtree (app-initial-BaF41ulT.js,
 * main-Bn1R5p2X.js): the parent carries the `Automations` crumb with `hideIfTrailing`, so the list
 * page itself shows no crumb; templates/create/detail/edit add theirs. `hideBreadcrumbBorder`
 * matches the shipped flags per route.
 */
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    crumb?: { label: string | ComponentType; hideIfTrailing?: boolean };
    fakeParentCrumb?: { label: string | ComponentType; href: string };
    hideBreadcrumbBorder?: boolean;
    hidePageHeader?: boolean;
    titleKey?: string;
  }
}

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", beforeLoad: () => { throw redirect({ to: "/automations" }); } });

const automationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/automations",
  staticData: { crumb: { label: AutomationsCrumb, hideIfTrailing: true } },
});

type ListSearch = { tab?: "mine"; q?: string; tags?: string };
const listRoute = createRoute({
  getParentRoute: () => automationsRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>): ListSearch => ({
    tab: s.tab === "mine" ? "mine" : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    tags: typeof s.tags === "string" && s.tags ? s.tags : undefined,
  }),
  staticData: { hideBreadcrumbBorder: true },
  component: AutomationsListPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => automationsRoute,
  path: "templates",
  staticData: { crumb: { label: TemplatesCrumb } },
  component: TemplatesPage,
});

type CreateSearch = { template?: string };
const createRoute_ = createRoute({
  getParentRoute: () => automationsRoute,
  path: "create",
  validateSearch: (s: Record<string, unknown>): CreateSearch => ({ template: typeof s.template === "string" ? s.template : undefined }),
  staticData: { crumb: { label: NewAutomationCrumb } },
  component: AutomationEditorPage,
});

type DetailSearch = { issue?: string };
const validateDetailSearch = (s: Record<string, unknown>): DetailSearch => ({ issue: typeof s.issue === "string" ? s.issue : undefined });

const detailRoute = createRoute({
  getParentRoute: () => automationsRoute,
  path: "$id",
  validateSearch: validateDetailSearch,
  staticData: { hideBreadcrumbBorder: true, crumb: { label: AutomationNameCrumb } },
  component: AutomationDetailPage,
});

const editRoute = createRoute({
  getParentRoute: () => automationsRoute,
  path: "$id/edit",
  staticData: { hideBreadcrumbBorder: true, crumb: { label: AutomationNameCrumb } },
  component: AutomationEditorPage,
});

// Security (code-scan) variants reuse the same pages with type-aware routing (spec §2, §17.2, §17.5).
const securityCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/security/automations/create",
  validateSearch: (s: Record<string, unknown>): CreateSearch => ({ template: typeof s.template === "string" ? s.template : undefined }),
  staticData: { crumb: { label: NewAutomationCrumb } },
  component: AutomationEditorPage,
});
const securityDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/security/automations/$id",
  validateSearch: validateDetailSearch,
  staticData: { crumb: { label: AutomationNameCrumb } },
  component: AutomationDetailPage,
});
const securityEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/security/automations/$id/edit",
  staticData: { crumb: { label: AutomationNameCrumb } },
  component: AutomationEditorPage,
});
const errorLogsRoute = createRoute({
  getParentRoute: () => automationsRoute,
  path: "$id/error-logs",
  staticData: { crumb: { label: ErrorLogsCrumb } },
  component: ErrorLogsPage,
});
const sessionRoute = createRoute({ getParentRoute: () => rootRoute, path: "/sessions/$id", component: () => <PlaceholderPage title="Session" /> });
const oncallRoute = createRoute({ getParentRoute: () => rootRoute, path: "/oncall", staticData: { hideBreadcrumbBorder: true, hidePageHeader: true }, component: () => <PlaceholderPage title="On-call" /> });

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/sessions",
  validateSearch: (s: Record<string, unknown>) => ({ automation: typeof s.automation === "string" ? s.automation : undefined }),
  component: () => <PlaceholderPage title="Sessions" />,
});
const securityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/security", staticData: { hideBreadcrumbBorder: true, hidePageHeader: true }, component: () => <PlaceholderPage title="Security" /> });
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/review", staticData: { hideBreadcrumbBorder: true }, component: () => <PlaceholderPage title="Review" /> });
const wikiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/wiki", component: () => <PlaceholderPage title="Wiki" /> });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings/$", staticData: { crumb: { label: "Settings" } }, component: () => <PlaceholderPage title="Settings" /> });

const routeTree = rootRoute.addChildren([
  indexRoute,
  automationsRoute.addChildren([listRoute, templatesRoute, createRoute_, detailRoute, editRoute, errorLogsRoute]),
  securityCreateRoute,
  securityDetailRoute,
  securityEditRoute,
  sessionRoute,
  oncallRoute,
  sessionsRoute,
  securityRoute,
  reviewRoute,
  wikiRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
