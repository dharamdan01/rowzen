import { ArrowRight, AlertCircle, KeyRound } from "lucide-react";
import type { ParsedCsv } from "../../lib/csv/parser";
import { applyMapping, type ColumnMapping } from "../../lib/rehearsal/mapping";
import type { DatasetRules, FieldType } from "../../lib/rehearsal/rules";
import { Button, Input, Select } from "../ui/primitives";

type Props = {
  dataset: Pick<ParsedCsv, "name" | "filename" | "headers">;
  mapping: readonly ColumnMapping[];
  appliedMapping?: readonly ColumnMapping[];
  pending?: boolean;
  onApply?: () => void;
  onCancel?: () => void;
  rules: DatasetRules;
  fieldTypes: readonly FieldType[];
  onTargetChange: (source: string, target: string) => void;
  onRulesChange: (rules: DatasetRules) => void;
};

export default function SchemaMapping({ dataset, mapping, rules, fieldTypes, onTargetChange, onRulesChange, appliedMapping, pending = false, onApply, onCancel }: Props) {
  const sectionId = `mapping-${encodeURIComponent(dataset.name)}`;
  let error = "";
  try {
    // Reuse canonical mapping checks without mapping any CSV records during typing.
    applyMapping({ name: dataset.name, filename: dataset.filename, headers: dataset.headers, rows: [], rowNumbers: [] }, [...mapping]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Review the column mapping.";
  }

  return (
    <div role="group" aria-label={`Column mapping for ${dataset.filename}`}
      aria-describedby={`${sectionId}-help${error ? ` ${sectionId}-error` : ""}`} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">Column mapping</h3>
        <span className="text-sm text-muted-foreground">{mapping.length} {mapping.length === 1 ? "column" : "columns"}</span>
      </div>
      <p id={`${sectionId}-help`} className="text-sm leading-relaxed text-muted-foreground">Match each CSV column to a target name, then choose its validation rules. Unconfigured types are not checked.</p>
      {error && <p id={`${sectionId}-error`} role="status" className="flex items-start gap-2 rounded-lg border border-danger bg-danger-surface p-3 text-sm text-danger">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
      </p>}
      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {mapping.map((entry, index) => {
          const target = (appliedMapping?.find((applied) => applied.source === entry.source)?.target ?? entry.target).trim();
          const sourceId = `${sectionId}-source-${encodeURIComponent(entry.source)}`;
          return <div key={entry.source} className="grid min-w-0 gap-3 p-3 sm:p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] xl:items-start">
            <div className="min-w-0 space-y-2">
              <span className={`block text-sm font-medium text-muted-foreground ${index ? "xl:sr-only" : ""}`}>CSV column</span>
              <div className="flex min-h-control min-w-0 items-center justify-between gap-3">
                <code id={sourceId} className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{entry.source}</code>
                <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              </div>
            </div>
            <label className="block min-w-0 space-y-2 text-sm font-medium text-foreground">
              <span className={index ? "xl:sr-only" : undefined}>Target column</span>
              <Input aria-label={`Target for ${dataset.name}.${entry.source}`} value={entry.target} aria-invalid={error ? true : undefined}
                aria-describedby={`${sourceId}${pending ? ` ${sectionId}-pending` : ""}${error ? ` ${sectionId}-error` : ""}`}
                onChange={(event) => onTargetChange(entry.source, event.target.value)} />
              {target && rules.primaryKey === target && <span className="flex items-center gap-1.5 text-sm font-normal text-primary"><KeyRound aria-hidden="true" className="size-3.5 shrink-0" />Primary key</span>}
            </label>
            {target ? <>
              <label className="block min-w-0 space-y-2 text-sm font-medium text-foreground">
                <span className={index ? "xl:sr-only" : undefined}>Data type</span>
                <Select id={`${sectionId}-type-${encodeURIComponent(target)}`} disabled={pending} aria-label={`Type of ${dataset.name}.${target}`} value={rules.types[target] ?? ""}
                  onChange={(event) => onRulesChange({ ...rules, types: { ...rules.types, [target]: event.target.value as FieldType } })}>
                  <option value="" disabled>Not configured</option>
                  {fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </label>
              <label className={`flex min-h-control items-center gap-3 text-sm font-medium text-foreground ${index ? "" : "xl:mt-7"}`}>
                <Input disabled={pending} type="checkbox" aria-label={`Required ${dataset.name}.${target}`} checked={rules.required.includes(target)}
                  onChange={(event) => onRulesChange({ ...rules, required: event.target.checked ? [...rules.required, target] : rules.required.filter((name) => name !== target) })} />
                Required
              </label>
            </> : <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-2 xl:pt-9">Enter a target name to configure its rules.</p>}
          </div>;
        })}
      </div>
      {pending && <div className="space-y-3 rounded-lg border border-warning bg-warning-surface p-3 text-sm">
        <p id={`${sectionId}-pending`} role="status">Target names have unapplied changes. Validation, reports and templates still use the applied mapping.</p>
        <p>Apply resets this dataset&apos;s primary, composite and unique keys, data types and required fields, and clears current results. CSV values, corrections and history stay unchanged. Relationships stay unchanged; review their target columns after applying.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={Boolean(error)} aria-label={`Apply mapping for ${dataset.name}`}
            aria-describedby={`${sectionId}-pending${error ? ` ${sectionId}-error` : ""}`}
            onClick={(event) => { onApply?.(); if (!error) event.currentTarget.closest('[role="group"]')?.querySelector<HTMLInputElement>('input')?.focus(); }}>Apply mapping</Button>
          <Button type="button" aria-label={`Cancel mapping for ${dataset.name}`}
            onClick={(event) => { onCancel?.(); event.currentTarget.closest('[role="group"]')?.querySelector<HTMLInputElement>('input')?.focus(); }}>Cancel</Button>
        </div>
      </div>}
      {!pending && <p className="text-sm leading-relaxed text-muted-foreground">Edit target names, then Apply or Cancel. Applying a rename resets this dataset&apos;s keys, types and required fields.</p>}
    </div>
  );
}
