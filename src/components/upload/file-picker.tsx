"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Input } from "../ui/primitives";

type Props = {
  onChoose: (files: File[]) => void;
  disabled?: boolean;
};

export default function FilePicker({ onChoose, disabled = false }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <section aria-label="CSV file selection" aria-busy={disabled}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onChoose(Array.from(event.dataTransfer.files));
      }}
      className={`min-w-0 rounded-xl border border-dashed p-5 transition-colors focus-within:border-primary motion-reduce:transition-none sm:p-8 ${disabled ? "border-border bg-surface-muted" : dragging ? "border-primary bg-info-surface" : "border-control-border bg-surface"}`}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-5">
        <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-info-surface text-primary">
          <UploadCloud className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="csv-files" className="block text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Upload CSV datasets
          </label>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Drop files here, or choose them below.</p>
          <p id="csv-help" className="mt-2 text-sm leading-relaxed text-muted-foreground">1 to 5 CSV files · Up to 1 MB each · <span className="whitespace-nowrap">UTF-8</span>. Comma-separated, with unique, non-empty headers and at least one data row.</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Parsing and preview stay in this browser. Files are not uploaded.</p>
      <Input
        className="mt-4 text-foreground file:rounded-lg file:border-primary file:bg-primary file:text-primary-foreground enabled:file:hover:border-primary-hover enabled:file:hover:bg-primary-hover"
        id="csv-files"
        type="file"
        accept=".csv,text/csv"
        multiple
        disabled={disabled}
        aria-describedby="csv-help"
        onChange={(event) => {
          onChoose(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}

      />
    </section>
  );
}
