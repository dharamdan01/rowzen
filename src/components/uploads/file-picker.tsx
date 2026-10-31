"use client";

import { useState } from "react";

export default function FilePicker() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-semibold">
        Upload CSV Files
      </h2>

      <label
        htmlFor="csv-files"
        className="mt-4 block"
      >
        Select CSV files
      </label>

      <input
        id="csv-files"
        type="file"
        accept=".csv,text/csv"
        multiple
        className="mt-2 block w-full"
        onChange={(e) =>
          setFiles(Array.from(e.target.files ?? []))
        }
      />

      <p className="mt-4" role="status">
        {files.length} file(s) selected
      </p>

      <ul className="mt-2 list-disc pl-5">
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`}>
            {file.name}
          </li>
        ))}
      </ul>
    </section>
  );
}