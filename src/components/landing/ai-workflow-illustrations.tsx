import { Check, GitBranch, Search, ShieldCheck, Sparkles } from "lucide-react";

/** Original workflow diagrams, not screenshots or live model output. */
function FlowConnector({ vertical = false }: { vertical?: boolean }) {
  const path = vertical ? "M16 0V28m-4-4 4 4 4-4" : "M0 16H48m-4-4 4 4-4 4";
  return <svg aria-hidden="true" focusable="false" className={`rz-ai-connector${vertical ? " rz-ai-connector-vertical" : ""}`} viewBox={vertical ? "0 0 32 32" : "0 0 52 32"} fill="none">
    <path d={path} stroke="var(--control-border)" strokeWidth="1.5" />
    <path className="rz-ai-flow" d={path} pathLength="1" stroke="var(--primary)" strokeWidth="1.5" />
  </svg>;
}

export function MappingIllustration() {
  return <figure className="rz-ai-illustration" aria-labelledby="ai-mapping-caption">
    <div className="rz-ai-demo-heading"><span>From columns to a clear schema</span><span className="rz-ai-micro-label">01 / MAP</span></div>
    <div className="rz-ai-mapping-grid">
      <div className="rz-ai-node"><span className="rz-ai-label">CSV column</span><code>email_address</code><span className="rz-ai-note">Source header</span></div>
      <FlowConnector />
      <div className="rz-ai-node rz-ai-node-accent"><span className="rz-ai-label"><Sparkles aria-hidden="true" />AI suggestion</span><code>email</code><span className="rz-ai-note">Compatible type: email</span></div>
    </div>
    <div className="rz-ai-drift"><GitBranch aria-hidden="true" /><div><strong>Template drift</strong><p><span className="rz-ai-added">+</span> signup_date <span className="rz-ai-note">added since approved template</span></p></div><span className="rz-ai-tag">Local check</span></div>
    <div className="rz-ai-approval"><Check aria-hidden="true" /><span>Review the mapping. Approve selected changes.</span></div>
    <figcaption id="ai-mapping-caption">Workflow illustration · synthetic schema</figcaption>
  </figure>;
}

export function RootCauseIllustration() {
  return <figure className="rz-ai-illustration" aria-labelledby="ai-analysis-caption">
    <div className="rz-ai-demo-heading"><span>Follow the evidence</span><span className="rz-ai-micro-label">02 / UNDERSTAND</span></div>
    <div className="rz-ai-evidence"><span className="rz-ai-label"><ShieldCheck aria-hidden="true" />Verified validation finding</span><div className="rz-ai-finding"><code>FK_NOT_FOUND</code><span>students · department_id</span></div></div>
    <FlowConnector vertical />
    <div className="rz-ai-hypothesis"><span className="rz-ai-label"><Sparkles aria-hidden="true" />AI hypothesis · needs review</span><p>Parent keys or the mapping may need a closer look.</p><span className="rz-ai-note">Based on the cited foreign-key finding.</span></div>
    <div className="rz-ai-investigate"><Search aria-hidden="true" /><p>Check the parent CSV and both sides of the relationship.</p></div>
    <div className="rz-ai-impact"><span>Potential downstream impact</span><p>students <span aria-hidden="true">→</span> enrolments</p><small>Configured relationship example. Affected records are unknown.</small></div>
    <figcaption id="ai-analysis-caption">Workflow illustration · synthetic findings</figcaption>
  </figure>;
}

export function RepairIllustration() {
  return <figure className="rz-ai-illustration" aria-labelledby="ai-repair-caption">
    <div className="rz-ai-demo-heading"><span>A suggestion earns your approval</span><span className="rz-ai-micro-label">03 / VERIFY</span></div>
    <p className="rz-ai-convention">Example: you confirmed a yes / no boolean convention.</p>
    <ol className="rz-ai-repair-steps" aria-label="Illustrated repair approval sequence">
      <li><span className="rz-ai-step-label"><span>1</span>Before</span><code>yes</code><p>Not a valid boolean under the configured rule.</p></li>
      <li className="rz-ai-node-accent"><span className="rz-ai-step-label"><span>2</span>Suggested repair</span><code>yes <span aria-hidden="true">→</span> true</code><p>AI selects a supported normalization strategy.</p></li>
      <li><span className="rz-ai-step-label"><span>3</span>Verified preview</span><div className="rz-ai-preview-result"><ShieldCheck aria-hidden="true" /><strong>Boolean check passes</strong></div><p>Deterministic What-if, before any cell changes.</p></li>
      <li><span className="rz-ai-step-label"><span>4</span>User approval</span><strong className="rz-ai-awaiting">Your decision</strong><p>Apply the verified change, or keep the original.</p></li>
    </ol>
    <div className="rz-ai-approval"><Check aria-hidden="true" /><span>One cell at a time. Undo remains available.</span></div>
    <figcaption id="ai-repair-caption">Workflow illustration · synthetic values</figcaption>
  </figure>;
}
