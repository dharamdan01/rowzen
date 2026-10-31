"use client";

/** The viewport changes presentation only; all dependency semantics come from the existing engine. */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus } from "lucide-react";
import { Button } from "../ui/primitives";
import { datasetLabelLines, layoutDependencyNodes } from "./dependency-graph-layout";
import type { ForeignKeyDeclaration } from "../../lib/rehearsal/foreign-keys";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import { buildReadinessInsights } from "../../lib/reports/readiness-insights";
import { themeTokens, type ThemeToken } from "../../lib/theme/tokens";

// SVG presentation attributes need a fallback while a cached stylesheet lacks newer tokens.
const graphColors: Record<string, string> = Object.fromEntries(([
  "foreground", "info", "danger", "warning", "muted-foreground", "info-surface", "danger-surface", "warning-surface", "surface-muted",
] satisfies ThemeToken[]).map(name => [name, `var(--${name}, ${themeTokens.light[name]})`]));

export default function DependencyGraph({
  report,
  relationships,
}: {
  report: RehearsalReportV1;
  relationships: readonly ForeignKeyDeclaration[];
}) {
  const { dependency } = useMemo(() => buildReadinessInsights(report, relationships), [report, relationships]);
  const hasDatasets = report.datasets.length > 0;
  const [viewport, setViewport] = useState({ width: 640, height: 420 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const observedWidth = useRef(640);
  const markerId = useId().replaceAll(":", "");
  const activeSelection = selected && report.datasets.includes(selected) ? selected : null;
  const model = layoutDependencyNodes(report.datasets, dependency.importOrder, viewport.width);
  const positions = new Map(model.nodes.map(node => [node.name, node]));
  const visibleEdges = activeSelection ? dependency.edges.filter(edge => edge.parentDataset === activeSelection || edge.childDataset === activeSelection) : dependency.edges;
  const isCycleEdge = (parent: string, child: string) => dependency.cycleGroups.some(group => group.includes(parent) && group.includes(child));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    observedWidth.current = 0;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width > 0 && observedWidth.current !== width) {
        observedWidth.current = width;
        setViewport({ width, height: 420 });
        const nextModel = layoutDependencyNodes(report.datasets, dependency.importOrder, width);
        const fitted = Math.min(width / nextModel.width, 420 / nextModel.height, 1);
        setZoom(fitted);
        setPan({ x: (nextModel.width - width / fitted) / 2, y: (nextModel.height - 420 / fitted) / 2 });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasDatasets, report.datasets, dependency.importOrder]);

  function changeZoom(next: number) {
    const limited = Math.max(0.1, Math.min(3, next));
    setPan(previous => ({ x: previous.x + viewport.width / zoom / 2 - viewport.width / limited / 2,
      y: previous.y + viewport.height / zoom / 2 - viewport.height / limited / 2 }));
    setZoom(limited);
  }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }
  function fitView() {
    const fitted = Math.min(viewport.width / model.width, viewport.height / model.height, 1);
    setZoom(fitted);
    setPan({ x: (model.width - viewport.width / fitted) / 2, y: (model.height - viewport.height / fitted) / 2 });
  }
  function moveView(x: number, y: number) {
    setPan(previous => ({ x: previous.x + x / zoom, y: previous.y + y / zoom }));
  }
  function revealNode(node: typeof model.nodes[number]) {
    if (node.x < pan.x || node.x + node.width > pan.x + viewport.width / zoom || node.y < pan.y || node.y + node.height > pan.y + viewport.height / zoom) {
      setPan({ x: node.x + node.width / 2 - viewport.width / zoom / 2, y: node.y + node.height / 2 - viewport.height / zoom / 2 });
    }
  }

  return (
    <section aria-labelledby="dependency-heading" className="min-w-0 space-y-5">
      <div>
        <h3 id="dependency-heading" className="text-lg font-semibold text-foreground">Dataset dependencies</h3>
        <p className="mt-1 text-sm text-muted-foreground">Parent → child means the parent should be imported first. This is advisory, not an executed database plan.</p>
      </div>
      {dependency.cycleGroups.length > 0 && (
        <div role="alert" className="space-y-2 rounded-md border border-danger bg-danger-surface p-3 text-sm text-danger">
          <p className="font-semibold">Dependency cycle groups</p>
          <ul className="list-disc space-y-1 pl-5">
            {dependency.cycleGroups.map((group) => <li key={JSON.stringify(group)} className="[overflow-wrap:anywhere]">{group.join(" ↔ ")}</li>)}
          </ul>
          <p>There is no complete parent-first order for cyclic datasets.</p>
        </div>
      )}

      {dependency.blockedByCycles.length > 0 && (
        <div role="status" className="rounded-md border border-warning bg-warning-surface p-3 text-sm text-warning">
          <p className="font-semibold">Downstream datasets blocked by cycles</p>
          <p className="mt-1 [overflow-wrap:anywhere]">{dependency.blockedByCycles.join(", ")}</p>
          <p className="mt-1 text-muted-foreground">These datasets are not necessarily cycle members; they depend on unresolved cyclic datasets.</p>
        </div>
      )}

      <div className="space-y-2">
        {dependency.orderKind !== "UNAVAILABLE" ? (
          <>
            <p className="text-sm font-semibold text-foreground">{dependency.orderKind === "PARTIAL" ? "Partial import order:" : "Suggested import order:"}</p>
            <ol className="flex flex-wrap gap-2" aria-label="Parent-first dataset order">
              {dependency.importOrder.map((name, index) => (
                <li key={name} className="min-w-0 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm [overflow-wrap:anywhere]">
                  <span className="font-semibold">{index + 1}.</span> {name}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p role="status" className="text-sm font-semibold text-danger">Import order unavailable</p>
        )}
        <p className="text-sm text-muted-foreground">{dependency.reason}</p>
        {dependency.unresolvedDatasets.length > 0 && dependency.cycleGroups.length > 0 && (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Unresolved datasets: {dependency.unresolvedDatasets.join(", ")}</p>
        )}
      </div>

      {hasDatasets ? <>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted p-2" role="group" aria-label="Dependency diagram controls">
          <Button type="button" aria-label="Zoom out dependency diagram" className="min-w-11" style={{ paddingInline: 12 }} disabled={zoom <= 0.1} onClick={() => changeZoom(zoom - 0.25)}><Minus aria-hidden="true" className="size-4" /></Button>
          <output aria-label="Diagram zoom" className="min-w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</output>
          <Button type="button" aria-label="Zoom in dependency diagram" className="min-w-11" style={{ paddingInline: 12 }} disabled={zoom >= 3} onClick={() => changeZoom(zoom + 0.25)}><Plus aria-hidden="true" className="size-4" /></Button>
          <Button type="button" style={{ paddingInline: 12 }} onClick={fitView}>Fit diagram</Button>
          <Button type="button" style={{ paddingInline: 12 }} onClick={resetView}>Reset view</Button>
          <div role="group" aria-label="Pan dependency diagram" className="flex gap-2">
            <Button type="button" aria-label="Pan diagram left" className="min-w-11" style={{ paddingInline: 12 }} onClick={() => moveView(-80, 0)}><ArrowLeft aria-hidden="true" className="size-4" /></Button>
            <Button type="button" aria-label="Pan diagram up" className="min-w-11" style={{ paddingInline: 12 }} onClick={() => moveView(0, -80)}><ArrowUp aria-hidden="true" className="size-4" /></Button>
            <Button type="button" aria-label="Pan diagram down" className="min-w-11" style={{ paddingInline: 12 }} onClick={() => moveView(0, 80)}><ArrowDown aria-hidden="true" className="size-4" /></Button>
            <Button type="button" aria-label="Pan diagram right" className="min-w-11" style={{ paddingInline: 12 }} onClick={() => moveView(80, 0)}><ArrowRight aria-hidden="true" className="size-4" /></Button>
          </div>
        </div>
        <p id={`${markerId}-help`} className="text-sm text-muted-foreground">Drag blank space or focus the diagram and use arrow keys to pan. Select a dataset to highlight its relationships. Home resets the view.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Dependency diagram legend">
          <span className="font-medium text-info">Blue: dependency</span>
          <span className="font-medium text-danger">Red: cycle</span>
          <span className="font-medium text-warning">Amber / dashed: blocked downstream</span>
          <span className="text-muted-foreground">Gray: unresolved order</span>
        </div>
        <div ref={containerRef} className="min-w-0 overflow-hidden rounded-lg border border-control-border bg-surface">
          <svg role="group" aria-label="Interactive dataset dependency diagram" aria-describedby={`${markerId}-help`} tabIndex={0}
            className="block h-105 w-full touch-none rounded-lg outline-offset-2" style={{ height: 420, cursor: "grab" }}
            viewBox={`${pan.x} ${pan.y} ${viewport.width / zoom} ${viewport.height / zoom}`}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
              if (moves[event.key]) { event.preventDefault(); moveView(...moves[event.key]); }
              if (event.key === "Home") { event.preventDefault(); resetView(); }
            }}
            onPointerDown={event => {
              if (event.button !== 0 || !event.isPrimary || (event.target as Element).closest("[data-dataset-node]")) return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            }}
            onPointerMove={event => {
              const start = drag.current;
              if (start?.id === event.pointerId) setPan({ x: start.panX - (event.clientX - start.x) / zoom, y: start.panY - (event.clientY - start.y) / zoom });
            }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}>
            <defs>{["info", "danger", "warning"].map(tone => <marker key={tone} id={`${markerId}-${tone}`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 9 4.5 L 0 9 z" fill={graphColors[tone]} /></marker>)}</defs>
            <g aria-hidden="true" fill="none" strokeWidth="2">
              {dependency.edges.map((edge, index) => {
                const parent = positions.get(edge.parentDataset);
                const child = positions.get(edge.childDataset);
                if (!parent || !child) return null;
                const cycle = isCycleEdge(parent.name, child.name);
                const blocked = !cycle && dependency.blockedByCycles.includes(child.name);
                const tone = cycle ? "danger" : blocked ? "warning" : "info";
                const sx = parent.column === 0 ? parent.x + parent.width : parent.x;
                const tx = child.column === 0 ? child.x + child.width : child.x;
                const portOffset = (index - (dependency.edges.length - 1) / 2) * Math.min(10, 40 / Math.max(1, dependency.edges.length));
                const sy = parent.y + parent.height / 2 + portOffset;
                const ty = child.y + child.height / 2 + portOffset;
                const lane = (model.nodes[0]?.x ?? 20) + parent.width + 12 + (model.gap - 24) * (index + 1) / (dependency.edges.length + 1);
                const path = parent.name === child.name
                  ? `M ${parent.x + parent.width * 0.65} ${parent.y} C ${parent.x + parent.width + 30} ${parent.y - 36}, ${parent.x + parent.width + 30} ${parent.y + parent.height + 36}, ${parent.x + parent.width * 0.65} ${parent.y + parent.height}`
                  : `M ${sx} ${sy} H ${lane} V ${ty} H ${tx}`;
                return <path key={JSON.stringify([parent.name, child.name])} data-edge-kind={cycle ? "cycle" : blocked ? "blocked" : "dependency"}
                  d={path} stroke={graphColors[tone]} strokeLinejoin="round" strokeDasharray={blocked ? "6 4" : undefined}
                  opacity={activeSelection && parent.name !== activeSelection && child.name !== activeSelection ? 0.15 : 1} markerEnd={`url(#${markerId}-${tone})`} />;
              })}
            </g>
            {model.nodes.map(node => {
              const cycle = dependency.cycleGroups.findIndex(group => group.includes(node.name));
              const blocked = dependency.blockedByCycles.includes(node.name);
              const order = dependency.importOrder.indexOf(node.name);
              const state = cycle >= 0 ? `Cycle group ${cycle + 1}` : blocked ? "Blocked by cycle" : order >= 0 ? `Order ${order + 1}` : "Unresolved order";
              const tone = cycle >= 0 ? "danger" : blocked ? "warning" : order >= 0 ? "info" : "muted-foreground";
              const fill = cycle >= 0 ? "danger-surface" : blocked ? "warning-surface" : order >= 0 ? "info-surface" : "surface-muted";
              return <g key={node.name} data-dataset-node={node.name} role="button" tabIndex={0} aria-label={`${node.name}: ${state}`} aria-pressed={activeSelection === node.name}
                style={{ cursor: "pointer" }} onFocus={() => revealNode(node)} onClick={() => setSelected(activeSelection === node.name ? null : node.name)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(activeSelection === node.name ? null : node.name); } }}>
                <title>{`${node.name}: ${state}`}</title>
                <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="8" fill={graphColors[fill]} stroke={activeSelection === node.name ? graphColors.foreground : graphColors[tone]} strokeWidth={activeSelection === node.name ? 3 : 1.5} />
                <text x={node.x + 12} y={node.y + 26} fill={graphColors.foreground} fontSize="14" fontWeight="600">
                  {datasetLabelLines(node.name, node.width).map((line, index) => <tspan key={index} x={node.x + 12} dy={index === 0 ? 0 : 19}>{line}</tspan>)}
                </text>
                <text x={node.x + 12} y={node.y + 82} fill={graphColors[tone]} fontSize="12">{state}</text>
              </g>;
            })}
          </svg>
        </div>
        {activeSelection && <div role="status" className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold [overflow-wrap:anywhere]">Highlighted dataset: {activeSelection}</p>
          <p>{visibleEdges.length} connected relationship{visibleEdges.length === 1 ? "" : "s"}. Select the dataset again to clear the highlight.</p>
          <Button type="button" onClick={() => setSelected(null)}>Show all relationships</Button>
        </div>}
      </> : <p role="status" className="text-sm text-muted-foreground">No datasets available to draw.</p>}
      <details className="rounded-lg border border-border p-4">
        <summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold">Relationships as text ({dependency.edges.length})</summary>
        {dependency.edges.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Parent to child dependencies">
            {dependency.edges.map(({ parentDataset, childDataset }) => (
              <li key={JSON.stringify([parentDataset, childDataset])} className="min-w-0 rounded-md border border-border bg-surface-muted p-3 text-sm [overflow-wrap:anywhere]">
                <span className="font-semibold">{parentDataset}</span> <span aria-label="before">→</span> {childDataset}
                {isCycleEdge(parentDataset, childDataset) && (
                  <span className="ml-2 text-danger">(within the same cycle group)</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No usable inter-dataset dependency edges to display.</p>
        )}

      </details>
    </section>
  );
}
