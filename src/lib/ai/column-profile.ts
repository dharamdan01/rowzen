import type { ParsedCsv } from "../csv/parser";
import { matchesConfiguredType } from "../rehearsal/fields";
import type { FieldType } from "../rehearsal/rules";
import { templateConfigurationSchema } from "../templates/schema";

const fieldTypes = templateConfigurationSchema.shape.rules.valueType.shape.types.valueType.options;
export type ColumnProfile = {
  rows: number; nonEmpty: number; empty: number; duplicateRows: number; repeatedValues: number;
  leadingZeros: number; unsafeIntegers: number;
  matches: Record<FieldType, number>; compatibleTypes: FieldType[]; inferredType: FieldType | null;
  formats: Record<"email" | "date", { like: boolean; valid: number; invalid: number }>;
};
export type ProfileDataset = Pick<ParsedCsv, "name" | "headers" | "rows">;
type SemanticHints = { labels?: readonly string[]; types?: readonly FieldType[] };

function namedFormat(labels: readonly string[], type: "email" | "date"): boolean {
  return labels.some(label => {
    const tokens = label.normalize("NFKC").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[^\p{L}\p{N}]+/u);
    if (type === "email") return tokens.some(token => ["email", "emails", "emailaddress"].includes(token)) || tokens.some((token, index) => token === "e" && tokens[index + 1] === "mail");
    return tokens.some(token => ["date", "dob", "birthday", "birthdate", "startdate", "enddate"].includes(token)) ||
      tokens.some((token, index) => ["created", "updated", "enrolled", "joined", "hired", "registered"].includes(token) && ["on", "at"].includes(tokens[index + 1]));
  });
}

/** Browser-local, complete-snapshot scan. No samples, hashes or cell values are returned. */
export function profileColumn(dataset: ProfileDataset, source: string, hints: SemanticHints = {}): ColumnProfile {
  const matches = Object.fromEntries(fieldTypes.map(type => [type, 0])) as Record<FieldType, number>;
  const counts = new Map<string, number>();
  let nonEmpty = 0, empty = 0, leadingZeros = 0, unsafeIntegers = 0, decimalValues = 0;
  let emailShapes = 0, dateShapes = 0;
  for (const row of dataset.rows) {
    // Match canonical fields/key checks: blanks and equality use trimmed, case-sensitive strings.
    const value = (row[source] ?? "").trim();
    if (!value) { empty++; continue; }
    nonEmpty++;
    counts.set(value, (counts.get(value) ?? 0) + 1);
    for (const type of fieldTypes) if (matchesConfiguredType(value, type)) matches[type]++;
    if (/^[^\s@]+@[^\s@]+$/.test(value)) emailShapes++;
    if (/^(?:\d{4}-\d{1,2}-\d{1,2}(?:[Tt ].*)?|\d{1,2}[/-]\d{1,2}[/-]\d{4})$/.test(value)) dateShapes++;
    if (/^[+-]?0\d/.test(value)) leadingZeros++;
    if (matchesConfiguredType(value, "integer") && !Number.isSafeInteger(Number(value))) unsafeIntegers++;
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) decimalValues++;
  }
  const repeated = [...counts.values()].filter(count => count > 1);
  const compatibleTypes = nonEmpty ? fieldTypes.filter(type => matches[type] === nonEmpty &&
    (!(["integer", "number"] as string[]).includes(type) || (!leadingZeros && !unsafeIntegers))) : [];
  let inferredType: FieldType | null = null;
  if (nonEmpty) {
    inferredType = (["boolean", "date", "email", "integer"] as FieldType[]).find(type => compatibleTypes.includes(type)) ??
      (compatibleTypes.includes("number") && decimalValues === nonEmpty ? "number" : "string");
  }
  const labels = [source, ...(hints.labels ?? [])];
  const emailLike = namedFormat(labels, "email") || Boolean(hints.types?.includes("email")) || matches.email > 0 || emailShapes > 0;
  const dateLike = namedFormat(labels, "date") || Boolean(hints.types?.includes("date")) || matches.date > 0 || dateShapes > 0;
  return { rows: dataset.rows.length, nonEmpty, empty, duplicateRows: repeated.reduce((sum, count) => sum + count, 0),
    repeatedValues: repeated.length, leadingZeros, unsafeIntegers, matches, compatibleTypes, inferredType,
    formats: { email: { like: emailLike, valid: matches.email, invalid: emailLike ? nonEmpty - matches.email : 0 },
      date: { like: dateLike, valid: matches.date, invalid: dateLike ? nonEmpty - matches.date : 0 } } };
}

export function profileDiagnostics(profile: ColumnProfile | null): { kind: "missing" | "email" | "date"; message: string; warning: boolean }[] {
  if (!profile) return [];
  const diagnostics: ReturnType<typeof profileDiagnostics> = [];
  if (profile.empty) diagnostics.push({ kind: "missing", warning: true,
    message: `Missing values: ${profile.empty} empty ${profile.empty === 1 ? "cell" : "cells"} out of ${profile.rows}; type checks exclude these cells and primary/unique-key suggestions are blocked.` });
  if (profile.formats.email.like) diagnostics.push({ kind: "email", warning: profile.formats.email.invalid > 0,
    message: profile.nonEmpty ? `Email-like column: ${profile.formats.email.valid} valid and ${profile.formats.email.invalid} invalid among ${profile.nonEmpty} populated values. Empty cells are counted separately.` : "Email-like column: no populated values to check; the type remains unknown." });
  if (profile.formats.date.like) diagnostics.push({ kind: "date", warning: profile.formats.date.invalid > 0,
    message: profile.nonEmpty ? `Date-like column: ${profile.formats.date.valid} valid YYYY-MM-DD calendar dates and ${profile.formats.date.invalid} invalid or unsupported values among ${profile.nonEmpty} populated values. Empty cells are counted separately.` : "Date-like column: no populated values to check; the type remains unknown." });
  return diagnostics;
}

export function profileEvidence(profile: ColumnProfile | null): string[] {
  if (!profile) return ["No local value profile is available. Type and key suggestions are unavailable."];
  const messages = [profile.nonEmpty ? `${profile.nonEmpty}/${profile.rows} populated cells; ${profile.inferredType === "string" ? "only string is inferred across these values" : `${profile.matches[profile.inferredType!]} match ${profile.inferredType} format`}.` : "No populated values; the type is unknown."];
  messages.push(...profileDiagnostics(profile).map(diagnostic => diagnostic.message));
  if (profile.duplicateRows) messages.push(`${profile.duplicateRows} rows share ${profile.repeatedValues} repeated ${profile.repeatedValues === 1 ? "value" : "values"}; primary/unique-key suggestions are blocked.`);
  if (profile.leadingZeros) messages.push(`${profile.leadingZeros} ${profile.leadingZeros === 1 ? "value has" : "values have"} leading zeros; numeric suggestions are blocked to preserve formatting.`);
  if (profile.unsafeIntegers) messages.push(`${profile.unsafeIntegers} integer ${profile.unsafeIntegers === 1 ? "value exceeds" : "values exceed"} safe numeric precision; numeric suggestions are blocked.`);
  return messages;
}
