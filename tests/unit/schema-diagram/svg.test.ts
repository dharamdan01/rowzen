import { describe, expect, it } from "vitest";
import { buildWorkspaceSchemaDescriptor } from "../../../src/lib/schema-diagram/descriptor";
import { layoutSchemaDiagram } from "../../../src/lib/schema-diagram/layout";
import { escapeSvgText, renderSchemaDiagramSvg } from "../../../src/lib/schema-diagram/svg";
import { schemaDiagramInput, wideSchemaInput } from "../../fixtures/schema-diagram";

/** Strict vocabulary/balance check, independent of the serializer; native browser XML is checked separately. */
function inspectSvg(svg: string) {
  const tags = new Set(["svg", "title", "desc", "defs", "marker", "path", "rect", "text", "tspan", "g"]);
  const attributes = new Set(["xmlns", "width", "height", "viewBox", "role", "aria-labelledby", "aria-describedby", "font-family", "id", "markerWidth", "markerHeight", "refX", "refY", "orient", "markerUnits", "d", "fill", "x", "y", "font-size", "direction", "unicode-bidi", "xml:space", "stroke", "stroke-width", "stroke-linejoin", "stroke-dasharray", "marker-end", "rx"]);
  const stack: string[] = [], ids: string[] = [], references: string[] = [];
  expect(svg).not.toMatch(/<!|<\?/);
  for (const token of svg.match(/<[^>]*>/g) ?? []) {
    const match = /^<(\/?)([\w:]+)([\s\S]*?)(\/?)>$/.exec(token)!;
    expect(match).not.toBeNull(); const [, closing, tag, tail, selfClosing] = match;
    expect(tags.has(tag)).toBe(true);
    if (closing) { expect(stack.pop()).toBe(tag); expect(tail).toBe(""); continue; }
    let rest = tail;
    while (rest.trim()) {
      const attribute = /^\s+([\w:-]+)="([^"<>]*)"/.exec(rest)!; expect(attribute).not.toBeNull();
      const [, name, value] = attribute; expect(attributes.has(name)).toBe(true);
      if (name === "id") { expect(value).toMatch(/^er-\d+-[a-z0-9-]+$/); ids.push(value); }
      if (name === "marker-end") { expect(value).toMatch(/^url\(#er-\d+-arrow-(normal|warning)\)$/); references.push(value.slice(5, -1)); }
      if (name.startsWith("aria-")) references.push(...value.split(" "));
      rest = rest.slice(attribute[0].length);
    }
    if (!selfClosing) stack.push(tag);
  }
  expect(stack).toEqual([]); expect(new Set(ids).size).toBe(ids.length);
  for (const reference of references) expect(ids).toContain(reference);
  expect(svg.replace(/<[^>]*>/g, "")).not.toMatch(/[<>]|&(?!amp;|lt;|gt;|quot;|apos;|#13;|#9;)/);
  return ids;
}
const fixture = () => layoutSchemaDiagram(buildWorkspaceSchemaDescriptor(schemaDiagramInput()));

describe("safe standalone native schema SVG", () => {
  it("renders table/column types, group indicators, complete relationships and accessible descriptions", () => {
    const layout = fixture(), svg = renderSchemaDiagramSvg(layout); inspectSvg(svg);
    expect(svg.match(/id="er-0-table-\d+"/g)).toHaveLength(3);
    expect(svg.match(/id="er-0-table-\d+-column-\d+"/g)).toHaveLength(10);
    expect(svg.match(/marker-end=/g)).toHaveLength(6);
    expect(svg).toContain("Source source_id; target id; type integer");
    expect(svg).toContain("Not configured"); expect(svg).toContain("Required"); expect(svg).toContain("UQ1");
    expect(svg).toContain('role="img"'); expect(svg).toContain('viewBox="0 0 ');
    for (const relationship of layout.relationships) expect(svg).toContain(escapeSvgText(relationship.detail));
  });

  it.each(["light", "dark"] as const)("uses explicit %s colors, a background, and no stylesheet/font/network dependencies", theme => {
    const svg = renderSchemaDiagramSvg(fixture(), { theme }); inspectSvg(svg);
    expect(svg).toContain(theme === "light" ? 'fill="#fafafb"' : 'fill="#0b0d12"');
    expect(svg).toContain(theme === "light" ? 'stroke="#5145cd"' : 'stroke="#a69bff"');
    expect(svg).not.toMatch(/var\(|currentColor|<style|<image|<use|href=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  });

  it.each([
    '</text><script>alert("x")</script>',
    '<image href="https://attacker.invalid/x" onload="alert(1)"/>',
    '\"><foreignObject><img src=x onerror=alert(1)></foreignObject>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///private">]>&x;',
    'javascript:alert(1) & "quotes" \'single\' < >',
    '<animate attributeName="href" values="javascript:alert(1)"/>',
  ])("escapes hostile table, column, source and relationship labels: %s", hostile => {
    const input = schemaDiagramInput();
    const extended = { ...input, datasets: [{ name: hostile, headers: [hostile] }], mappings: { [hostile]: [{ source: hostile, target: hostile }] },
      rules: { [hostile]: { primaryKey: hostile, required: [hostile], types: {} } }, uniqueSpecs: {},
      relationships: [{ childDataset: hostile, childColumn: hostile, parentDataset: hostile, parentColumn: hostile }] };
    const svg = renderSchemaDiagramSvg(layoutSchemaDiagram(buildWorkspaceSchemaDescriptor(extended))); inspectSvg(svg);
    expect(svg).toContain(escapeSvgText(hostile));
    expect((svg.match(/<[^>]*>/g) ?? []).join("")).not.toMatch(/<script|<image|<foreignObject|<animate|<!DOCTYPE|\sonload=|\sonerror=/);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(ids.every(id => !id.includes(hostile))).toBe(true);
  });

  it("replaces invalid XML characters while retaining valid Unicode, entities and line metadata as text", () => {
    expect(escapeSvgText("\u0000\u0001\ud800\ufffe😀地域\t\r\n<&\"'"))
      .toBe("����😀地域&#9;&#13;\n&lt;&amp;&quot;&apos;");
    expect(escapeSvgText("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });

  it("retains complete long identifiers visibly and in descriptions without ellipsis", () => {
    const input = schemaDiagramInput(), label = "long_地域_😀_".repeat(80);
    const layout = layoutSchemaDiagram(buildWorkspaceSchemaDescriptor({ ...input, mappings: { ...input.mappings, notes: [{ source: "body", target: label }] } }));
    const svg = renderSchemaDiagramSvg(layout); inspectSvg(svg);
    expect(svg).toContain(escapeSvgText(label)); expect(layout.tables.find(table => table.name === "notes")!.columns[0].nameText.lines.join("")).toBe(label);
    expect(svg).not.toContain("…");
  });

  it("renders all 1,000 column groups without clipping, pagination or omission", () => {
    const layout = layoutSchemaDiagram(buildWorkspaceSchemaDescriptor(wideSchemaInput())), svg = renderSchemaDiagramSvg(layout);
    inspectSvg(svg); expect(svg.match(/id="er-0-table-0-column-\d+"/g)).toHaveLength(1000);
    expect(svg).toContain("column_0999"); expect(svg).toContain(`height="${layout.height}"`);
  });

  it("retains unresolved declarations, diagnostics and zero-pair FKs without fake paths", () => {
    const input = schemaDiagramInput();
    const layout = layoutSchemaDiagram(buildWorkspaceSchemaDescriptor({ ...input, relationships: [
      { childDataset: "people", childColumns: ["billing", "missing"], parentDataset: "addresses", parentColumns: ["id"] },
      { childDataset: "missing_dataset", childColumns: [], parentDataset: "addresses", parentColumns: [] },
    ] }));
    const svg = renderSchemaDiagramSvg(layout); inspectSvg(svg);
    expect(svg.match(/marker-end=/g)).toHaveLength(1); expect(svg).toContain('stroke-dasharray="5 4"');
    expect(svg).toContain("missing_dataset"); expect(svg).toContain("UNRESOLVED"); expect(svg).toContain("INVALID_FOREIGN_KEY");
    expect(svg.match(/id="er-0-fk-\d+"/g)).toHaveLength(2);
  });

  it("supports collision-free inline instances without deriving IDs from user names", () => {
    const layout = fixture(), a = inspectSvg(renderSchemaDiagramSvg(layout, { instanceId: 4 })), b = inspectSvg(renderSchemaDiagramSvg(layout, { instanceId: 5 }));
    expect(a.every(id => !b.includes(id))).toBe(true);
    expect(renderSchemaDiagramSvg(layout, { instanceId: 4 })).toBe(renderSchemaDiagramSvg(layout, { instanceId: 4 }));
  });

  it.each([NaN, Infinity, -1, 1.5])("rejects invalid SVG instance numbers: %s", instanceId => {
    expect(() => renderSchemaDiagramSvg(fixture(), { instanceId })).toThrow("presentation options");
  });

  it("rejects unknown themes and invalid geometry before returning markup", () => {
    expect(() => renderSchemaDiagramSvg(fixture(), { theme: '" onload="alert(1)' as "light" })).toThrow("presentation options");
    for (const width of [NaN, Infinity, -1, 0, 1e10]) expect(() => renderSchemaDiagramSvg({ ...fixture(), width })).toThrow();
    const layout = fixture();
    expect(() => renderSchemaDiagramSvg({ ...layout, tables: [{ ...layout.tables[0], x: '" onload="alert(1)' as unknown as number }] })).toThrow("geometry");
  });

  it("does not read or emit owner identity, raw values, history, credentials or extra attributes", () => {
    const layout = fixture(), extended = { ...layout };
    for (const key of ["rows", "correctionHistory", "credentials", "identity", "onload", "toJSON"]) Object.defineProperty(extended, key, { get() { throw new Error("PRIVATE_READ"); } });
    const svg = renderSchemaDiagramSvg(extended); inspectSvg(svg);
    expect(svg).not.toMatch(/PRIVATE_READ|PRIVATE_CONFIGURATION_IDENTITY|configurationKey|correctionHistory/);
  });
});
