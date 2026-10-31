import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardShellNavigation, MobileNavigation } from "../src/components/layout/dashboard-nav";
import DashboardLayout from "../src/app/(dashboard)/layout";
import PageHeader from "../src/components/layout/page-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("../src/components/auth/sign-out-button", () => ({ default: () => h("button", null, "Sign Out") }));

const render = (pathname: string) => renderToStaticMarkup(h(DashboardShellNavigation, {
  pathname, accountAction: h("button", { type: "button" }, "Sign Out"),
}));

function activeLinks(markup: string) {
  return (markup.match(/<a\b[^>]*>/g) ?? []).filter((anchor) => anchor.includes('aria-current="page"'));
}

describe("application navigation", () => {
  it.each(["/dashboard", "/projects", "/upload", "/results", "/results/synthetic-report"])("marks the correct section active for %s", (pathname) => {
    const links = activeLinks(render(pathname));
    expect(links).toHaveLength(2); // Desktop and mobile share the same route mapping.
    expect(links.every((anchor) => anchor.includes(`href="/${pathname.split("/")[1]}"`))).toBe(true);
  });
  it("does not match route-prefix collisions", () => {
    expect(activeLinks(render("/results-archive"))).toHaveLength(0);
  });
  it("includes Results as a real ancestor without displaying report identifiers", () => {
    const markup = render("/results/private-report-id");
    const breadcrumb = markup.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)![0];
    expect(breadcrumb).toContain('href="/dashboard"');
    expect(breadcrumb).toContain('href="/results"');
    expect(breadcrumb).toContain('aria-current="page"');
    expect(breadcrumb).toContain("Saved summary");
    expect(breadcrumb).not.toContain("private-report-id");
  });
  it("preserves only the four existing destinations and the account action", () => {
    const markup = render("/projects");
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect([...new Set(hrefs)].sort()).toEqual(["#dashboard-content", "/dashboard", "/projects", "/results", "/upload"].sort());
    expect(markup).toContain('aria-label="Account"');
    expect(markup).toContain("Sign Out");
  });
  it("keeps a named native mobile drawer closed until explicitly opened", () => {
    const markup = renderToStaticMarkup(h(MobileNavigation, { pathname: "/upload" }));
    expect(markup).toContain("<dialog");
    expect(markup).not.toContain(" open=");
    expect(markup).toContain('aria-controls="mobile-dashboard-navigation"');
    expect(markup).toContain('id="mobile-dashboard-navigation"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-labelledby="mobile-navigation-title"');
  });
  it("retains all real destinations and an explicit keyboard close control in the drawer", () => {
    const markup = renderToStaticMarkup(h(MobileNavigation, { pathname: "/upload" }));
    expect(markup).toContain('aria-label="Close navigation"');
    for (const href of ["/dashboard", "/projects", "/upload", "/results"]) expect(markup).toContain(`href="${href}"`);
    // Native focus trapping, Escape, selection and focus return are exercised in the browser suite.
  });
});

describe("shell content and page headings", () => {
  it("preserves main focus target and children", () => {
    const markup = renderToStaticMarkup(h(DashboardLayout, null, h("p", null, "Existing page content")));
    expect(markup).toContain('id="dashboard-content"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("Existing page content");
    expect(markup).toContain('href="#dashboard-content"');
  });
  it("preserves heading IDs and escapes user-provided descriptions", () => {
    const markup = renderToStaticMarkup(h(PageHeader, {
      id: "summary-title", title: "Saved validation summary", description: '<script>alert("test")</script>',
    }));
    expect(markup).toContain('id="summary-title"');
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });
  it("does not add empty description elements", () => {
    expect(renderToStaticMarkup(h(PageHeader, { title: "Projects" }))).not.toContain("<p");
  });
});
