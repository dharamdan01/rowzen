"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives";
import ProductScreenshot, { FullSizeScreenshot } from "./product-screenshot";

const views = [
  { id: "results", label: "Results & issues", alt: "Actual issue explorer showing duplicate student IDs and a missing department reference in sample CSV data.", caption: "Filter findings by dataset, severity, code or CSV line. Each issue includes a suggested next step." },
  { id: "dependencies", label: "Dependencies", alt: "Actual dependency graph showing departments before students, connected by a parent-to-child arrow.", caption: "See how datasets connect and review the suggested import order. The graph also identifies cycles when they exist." },
  { id: "corrections", label: "Corrections", alt: "Actual correction workspace with department_id changed from 99 to 20, the original value retained for comparison.", caption: "Edit a source cell, compare its original value and revalidate. Undo/redo and activity history keep changes reviewable." },
] as const;

export default function ProductPreview() {
  const [selected, setSelected] = useState<(typeof views)[number]["id"]>("results");
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!preview.current || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { preview.current?.classList.add("rz-reveal-visible"); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={preview} className="mt-7 min-w-0 rounded-xl border border-border bg-surface p-3 sm:p-5">
    <div role="tablist" aria-label="Product interfaces" className="mb-4 flex flex-wrap gap-2">
      {views.map((view,index) => <Button key={view.id} type="button" role="tab" id={`preview-tab-${view.id}`} aria-controls={`preview-panel-${view.id}`} aria-selected={selected === view.id} tabIndex={selected === view.id ? 0 : -1}
        className="dr-landing-tab" onClick={() => setSelected(view.id)} onKeyDown={event => {
          let next = index;
          if(event.key === "ArrowRight") next = (index + 1) % views.length;
          else if(event.key === "ArrowLeft") next = (index + views.length - 1) % views.length;
          else if(event.key === "Home") next = 0;
          else if(event.key === "End") next = views.length - 1;
          else return;
          event.preventDefault();setSelected(views[next].id);document.getElementById(`preview-tab-${views[next].id}`)?.focus();
        }}>{view.label}</Button>)}
    </div>
    {views.map(view => <div key={view.id} id={`preview-panel-${view.id}`} role="tabpanel" aria-labelledby={`preview-tab-${view.id}`} aria-describedby={`preview-caption-${view.id}`} hidden={selected !== view.id}>
      <div role="region" aria-label={`${view.label} screenshot`} tabIndex={0} className="h-108 min-w-0 overflow-auto rounded-lg border border-control-border bg-background sm:h-136">
        {selected === view.id && <ProductScreenshot name={view.id} alt={view.alt} />}
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-1">
        <p id={`preview-caption-${view.id}`} className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{view.caption}</p>
        <FullSizeScreenshot name={view.id} />
      </div>
    </div>)}
    <p className="mt-2 text-xs text-muted-foreground">Actual interface screenshots with sample data. Scroll a screenshot to explore it; use the app to edit your own files.</p>
  </div>;
}
