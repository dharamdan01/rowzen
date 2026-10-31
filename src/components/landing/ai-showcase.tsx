"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Check, Monitor, Sparkles } from "lucide-react";
import { MappingIllustration, RepairIllustration, RootCauseIllustration } from "./ai-workflow-illustrations";
import { AiProcessingDetails } from "../ai/ai-presentation";

const features = [
  { id: "mapping", label: "Schema mapping", title: "Give every column a clear direction.",
    description: "Review suggested mappings and types. Compare your schema with an approved template to find added, removed or changed columns.",
    boundary: "You review and approve selected suggestions.", Illustration: MappingIllustration },
  { id: "analysis", label: "Issue analysis", title: "Understand what to investigate next.",
    description: "Explore possible causes linked to verified findings and inspect potential downstream impact through your configured relationships.",
    boundary: "Validation findings stay separate from AI explanations.", Illustration: RootCauseIllustration },
  { id: "repair", label: "Repair planning", title: "See the difference before you decide.",
    description: "Compare a suggested repair with the original value. Run a deterministic What-if preview before approving the change.",
    boundary: "No automatic edits. No invented missing values.", Illustration: RepairIllustration },
] as const;

export default function AiShowcase() {
  const hosted = process.env.NEXT_PUBLIC_AI_PROVIDER === "groq";
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const cards = section.current?.querySelectorAll<HTMLElement>("[data-ai-feature]");
    if (!cards || !window.IntersectionObserver) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    function observe() {
      observer?.disconnect();
      cards!.forEach(card => card.removeAttribute("data-ai-visible"));
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          entry.target.setAttribute("data-ai-visible", "true");
          observer?.unobserve(entry.target);
        }
      }, { threshold: 0.12 });
      cards!.forEach(card => observer!.observe(card));
    }
    observe();
    preference.addEventListener("change", observe);
    return () => { observer?.disconnect(); preference.removeEventListener("change", observe); };
  }, []);

  return <section ref={section} aria-labelledby="ai-features" className="rz-ai-showcase border-t border-border">
    <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="rz-ai-intro">
        <p className="rz-ai-eyebrow"><Sparkles aria-hidden="true" />Review with confidence</p>
        <h2 id="ai-features" tabIndex={-1} className="scroll-mt-24 text-3xl font-semibold tracking-tight sm:text-4xl">Guidance for your next step.</h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">AI suggestions help you map columns, investigate findings and preview repairs. You review every change.</p>
      </div>
      <div className="rz-ai-features">
        {features.map(({ id, label, title, description, boundary, Illustration }, index) => <article key={id} data-ai-feature={id} aria-labelledby={`ai-${id}-title`} className="rz-ai-feature">
          <div className="rz-ai-feature-copy">
            <p className="rz-ai-feature-label"><span aria-hidden="true">0{index + 1}</span>{label}</p>
            <h3 id={`ai-${id}-title`} className="mt-4 max-w-md text-2xl font-semibold leading-tight tracking-tight lg:text-3xl">{title}</h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
            <p className="rz-ai-boundary"><Check aria-hidden="true" />{boundary}</p>
          </div>
          <Illustration />
        </article>)}
      </div>
      <div className="rz-ai-availability">
        <div className="rz-ai-local-note"><Monitor aria-hidden="true" /><div><p className="font-medium text-foreground">Approve what you share</p><p>{hosted ? "Suggestions use Groq's hosted service." : "Suggestions require Ollama on your device."} Review and approve metadata before each request. Raw CSV values stay in your browser. Manual workflows remain available.</p><AiProcessingDetails hosted={hosted} /></div></div>
        <div className="rz-ai-start"><Link href="/upload" className="rz-ai-cta">Open workspace<ArrowUpRight aria-hidden="true" /></Link><p>Sign in to work with your files.</p></div>
      </div>
    </div>
  </section>;
}
