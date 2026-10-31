/** Diagram coordinates only. Ordering and cycle analysis stay in the existing graph engine. */
export function layoutDependencyNodes(names: readonly string[], order: readonly string[], width: number) {
  const arranged = [...new Set([...order.filter(name => names.includes(name)), ...names])];
  const columns = width >= 600 ? 2 : 1;
  const padding = columns === 2 ? 40 : 20;
  const nodeWidth = columns === 2 ? Math.min(220, (width - 200) / 2) : Math.max(100, width - 88);
  const gap = columns === 2 ? width - padding * 2 - nodeWidth * 2 : 48;
  const nodeHeight = 100;
  const nodes = arranged.map((name, index) => ({
    name, x: padding + (index % columns) * (nodeWidth + gap),
    y: 40 + Math.floor(index / columns) * 168,
    width: nodeWidth, height: nodeHeight, column: index % columns,
  }));
  return { nodes, width, height: Math.max(200, Math.ceil(nodes.length / columns) * 168 + 12), gap };
}

/** Keep SVG labels inside their node; full names remain in titles and text alternatives. */
export function datasetLabelLines(name: string, width: number): string[] {
  const characters = Array.from(name);
  const length = Math.max(8, Math.floor((width - 24) / 8));
  return characters.length <= length ? [name] : [characters.slice(0, length).join(""),
    characters.length > length * 2 ? characters.slice(length, length * 2 - 1).join("") + "\u2026" : characters.slice(length).join("")];
}
