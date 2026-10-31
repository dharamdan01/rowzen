import type { ReactNode } from "react";

// Presentation only. Request ownership, evidence and approval stay with each assistant.
export const aiPanel = "min-w-0 space-y-4 rounded-xl border border-border bg-surface p-4 [overflow-wrap:anywhere] sm:p-5";
export const aiDisclosure = "min-h-11 cursor-pointer content-center rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function AiProcessingDetails({ hosted }: { hosted: boolean }) {
  return <details className="text-sm text-muted-foreground">
    <summary className={aiDisclosure}>Processing details</summary>
    <p className="pb-3 leading-relaxed">{hosted
      ? "Requests pass through Rowzen's server to Groq (gpt-oss-20b). Groq's data policy applies. Rowzen does not save the response. There is no automatic local/cloud fallback."
      : "Requests go to Ollama on this device at 127.0.0.1:11434 using qwen2.5:0.5b. Rowzen does not save the response. There is no cloud fallback."}</p>
  </details>;
}

export function AiLabel({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "advice" | "warning" }) {
  const colors = tone === "advice" ? "border-primary/30 bg-info-surface text-primary" : tone === "warning" ? "border-warning/30 bg-warning-surface text-warning" : "border-border bg-surface-muted text-muted-foreground";
  return <span className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium leading-relaxed ${colors}`}>{children}</span>;
}

export function AiStep({ number, title, current = false }: { number: number; title: string; current?: boolean }) {
  return <li aria-current={current ? "step" : undefined} className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${current ? "border-primary bg-info-surface font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>
    <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${current ? "border-primary bg-info-surface" : "border-control-border"}`}>{number}</span><span>{title}</span>
  </li>;
}
