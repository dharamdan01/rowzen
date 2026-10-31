import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../../src/lib/csv/parser";
import { identityMapping } from "../../src/lib/rehearsal/mapping";
import { captureTemplateConfiguration } from "../../src/lib/templates/workspace";
import { buildWorkspaceKeyRules } from "../../src/lib/rehearsal/workspace-config";
import type { DatasetRules } from "../../src/lib/rehearsal/rules";
import type { WhatIfConfiguration } from "../../src/lib/corrections/what-if";

export const csvPack = resolve("samples/csv_fixtures");
export function packFile(path: string, name = path.split("/").at(-1)!) {
  return { name, mimeType: "text/csv", buffer: readFileSync(resolve(csvPack, path)) };
}
export function packDataset(path: string, name?: string) {
  const file = packFile(path, name);
  return parseCsvText(file.buffer.toString("utf8"), file.name);
}
export function configuredPack(blocked = false) {
  const datasets = blocked
    ? [packDataset("02_blocked/students_issues.csv"), packDataset("02_blocked/departments_parent.csv")]
    : ["students", "departments", "courses", "enrollments"].map(name => packDataset(`01_clean/${name}_clean.csv`));
  const [students, departments, courses, enrollments] = datasets;
  const mappings = Object.fromEntries(datasets.map(dataset => [dataset.name, identityMapping(dataset.headers)]));
  const rules: Record<string, DatasetRules> = Object.fromEntries(datasets.map(dataset => [dataset.name, { primaryKey: "", required: [], types: {} }]));
  rules[students.name] = {primaryKey: "student_id", required: ["full_name"], types: {email: "email", is_active: "boolean", enrolled_on: "date", tuition_fee: "number", postal_code: "string"}};
  rules[departments.name].primaryKey = "department_id";
  const relationships = [{childDataset: students.name, childColumn: "department_id", parentDataset: departments.name, parentColumn: "department_id"}];
  const primaryOverrides: Record<string, string> = {};
  if (!blocked) {
    rules[courses.name].primaryKey = "course_id";
    primaryOverrides[enrollments.name] = "student_id, course_id, semester";
    relationships.push({childDataset: enrollments.name, childColumn: "student_id", parentDataset: students.name, parentColumn: "student_id"}, {childDataset: enrollments.name, childColumn: "course_id", parentDataset: courses.name, parentColumn: "course_id"});
  }
  const template = captureTemplateConfiguration({datasets, mappings, rules, relationships, primaryOverrides, uniqueSpecs: {}, compositeRelationships: []});
  const config: WhatIfConfiguration = {mappings, rules, relationships, keyRules: buildWorkspaceKeyRules(rules, primaryOverrides, {})};
  return { datasets, template, config };
}
// Each version represents the same logical dataset. Only the browser File name
// is normalized; the supplied bytes and on-disk pack files remain unchanged.
export function driftPack(version: "v1" | "v2" | "v3" | "v4", normalizeName = true) {
  const files = {v1: "students_template_v1.csv", v2: "students_v2_renamed_added.csv", v3: "students_v3_removed_column.csv", v4: "students_v4_reordered.csv"};
  const path = `03_template_drift/${files[version]}`;
  const file = packFile(path, normalizeName ? "students.csv" : undefined);
  const dataset = packDataset(path, file.name);
  const template = captureTemplateConfiguration({datasets: [dataset], mappings: {[dataset.name]: identityMapping(dataset.headers)}, rules: {[dataset.name]: {primaryKey: "", required: [], types: {}}}, relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {}});
  return {file, dataset, template};
}
