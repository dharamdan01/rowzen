import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RevalidationStatus from "../../src/components/corrections/revalidation-status";
const view = (action: "MANUAL" | "APPLY" | "UNDO" | "REDO" | "RESTORE", status: "READY" | "BLOCKED" | "CONFIG_ERROR" = "BLOCKED") => renderToStaticMarkup(createElement(RevalidationStatus, { action, status }));
describe("Phase 8 S5 accessible automatic verification status", () => {
  it("identifies an automatically revalidated APPLY", () => expect(view("APPLY")).toContain("after applying a correction"));
  it("identifies an automatically revalidated UNDO", () => expect(view("UNDO")).toContain("after undo"));
  it("identifies an automatically revalidated REDO", () => expect(view("REDO")).toContain("after redo"));
  it("identifies restoring ORIGINAL values", () => expect(view("RESTORE")).toContain("restoring original values"));
  it("clearly differentiates manual validation", () => expect(view("MANUAL")).toContain("Manually validated"));
  it("exposes accessible status and does not imply database import", () => {
    const html = view("APPLY", "READY");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-testid="revalidation-status"');
    expect(html).toContain("no database import was executed");
    expect(html).toContain("READY");
  });
  it("displays configuration errors without fake row success", () => {
    expect(view("UNDO", "CONFIG_ERROR")).toContain("CONFIG ERROR");
  });
});
