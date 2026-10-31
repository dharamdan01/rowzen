import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RowzenBrand, { RowzenIcon } from "../../../src/components/brand/rowzen-brand";

describe("accessible Rowzen identity", () => {
  it.each(["/", "/dashboard"])("keeps the brand's existing %s destination and a single accessible name", href => {
    const html = renderToStaticMarkup(createElement(RowzenBrand, { href }));
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain("<span>Rowzen</span>");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toMatch(/DataRehearsal|Data Rehearsal|<image|<script|onload=/);
  });
  it("names a standalone icon without exposing decorative duplicate image announcements", () => {
    const html = renderToStaticMarkup(createElement(RowzenIcon, { label: "Rowzen" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Rowzen"');
    expect(html).toContain("<title>Rowzen</title>");
    expect(html).not.toContain('aria-hidden="true"');
  });
});
