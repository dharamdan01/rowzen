import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button, Card, Dialog, EmptyState, Input, LoadingState, Select, Table } from "../src/components/ui/primitives";
import IssueTable from "../src/components/validation/issue-table";

const render = renderToStaticMarkup;

describe("native UI component contracts", () => {
  it("preserves button handlers, refs, disabled state, and native submit semantics", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const button = Button({ onClick, ref, disabled: true, type: "submit", form: "settings", children: "Save" });
    expect(button.props.onClick).toBe(onClick);
    expect(button.props.ref).toBe(ref);
    const html = render(button);
    expect(html).toContain('type="submit"');
    expect(html).toContain('form="settings"');
    expect(html).toContain('disabled=""');
    expect(render(createElement(Button, null, "Continue"))).not.toContain('type="button"');
  });

  it("preserves input handlers, values, invalid state, and associated help", () => {
    const onChange = vi.fn();
    const input = Input({ value: "existing", onChange, "aria-label": "Target column", "aria-invalid": true, "aria-describedby": "help" });
    expect(input.props.onChange).toBe(onChange);
    const html = render(input);
    expect(html).toContain('value="existing"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="help"');
    const checkbox = render(createElement(Input, { type: "checkbox", defaultChecked: true, "aria-label": "Required id" }));
    expect(checkbox).toContain('checked=""');
    const file = render(createElement(Input, { type: "file", multiple: true, accept: ".csv" }));
    expect(file).toContain('multiple=""');
    expect(file).toContain('accept=".csv"');
  });

  it("preserves selected options and select change handlers", () => {
    const onChange = vi.fn();
    const select = Select({ value: "number", onChange, "aria-label": "Type", children: [
      createElement("option", { key: "string", value: "string" }, "String"),
      createElement("option", { key: "number", value: "number" }, "Number"),
    ] });
    expect(select.props.onChange).toBe(onChange);
    expect(render(select)).toContain('<option value="number" selected="">Number</option>');
  });

  it("preserves card semantics and labels", () => {
    const html = render(createElement(Card, { "aria-labelledby": "report-title" }, createElement("h2", { id: "report-title" }, "Report")));
    expect(html).toMatch(/^<section/);
    expect(html).toContain('aria-labelledby="report-title"');
  });

  it("keeps tables semantic and their scroll regions named and keyboard focusable", () => {
    const html = render(createElement(Table, { scrollLabel: "Preview" }, createElement("caption", null, "Students")));
    expect(html).toContain('role="region" aria-label="Preview" tabindex="0"');
    expect(html).toContain('<caption>Students</caption>');
  });

  it("preserves dialog native refs and close/cancel handlers without forcing it open", () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const ref = createRef<HTMLDialogElement>();
    const dialog = Dialog({ ref, onClose, onCancel, "aria-labelledby": "dialog-title" });
    expect(dialog.props.ref).toBe(ref);
    expect(dialog.props.onClose).toBe(onClose);
    expect(dialog.props.onCancel).toBe(onCancel);
    expect(render(dialog)).not.toContain('open=""');
    expect(render(dialog)).toContain('aria-labelledby="dialog-title"');
  });

  it("announces loading and empty messages without changing their text", () => {
    const loading = render(createElement(LoadingState, null, "Reading CSV files..."));
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-hidden="true"');
    expect(loading).toContain("Reading CSV files...");
    const empty = render(createElement(EmptyState, null, "No records"));
    expect(empty).toContain('role="status"');
    expect(empty).toContain("No records");
  });
});

describe("issue table presentation", () => {
  it("preserves the exact empty message", () => {
    expect(render(createElement(IssueTable, { issues: [] }))).toContain("No row-level issues found by configured rules.");
  });

  it("preserves issue details and escapes untrusted CSV-derived text", () => {
    const html = render(createElement(IssueTable, { issues: [{
      dataset: "students", rowNumber: 4, column: "name", code: "REQUIRED", message: '<script>alert("test")</script>',
    }] }));
    expect(html).toContain("Validation issues (1)");
    expect(html.match(/scope="col"/g)).toHaveLength(5);
    expect(html).toContain("students");
    expect(html).toContain(">4</td>");
    expect(html).toContain("REQUIRED");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
