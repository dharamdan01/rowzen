import type { WorkspaceSchemaDescriptor } from "../../lib/schema-diagram/types";
import type { SchemaDiagramLayout } from "../../lib/schema-diagram/layout";
import { Select, Table } from "../ui/primitives";

/** Native bounded tables expose full metadata without expanding the entire Review document. */
export default function SchemaDiagramTable({ descriptor, layout, entity, onEntityChange }: {
  descriptor: WorkspaceSchemaDescriptor; layout: SchemaDiagramLayout; entity: number; onEntityChange: (index: number) => void;
}) {
  const table = layout.tables[entity] ?? layout.tables[0];
  return <div className="min-w-0 space-y-3">
    <label className="block max-w-md text-sm font-medium">Dataset details<Select aria-label="Schema table dataset" className="mt-1" value={entity} onChange={event => onEntityChange(Number(event.target.value))}>
      {layout.tables.map((table, index) => <option key={table.descriptorId} value={index}>{table.name}</option>)}
    </Select></label>
    {table && <div role="region" aria-label="Schema column list" tabIndex={0} className="max-h-96 overflow-auto rounded-lg"><Table scrollLabel={`Schema columns for ${table.name}`}>
      <caption>{table.name}: all {table.columns.length} configured columns</caption>
      <thead><tr><th scope="col">Source</th><th scope="col">Mapped column</th><th scope="col">Type</th><th scope="col">Constraints</th></tr></thead>
      <tbody>{table.columns.map(column => <tr key={column.descriptorId}><th scope="row">{column.source}</th><td>{column.target ?? "Unmapped"}</td><td>{column.type}</td><td>{column.indicators.join(", ") || "None configured"}</td></tr>)}</tbody>
    </Table></div>}
    <details className="rounded-lg border border-border p-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">Constraint groups ({descriptor.keys.length})</summary>
      <div role="region" aria-label="Schema constraint group list" tabIndex={0} className="max-h-72 overflow-auto rounded-lg"><Table scrollLabel="All schema constraint groups"><caption>Complete primary and unique groups</caption>
        <thead><tr><th scope="col">Dataset</th><th scope="col">Kind</th><th scope="col">Columns together</th><th scope="col">Declaration</th></tr></thead>
        <tbody>{descriptor.keys.map(key => <tr key={key.id}><th scope="row">{key.dataset}</th><td>{key.kind}</td><td>{JSON.stringify(key.declaredColumns)}</td><td>{key.effective ? "Effective configuration" : "Not effective"}; {key.columns.every(column => column.state === "RESOLVED") ? "references resolved" : "unresolved references"}</td></tr>)}</tbody>
      </Table></div>
    </details>
    <details className="rounded-lg border border-border p-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">Foreign-key pairs ({layout.relationships.length} declarations)</summary>
      <div role="region" aria-label="Schema foreign-key pair list" tabIndex={0} className="max-h-72 overflow-auto rounded-lg"><Table scrollLabel="All schema foreign-key pairs"><caption>Complete foreign keys; composite pairs retain their order</caption>
        <thead><tr><th scope="col">Relationship</th><th scope="col">Pair</th><th scope="col">Child column</th><th scope="col">Parent column</th><th scope="col">Resolution</th></tr></thead>
        <tbody>{layout.relationships.flatMap(fk => fk.pairs.length ? fk.pairs.map(pair => <tr key={`${fk.descriptorId}:${pair.position}`}>
          <th scope="row">{fk.label}</th><td>{pair.position + 1}</td><td>{pair.child.dataset}.{pair.child.target ?? "Missing component"}</td><td>{pair.parent.dataset}.{pair.parent.target ?? "Missing component"}</td><td>{pair.child.state}; {pair.parent.state}{fk.incomplete ? "; incomplete declaration" : ""}</td>
        </tr>) : [<tr key={fk.descriptorId}><th scope="row">{fk.label}</th><td colSpan={4}>{fk.detail}; no paired columns</td></tr>])}</tbody>
      </Table></div>
    </details>
    <details className="rounded-lg border border-border p-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">All declarations and unresolved details</summary>
      <div role="region" aria-label="Complete schema declaration details" tabIndex={0} className="max-h-72 overflow-auto text-sm [overflow-wrap:anywhere]">
        <ul className="list-disc space-y-2 pl-5">{layout.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
      </div>
    </details>
  </div>;
}
