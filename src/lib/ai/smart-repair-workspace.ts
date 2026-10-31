import { AiError, type AiVersion } from "./contracts";
import type { SmartRepairIntent } from "./smart-repair-contracts";
import type { SmartRepairWorkspaceSnapshot } from "./smart-repair";

/** Trusted browser owner supplies live versions; none of this object is provider input. */
export type SmartRepairWorkspaceSource = Omit<SmartRepairWorkspaceSnapshot, "version" | "workspaceRevision" | "intent"> & {
  getVersion: () => AiVersion;
  revision: object;
};

/** Commit-time UI bridge. Navigation, scope and intent changes revoke its old snapshot capabilities. */
export function createSmartRepairWorkspaceBridge() {
  let source: SmartRepairWorkspaceSource | null = null;
  let intent: SmartRepairIntent = { kind: "UNCONFIRMED" };
  let workspaceRevision = 0;
  return {
    update(next: SmartRepairWorkspaceSource | null, nextIntent: SmartRepairIntent) {
      source = next; intent = structuredClone(nextIntent); workspaceRevision++;
    },
    clear() { source = null; workspaceRevision++; },
    getSnapshot(): SmartRepairWorkspaceSnapshot {
      if (!source) throw new AiError("STALE");
      return { evidence: source.evidence, report: source.report, corrections: source.corrections,
        configuration: source.configuration, draftsPending: source.draftsPending,
        version: source.getVersion(), workspaceRevision, intent };
    },
  };
}
