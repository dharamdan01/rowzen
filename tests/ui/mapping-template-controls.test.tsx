import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MappingTemplateControls from "../../src/components/templates/mapping-template-controls";

const props = {
  projectId: "project-1", projects: [{ id: "project-1", name: "Demo project" }],
  onProjectChange: vi.fn(), datasets: [] as [], configuration: null, onLoad: vi.fn(),
};
const markup = (overrides = {}) => renderToStaticMarkup(createElement(MappingTemplateControls, { ...props, ...overrides }));

describe("Phase 8 S7 template UI accessibility and guards", () => {
  it("provides accessible select controls", () => {
    const html = markup();
    expect(html).toContain('aria-label="Template project"');
    expect(html).toContain('aria-label="Saved mapping template"');
  });
  it("shows privacy and strict dataset matching guidance", () => {
    const html = markup();
    expect(html).toContain("never included");
    expect(html).toContain("original headers");
  });
  it("disables saving until valid configuration is present", () => {
    const html = markup();
    expect(html).toContain("Save mapping template");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save mapping template/);
  });
  it("offers no saving controls if no project is selected", () => {
    const html = markup({ projectId: "" });
    expect(html).not.toContain("Save mapping template");
  });
});
