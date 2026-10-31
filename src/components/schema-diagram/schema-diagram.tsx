"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import type { WorkspaceSchemaDescriptor } from "../../lib/schema-diagram/types";
import { layoutSchemaDiagram } from "../../lib/schema-diagram/layout";
import { renderSchemaDiagramSvg } from "../../lib/schema-diagram/svg";
import { Button, Select } from "../ui/primitives";
import SchemaDiagramTable from "./schema-diagram-table";
import { useDiagramViewport } from "./use-diagram-viewport";

function subscribeTheme(change: () => void) { window.addEventListener("datarehearsal:theme-change", change); return () => window.removeEventListener("datarehearsal:theme-change", change); }
function themeSnapshot(): "light" | "dark" { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function serverTheme(): "light" | "dark" { return "light"; }

export default function SchemaDiagram({ descriptor, active }: { descriptor: WorkspaceSchemaDescriptor; active: boolean }) {
  const helpId = useId();
  const layout = useMemo(() => layoutSchemaDiagram(descriptor), [descriptor]);
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, serverTheme);
  const markup = useMemo(() => renderSchemaDiagramSvg(layout), [layout]);
  const themedMarkup = useMemo(() => theme === "light" ? markup : renderSchemaDiagramSvg(layout, { theme }), [layout, markup, theme]);
  const [mode, setMode] = useState<"diagram" | "tables">("diagram"), [tableEntity, setTableEntity] = useState(0);
  const [selection, setSelection] = useState<{ kind: "entity" | "relationship"; index: number } | null>(null);
  const bounds = useMemo(() => ({ x: 0, y: 104, width: layout.width, height: Math.max(100, ...layout.tables.map(table => table.y + table.height - 104)) + 24 }), [layout]);
  const viewport = useDiagramViewport(bounds, active && mode === "diagram");
  const { container, camera } = viewport;
  useEffect(() => {
    container.current?.querySelector("svg")?.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.width / camera.zoom} ${camera.height / camera.zoom}`);
  }, [container, camera, themedMarkup]);
  useEffect(() => {
    const svg = container.current?.querySelector("svg");
    if (!svg) return;
    const fk = selection?.kind === "relationship" ? layout.relationships[selection.index] : null;
    for (const group of svg.querySelectorAll<SVGGElement>("g[id]")) {
      const tableMatch = /^er-0-table-(\d+)$/.exec(group.id), fkMatch = /^er-0-fk-(\d+)$/.exec(group.id);
      if (tableMatch) {
        const index = Number(tableMatch[1]), table = layout.tables[index];
        const highlighted = !selection || selection.kind === "entity" && selection.index === index || Boolean(fk?.pairs.some(pair => pair.child.datasetId === table.descriptorId || pair.parent.datasetId === table.descriptorId));
        group.setAttribute("opacity", highlighted ? "1" : "0.3");
        group.querySelector("rect")?.setAttribute("stroke-width", selection?.kind === "entity" && selection.index === index ? "3" : "1");
      }
      if (fkMatch) {
        const index = Number(fkMatch[1]), relationship = layout.relationships[index];
        const selectedTable = selection?.kind === "entity" ? layout.tables[selection.index] : null;
        const highlighted = !selection || selection.kind === "relationship" && selection.index === index || Boolean(selectedTable && relationship.pairs.some(pair => pair.child.datasetId === selectedTable.descriptorId || pair.parent.datasetId === selectedTable.descriptorId));
        group.setAttribute("opacity", highlighted ? "1" : "0.12");
      }
    }
  }, [container, layout, selection, themedMarkup]);
  function inspectEntity(index: number) {
    if (index < 0) { setSelection(null); return; }
    const table = layout.tables[index]; if (!table) return;
    setSelection({ kind: "entity", index }); setTableEntity(index);
    viewport.fit({ x: table.x - 16, y: table.y - 16, width: table.width + 64, height: table.height + 32 });
  }
  function inspectRelationship(index: number) {
    if (index < 0) { setSelection(null); return; }
    const fk = layout.relationships[index]; if (!fk) return;
    setSelection({ kind: "relationship", index });
    const points = fk.pairs.flatMap(pair => pair.points);
    if (points.length) {
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      viewport.fit({ x: Math.min(...xs) - 80, y: Math.min(...ys) - 32, width: Math.max(...xs) - Math.min(...xs) + 160, height: Math.max(...ys) - Math.min(...ys) + 64 });
    }
  }
  const selectedEntity = selection?.kind === "entity" ? layout.tables[selection.index] : null;
  const selectedRelationship = selection?.kind === "relationship" ? layout.relationships[selection.index] : null;
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Schema presentation">
      <Button type="button" variant={mode === "diagram" ? "primary" : "secondary"} aria-pressed={mode === "diagram"} onClick={() => setMode("diagram")}>Diagram</Button>
      <Button type="button" variant={mode === "tables" ? "primary" : "secondary"} aria-pressed={mode === "tables"} onClick={() => setMode("tables")}>Schema tables</Button>
    </div>
    <div hidden={mode !== "diagram"} className="min-w-0 space-y-3">
      <div role="group" aria-label="Schema diagram viewport controls" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted p-2">
        <Button type="button" aria-label="Zoom out schema diagram" onClick={() => viewport.zoomBy(1 / 1.25)}>−</Button>
        <output aria-label="Schema diagram zoom" className="min-w-12 text-center text-sm tabular-nums">{Math.round(camera.zoom * 100)}%</output>
        <Button type="button" aria-label="Zoom in schema diagram" disabled={camera.zoom >= 4} onClick={() => viewport.zoomBy(1.25)}>+</Button>
        <Button type="button" onClick={() => viewport.fit()}>Fit schema diagram</Button><Button type="button" onClick={viewport.reset}>Reset schema view</Button>
        <div role="group" aria-label="Pan schema diagram" className="flex gap-1">
          {([[-80, 0, "left", "←"], [0, -80, "up", "↑"], [0, 80, "down", "↓"], [80, 0, "right", "→"]] as const).map(([x, y, direction, label]) =>
            <Button key={direction} type="button" aria-label={`Pan schema ${direction}`} style={{ paddingInline: 10 }} onClick={() => viewport.move(x, y)}>{label}</Button>)}
        </div>
      </div>
      <p id={helpId} className="text-xs text-muted-foreground">Drag blank space or use arrow keys to pan. + / − zoom; Home resets; F fits. Select an entity or relationship to inspect.</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">Inspect entity<Select aria-label="Inspect schema entity" value={selection?.kind === "entity" ? selection.index : -1} onChange={event => inspectEntity(Number(event.target.value))}>
          <option value={-1}>All entities</option>{layout.tables.map((table, index) => <option key={table.descriptorId} value={index}>{table.name}</option>)}
        </Select></label>
        <label className="min-w-0 text-sm">Inspect relationship<Select aria-label="Inspect schema relationship" value={selection?.kind === "relationship" ? selection.index : -1} onChange={event => inspectRelationship(Number(event.target.value))}>
          <option value={-1}>All relationships</option>{layout.relationships.map((fk, index) => <option key={fk.descriptorId} value={index}>{fk.label}: {fk.detail.slice(fk.label.length + 2)}</option>)}
        </Select></label>
      </div>
      {selection && <div role="status" tabIndex={0} aria-label="Schema inspection details" className="max-h-48 overflow-auto rounded-lg border border-border p-3 text-sm [overflow-wrap:anywhere]">
        {selectedEntity && <p>Entity {selectedEntity.name}: {selectedEntity.columns.length} columns. {selectedEntity.constraints.join("; ") || "No key groups configured."}</p>}
        {selectedRelationship && <><p>{selectedRelationship.detail}</p><ul>{selectedRelationship.pairs.map(pair => <li key={pair.position}>Pair {pair.position + 1}: {pair.child.dataset}.{pair.child.target ?? "Missing component"} → {pair.parent.dataset}.{pair.parent.target ?? "Missing component"} ({pair.child.state}; {pair.parent.state})</li>)}</ul></>}
        <Button type="button" className="mt-2" onClick={() => setSelection(null)}>Clear schema inspection</Button>
      </div>}
      <div ref={container} tabIndex={0} role="group" aria-label="Interactive schema diagram" aria-describedby={helpId}
        className="h-105 min-w-0 overflow-hidden rounded-lg border border-control-border bg-surface outline-offset-2 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ height: 420, touchAction: "none", cursor: "grab" }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
          if (moves[event.key]) { event.preventDefault(); viewport.move(...moves[event.key]); }
          if (["+", "=", "-", "_", "Home", "f", "F"].includes(event.key)) {
            event.preventDefault(); if (event.key === "Home") viewport.reset(); else if (event.key.toLowerCase() === "f") viewport.fit();
            else viewport.zoomBy(event.key === "-" || event.key === "_" ? 1 / 1.25 : 1.25);
          }
        }}
        onPointerDown={viewport.pointerDown} onPointerMove={viewport.pointerMove} onPointerUp={viewport.pointerUp} onPointerCancel={viewport.pointerUp}
        onClick={event => {
          const id = (event.target as Element).closest("g[id]")?.id ?? "";
          const entity = /^er-0-table-(\d+)/.exec(id), fk = /^er-0-fk-(\d+)/.exec(id);
          if (entity) inspectEntity(Number(entity[1])); if (fk) inspectRelationship(Number(fk[1]));
        }}
        // Only the fixed-vocabulary Step 2 serializer enters this sink; it escapes every label.
        dangerouslySetInnerHTML={{ __html: themedMarkup }} />
      <p className="text-sm leading-relaxed text-muted-foreground">PK/UQ identify complete constraint groups; FK identifies a reference and its ordered pair. No cardinality is inferred.</p>
    </div>
    <div hidden={mode !== "tables"}><SchemaDiagramTable descriptor={descriptor} layout={layout} entity={tableEntity} onEntityChange={setTableEntity} /></div>
  </div>;
}
