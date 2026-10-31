import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, Dialog, Drawer, EmptyState, Input, Skeleton, StatusMessage, Table, Textarea } from "../../src/components/ui/primitives";

describe("shared control semantics", () => {
  it("retains explicit submit intent, pending label and busy/disabled semantics", () => {
    const html = renderToStaticMarkup(h(Button, { type: "submit", pending: true }, "Saving project..."));
    expect(html).toContain('type="submit"'); expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""'); expect(html).toContain("Saving project...");
    expect(html).toContain('aria-hidden="true"');
  });
  it("forwards field constraints and accessible error relationships without changing values", () => {
    const props = { required: true, maxLength: 100, defaultValue: "001", "aria-invalid": true, "aria-describedby": "field-error" } as const;
    for (const element of [h(Input, props), h(Textarea, props)]) {
      const html = renderToStaticMarkup(element);
      expect(html).toContain('required=""'); expect(html).toContain('maxLength="100"');
      expect(html).toContain('aria-invalid="true"'); expect(html).toContain('aria-describedby="field-error"'); expect(html).toContain("001");
    }
  });
  it("keeps table captions, column headers and a named keyboard-scroll region", () => {
    const html = renderToStaticMarkup(h(Table, { scrollLabel: "CSV records" }, h("caption", null, "Original records"), h("thead", null, h("tr", null, h("th", { scope: "col" }, "Identifier")))));
    expect(html).toContain('role="region"'); expect(html).toContain('aria-label="CSV records"'); expect(html).toContain('tabindex="0"');
    expect(html).toContain("<caption>Original records</caption>"); expect(html).toContain('scope="col"');
  });
  it.each([Dialog, Drawer])("retains named closed native dialog semantics", component => {
    const html = renderToStaticMarkup(h(component, { "aria-labelledby": "dialog-title" }, h("h2", { id: "dialog-title" }, "Review project")));
    expect(html).toContain("<dialog"); expect(html).toContain('aria-labelledby="dialog-title"');
    expect(html).not.toContain(" open="); expect(html).not.toContain("placement=");
  });
  it("announces real errors as alerts, progress as status, and escapes their content", () => {
    expect(renderToStaticMarkup(h(StatusMessage, { tone: "error" }, "<script>private</script>"))).toContain('role="alert"');
    const html = renderToStaticMarkup(h(StatusMessage, { tone: "warning" }, "Review the configuration"));
    expect(html).toContain('role="status"'); expect(html).toContain('aria-atomic="true"');
    expect(renderToStaticMarkup(h(StatusMessage, { tone: "error" }, "<script>private</script>"))).not.toContain("<script>");
  });
  it("keeps skeletons decorative and genuine empty-state text announced", () => {
    expect(renderToStaticMarkup(h(Skeleton))).toContain('aria-hidden="true"');
    const html = renderToStaticMarkup(h(EmptyState, null, "No configured findings"));
    expect(html).toContain('role="status"'); expect(html).toContain("No configured findings");
  });
});
