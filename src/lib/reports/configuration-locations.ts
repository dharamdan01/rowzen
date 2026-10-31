import type { RehearsalIssue } from "../rehearsal/types";
import type { Relationship } from "../rehearsal/rules";
import type { CompositeForeignKey } from "../rehearsal/foreign-keys";

export const configurationFieldId = (dataset: string, field: string) => `config-${encodeURIComponent(dataset)}-${field}`;
export const relationshipFieldId = (composite: boolean, index: number, field: string) => `config-${composite ? "composite" : "relationship"}-${index}-${field}`;
const decode = (value: unknown): unknown[] => { try { const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
type Context = { datasets: readonly string[]; primaryOverrides: Record<string,string>; relationships: readonly Relationship[]; compositeRelationships: readonly CompositeForeignKey[] };

/** Presentation-only locations from structured rule identity; never parse error prose. */
export function configurationIssueLocation(issue: RehearsalIssue, context: Context): { id: string; label: string } | null {
  if (issue.category !== "SCHEMA") return null;
  const rule = decode(issue.ruleId);
  const field = (name: string, label: string) => ({ id: configurationFieldId(issue.dataset,name), label: `${issue.dataset}: ${label}` });
  if (rule[0] === "column-rule" && rule[1] === issue.dataset) {
    if (rule[2] === "required") return field("required","required columns");
    if (rule[2] === "primary-key") return field("primary","primary key");
  }
  if (rule[0] === "key-schema") {
    const key = decode(rule[2]);
    if (key[0] === "key" && key[1] === issue.dataset) {
      if (key[2] === "unique") return field("unique","unique keys");
      if (key[2] === "primary") return field(context.primaryOverrides[issue.dataset]?.trim() ? "composite-primary" : "primary","primary key");
    }
  }
  const fk = decode(rule[0]);
  if (fk[0] === "fk-v1") {
    const declarations = [...context.relationships.map((value,index)=>({value,index,composite:false})),...context.compositeRelationships.map((value,index)=>({value,index,composite:true}))];
    const match = declarations.find(({value}) => {
      const child = "childColumns" in value ? value.childColumns : [value.childColumn];
      const parent = "parentColumns" in value ? value.parentColumns : [value.parentColumn];
      return value.childDataset.trim() === fk[1] && value.parentDataset.trim() === fk[3] && JSON.stringify(child.map(name=>name.trim())) === JSON.stringify(fk[2]) && JSON.stringify(parent.map(name=>name.trim())) === JSON.stringify(fk[4]);
    });
    if (match) {
      const reason = typeof rule[1] === "string" ? rule[1] : "";
      const part = reason === "missing-parent" ? "parent-dataset" : reason === "missing-child" ? "child-dataset" : reason.startsWith("missing-parent-column") || reason === "nonunique-target" ? "parent-column" : "child-column";
      return { id: relationshipFieldId(match.composite,match.index,part), label: `${match.composite ? "Composite relationship" : "Relationship"} ${match.index+1}: ${part.replaceAll("-"," ")}` };
    }
  }
  return context.datasets.includes(issue.dataset) ? {id:`dataset-${encodeURIComponent(issue.dataset)}`,label:`${issue.dataset}: configuration`} : {id:"rehearsal-relationships",label:"Relationships"};
}
