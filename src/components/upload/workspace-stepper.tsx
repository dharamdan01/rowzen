"use client";

import { useId } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button, Select } from "../ui/primitives";
import type { StepState, WorkspaceStep } from "../../lib/workspace/steps";

export default function WorkspaceStepper({ current, steps, blocked = false, pendingMessage = "", back, next, onStep, onBack, onContinue }: {
  current: WorkspaceStep; steps: readonly StepState[]; blocked?: boolean; pendingMessage?: string;
  back: WorkspaceStep | null; next: WorkspaceStep | null;
  onStep: (step: WorkspaceStep) => void; onBack: () => void; onContinue: () => void;
}) {
  const id = useId();
  const destination = steps.find(step => step.id === next);
  const nextEnabled = Boolean(destination?.available) && !blocked;
  const stepLabel = (step: WorkspaceStep) => steps.find(entry => entry.id === step)!.label;
  return <div className="sticky top-0 z-20 space-y-3 border-b border-border bg-background py-3">
    <nav aria-label="CSV workflow steps">
      <label className="block md:hidden"><span className="sr-only">Workspace step</span>
        <Select aria-label="Workspace step" value={current} disabled={blocked} onChange={event => onStep(event.target.value as WorkspaceStep)}>
          {steps.map((step,index) => <option key={step.id} value={step.id} disabled={!step.available}>{index+1}. {step.label} ({step.id === current ? "Current" : step.status}{step.reason ? `: ${step.reason}` : ""})</option>)}
        </Select>
      </label>
      <ol role="list" className="hidden grid-cols-6 gap-2 md:grid">
        {steps.map((step,index) => <li key={step.id} className="min-w-0">
          <Button type="button" variant={step.id === current ? "primary" : "secondary"} disabled={!step.available || blocked} aria-label={step.label}
            aria-current={step.id === current ? "step" : undefined} aria-describedby={`${id}-${step.id}`} title={step.reason || step.description}
            onClick={() => onStep(step.id)} className="w-full flex-col gap-1 px-2 py-2">
            <span className="flex items-center gap-2"><span aria-hidden="true">{step.complete && step.id !== current ? <Check className="size-3.5 text-success" /> : index+1}</span>{step.label}</span>
            <span id={`${id}-${step.id}`} className="text-xs font-normal">{step.id === current ? "Current" : step.status}<span className="sr-only">{step.reason ? `. ${step.reason}` : ""}</span></span>
          </Button>
        </li>)}
      </ol>
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" aria-label={back ? `Back to ${stepLabel(back)}` : "Back"} disabled={!back || blocked} onClick={onBack}><ArrowLeft aria-hidden="true" className="size-4" />Back</Button>
      {next && <Button type="button" variant="primary" aria-label={`Continue to ${stepLabel(next)}`} disabled={!nextEnabled} onClick={onContinue}>
        {next === "export" ? "Export" : "Continue"}<ArrowRight aria-hidden="true" className="size-4" />
      </Button>}
    </div>
    {pendingMessage && <p role="status" className="text-xs text-muted-foreground">{pendingMessage}</p>}
  </div>;
}
