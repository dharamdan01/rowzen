import { createElement as h, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SchemaMapping from "../../src/components/upload/schema-mapping";
import { Input, Select } from "../../src/components/ui/primitives";
import type { DatasetRules, FieldType } from "../../src/lib/rehearsal/rules";

const dataset = { name: "students", filename: "students.csv", headers: ["id", "student_name"] };
const mapping = [{ source: "id", target: "id" }, { source: "student_name", target: "name" }];
const rules: DatasetRules = { primaryKey: "id", required: ["name", "missing_field"], types: { name: "email" } };
const fieldTypes: FieldType[] = ["string", "integer", "number", "boolean", "date", "email"];
function controls(node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(node)) return node.flatMap(controls);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [{ type: node.type, props: node.props }, ...controls(node.props.children)];
}
function fixture(suppliedMapping = mapping) {
  const onTargetChange = vi.fn();
  const onRulesChange = vi.fn();
  const tree = SchemaMapping({ dataset, mapping: suppliedMapping, rules, fieldTypes, onTargetChange, onRulesChange });
  const all = controls(tree);
  const control = (label: string) => all.find((entry) => entry.props["aria-label"] === label)!;
  return { tree, control, onTargetChange, onRulesChange };
}

describe("schema mapping interface contracts", () => {
  it("preserves source/target labels and current field types and required flags", () => {
    const { control, tree } = fixture();
    expect(control("Target for students.student_name").props.value).toBe("name");
    expect(control("Type of students.name").props.value).toBe("email");
    expect(control("Type of students.id").props.value).toBe("");
    expect(control("Required students.name").props.checked).toBe(true);
    expect(control("Required students.id").props.checked).toBe(false);
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain("CSV column");
    expect(markup).toContain('value="" disabled="" selected="">Not configured</option>');
    expect(rules.types).not.toHaveProperty("id");
    expect(markup).toContain("Primary key");
    expect(markup).toContain("Applying a rename resets");
    expect(markup).not.toContain('aria-invalid="true"');
  });
  it("forwards raw target edits without normalizing or committing new state", () => {
    const { control, onTargetChange, onRulesChange } = fixture();
    const input = control("Target for students.student_name");
    expect(input.type).toBe(Input);
    (input.props.onChange as (event: unknown) => void)({ target: { value: " new_name " } });
    expect(onTargetChange).toHaveBeenCalledWith("student_name", " new_name ");
    expect(onRulesChange).not.toHaveBeenCalled();
  });
  it("preserves existing rules when changing a type", () => {
    const { control, onRulesChange } = fixture();
    const select = control("Type of students.name");
    expect(select.type).toBe(Select);
    (select.props.onChange as (event: unknown) => void)({ target: { value: "date" } });
    expect(onRulesChange).toHaveBeenCalledWith({ ...rules, types: { name: "date" } });
    expect(rules.types.name).toBe("email");
  });
  it("preserves missing required fields and unrelated rules when toggling required", () => {
    const { control, onRulesChange } = fixture();
    (control("Required students.name").props.onChange as (event: unknown) => void)({ target: { checked: false } });
    expect(onRulesChange).toHaveBeenLastCalledWith({ ...rules, required: ["missing_field"] });
    (control("Required students.id").props.onChange as (event: unknown) => void)({ target: { checked: true } });
    expect(onRulesChange).toHaveBeenLastCalledWith({ ...rules, required: ["name", "missing_field", "id"] });
    expect(rules.required).toEqual(["name", "missing_field"]);
  });
  it.each([
    { target: " ", message: "target column names cannot be empty" },
    { target: " ID ", message: "duplicate target column names" },
  ])("uses canonical feedback for $message", ({ target, message }) => {
    const { tree, control, onRulesChange, onTargetChange } = fixture([mapping[0], { ...mapping[1], target }]);
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain(message);
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('role="status"');
    expect(control("Target for students.student_name").props["aria-describedby"]).toContain("mapping-students-error");
    expect(onRulesChange).not.toHaveBeenCalled();
    expect(onTargetChange).not.toHaveBeenCalled();
  });
  it("does not read CSV records for mapping feedback", () => {
    const metadata = { ...dataset, get rows(): never { throw new Error("CSV records must not be read"); } };
    expect(() => renderToStaticMarkup(h(SchemaMapping, { dataset: metadata, mapping, rules, fieldTypes, onTargetChange: vi.fn(), onRulesChange: vi.fn() }))).not.toThrow();
  });
  it("escapes untrusted source and target names", () => {
    const markup = renderToStaticMarkup(h(SchemaMapping, {
      dataset: { name: "unsafe", filename: "unsafe.csv", headers: ["<script>"] },
      mapping: [{ source: "<script>", target: '<img src=x onerror="alert(1)">' }],
      rules: { primaryKey: "", required: [], types: {} }, fieldTypes, onTargetChange: vi.fn(), onRulesChange: vi.fn(),
    }));
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img ");
  });
});
