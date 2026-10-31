/** Pure conversion from UI text controls to deterministic Phase 6 declarations. */
import type { DatasetRules } from "./rules";
import type { KeyConfiguration } from "./keys";

export function splitKeyColumns(text: string): string[] {
  return text.split(",").map((column) => column.trim());
}

export function buildWorkspaceKeyRules(
  rules: Readonly<Record<string, DatasetRules>>,
  primaryOverrides: Readonly<Record<string, string>>,
  uniqueSpecs: Readonly<Record<string, string>>,
): KeyConfiguration {
  const result: Record<string, { primaryKey?: string[]; uniqueKeys?: string[][] }> = {};
  for (const name of Object.keys(rules).sort()) {
    const override = primaryOverrides[name]?.trim();
    const unique = (uniqueSpecs[name] ?? "").split(/\r?\n/).filter((line) => line.trim());
    if (!override && unique.length === 0) continue;
    const primaryKey = override ? splitKeyColumns(override) :
      rules[name].primaryKey ? [rules[name].primaryKey] : undefined;
    result[name] = { primaryKey, uniqueKeys: unique.map(splitKeyColumns) };
  }
  return result;
}
