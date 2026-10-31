export const workspaceSteps = [
  { id: "upload", label: "Upload", description: "Select CSV files and inspect their original values." },
  { id: "configure", label: "Configure", description: "Map columns, review rules and define relationships." },
  { id: "validate", label: "Validate", description: "Run the existing browser-local preflight checks." },
  { id: "review", label: "Review", description: "Inspect readiness, findings, analytics and dependencies." },
  { id: "correct", label: "Correct", description: "Optionally edit source records and revalidate approved changes." },
  { id: "export", label: "Export", description: "Download files or save summary metadata to a project." },
] as const;
export type WorkspaceStep = (typeof workspaceSteps)[number]["id"];
export type WorkflowFacts = { hasDatasets: boolean; hasReport: boolean; configurationReviewed: boolean; configurationError: boolean; reviewOpened: boolean; correctionActivity: boolean; exported: boolean };
export type StepState = (typeof workspaceSteps)[number] & { available: boolean; complete: boolean; status: string; reason: string };

/** Presentation only: does not validate, modify or persist workspace data. */
export function workspaceStepStates(facts: WorkflowFacts): StepState[] {
  return workspaceSteps.map(step => {
    const available = step.id === "upload" || (step.id === "review" ? facts.hasReport : facts.hasDatasets);
    const complete = ({ upload: facts.hasDatasets, configure: facts.configurationReviewed && !facts.configurationError, validate: facts.hasReport, review: facts.hasReport && facts.reviewOpened, correct: facts.correctionActivity, export: facts.exported } as const)[step.id];
    const reason = available ? "" : step.id === "review" && facts.hasDatasets ? "Run validation first." : "Select CSV files first.";
    const status = !available ? "Unavailable" : step.id === "configure" && facts.configurationError ? "Needs attention" : complete ? "Completed" : step.id === "correct" ? "Optional" : "Available";
    return { ...step, available, complete, status, reason };
  });
}
export function previousWorkspaceStep(current: WorkspaceStep, hasReport: boolean, exportOrigin: WorkspaceStep = "review"): WorkspaceStep | null {
  if(current === "upload") return null;
  if(current === "export") return exportOrigin === "review" && !hasReport ? "validate" : exportOrigin;
  if(current === "correct") return hasReport ? "review" : "validate";
  return workspaceSteps[workspaceSteps.findIndex(step => step.id === current) - 1].id;
}
export function nextWorkspaceStep(current: WorkspaceStep): WorkspaceStep | null {
  return ({ upload: "configure", configure: "validate", validate: "review", review: "export", correct: "export", export: null } as const)[current];
}
