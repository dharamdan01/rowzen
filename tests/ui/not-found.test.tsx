import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import NotFound from "../../src/app/not-found";
import WorkspaceNotFound from "../../src/app/(dashboard)/not-found";
import { metadata } from "../../src/app/not-found";

it("root 404 has a main landmark, Rowzen recovery and existing working links", () => {
  const markup = renderToStaticMarkup(h(NotFound));
  expect(markup).toContain("<main"); expect(markup).toContain("Page not found");
  expect(markup).toContain('href="/"'); expect(markup).toContain('href="/dashboard"');
  expect(markup).not.toContain("/settings"); expect(metadata.robots).toEqual({index:false,follow:false});
});
it("workspace 404 reuses generic recovery without nesting a main or exposing private identity", () => {
  const markup = renderToStaticMarkup(h(WorkspaceNotFound));
  expect(markup).not.toContain("<main"); expect(markup).toContain("may not have access");
  expect(markup).not.toContain("projectId");
});
