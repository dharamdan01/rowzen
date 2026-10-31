/**
 * Static schema checks for existing Phase 5 configuration.
 * No raw CSV values or database operations.
 */
import type { ParsedCsv } from '../csv/parser';
import type { DatasetRules, FieldType, Relationship } from './rules';
import { createIssue, finalizeIssues, type IssueDraft } from './issues';
import type { IssueCode, RehearsalIssue } from './types';

type SchemaDataset = Pick<ParsedCsv, 'name' | 'headers'>;

const SUPPORTED_TYPES: ReadonlySet<string> = new Set<FieldType>([
  'string',
  'integer',
  'number',
  'boolean',
  'date',
  'email',
]);

function issue(
  code: IssueCode,
  dataset: string,
  column: string | null,
  ruleId: string,
  explanation: string,
  suggestedInvestigation: string,
): RehearsalIssue {
  const draft: IssueDraft = {
    code,
    severity: 'ERROR',
    category: 'SCHEMA',
    dataset: dataset.trim() || '(unnamed dataset)',
    rowNumber: null,
    column,
    ruleId,
    explanation,
    suggestedInvestigation,
  };
  return createIssue(draft);
}

function relationKey(rel: Relationship): string {
  return JSON.stringify([
    'fk',
    rel.childDataset,
    rel.childColumn,
    rel.parentDataset,
    rel.parentColumn,
  ]);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function validateSchemaConfiguration(
  datasets: readonly SchemaDataset[],
  rules: Readonly<Record<string, DatasetRules>>,
  relationships: readonly Relationship[],
): RehearsalIssue[] {
  const result: RehearsalIssue[] = [];
  const byName = new Map<string, SchemaDataset>();
  const duplicateNames = new Set<string>();

  // Dataset names
  for (const ds of datasets) {
    if (!ds.name.trim()) {
      result.push(
        issue(
          'BAD_SCHEMA',
          '(unnamed dataset)',
          null,
          JSON.stringify(['dataset', 'missing-name']),
          'A dataset has an empty name.',
          'Use a nonempty, distinct CSV dataset name.',
        ),
      );
      continue;
    }
    if (byName.has(ds.name)) {
      duplicateNames.add(ds.name);
    } else {
      byName.set(ds.name, ds);
    }
  }

  for (const name of [...duplicateNames].sort(cmp)) {
    result.push(
      issue(
        'BAD_SCHEMA',
        name,
        null,
        JSON.stringify(['dataset', name, 'duplicate-name']),
        `Dataset ${name} is uploaded more than once.`,
        'Rename or remove the duplicate dataset.',
      ),
    );
  }

  // Rules and columns
  for (const [name, ds] of [...byName].sort(([a], [b]) => cmp(a, b))) {
    if (duplicateNames.has(name)) continue;
    const rule = rules[name];
    if (!rule) {
      result.push(
        issue(
          'BAD_SCHEMA',
          name,
          null,
          JSON.stringify(['dataset', name, 'missing-rules']),
          `No validation rules are configured for ${name}.`,
          'Configure dataset rules before validation.',
        ),
      );
      continue;
    }

    const headerSet = new Set(ds.headers);
    const columnGroups = [
      ['primary-key', rule.primaryKey ? [rule.primaryKey] : []],
      ['required', rule.required],
      ['typed', Object.keys(rule.types)],
    ] as const;

    for (const [role, columns] of columnGroups) {
      for (const column of [...new Set(columns)].sort(cmp)) {
        if (!headerSet.has(column)) {
          result.push(
            issue(
              'BAD_SCHEMA',
              name,
              column,
              JSON.stringify(['column-rule', name, role, column]),
              `Configured ${name} column ${column} does not exist in ${name}.`,
              'Correct the mapping or remove the invalid rule.',
            ),
          );
        }
      }
    }

    // Unsupported types
    for (const [column, fieldType] of Object.entries(rule.types).sort(
      ([a], [b]) => cmp(a, b),
    )) {
      if (!SUPPORTED_TYPES.has(fieldType)) {
        result.push(
          issue(
            'UNSUPPORTED_CONSTRAINT',
            name,
            column,
            JSON.stringify(['type', name, column]),
            `The configured type for ${name}.${column} is unsupported.`,
            'Choose a supported MVP field type.',
          ),
        );
      }
    }
  }

  // Foreign-key relationships
  const seenRelations = new Set<string>();
  const sortedRelations = [...relationships].sort((a, b) =>
    cmp(relationKey(a), relationKey(b)),
  );

  for (const rel of sortedRelations) {
    const key = relationKey(rel);
    if (seenRelations.has(key)) {
      const duplicateRuleId = JSON.stringify(['duplicate-fk', key]);
      if (!result.some((item) => item.ruleId === duplicateRuleId)) {
        result.push(
          issue(
            'BAD_SCHEMA',
            rel.childDataset,
            rel.childColumn,
            duplicateRuleId,
            'This foreign-key relationship is declared more than once.',
            'Keep only one relationship declaration.',
          ),
        );
      }
      continue;
    }
    seenRelations.add(key);

    if (
      duplicateNames.has(rel.childDataset) ||
      duplicateNames.has(rel.parentDataset)
    ) {
      continue;
    }

    const child = byName.get(rel.childDataset);
    const parent = byName.get(rel.parentDataset);

    if (!child) {
      result.push(
        issue(
          'MISSING_REFERENCE_DATASET',
          rel.childDataset,
          rel.childColumn,
          JSON.stringify(['missing-child', key]),
          `Relationship child dataset ${rel.childDataset} was not supplied.`,
          'Upload the child dataset or remove the relationship.',
        ),
      );
    }
    if (!parent) {
      result.push(
        issue(
          'MISSING_REFERENCE_DATASET',
          rel.childDataset,
          rel.childColumn,
          JSON.stringify(['missing-parent', key]),
          `Relationship parent dataset ${rel.parentDataset} was not supplied.`,
          'Upload the parent dataset or correct the relationship.',
        ),
      );
    }
    if (!child || !parent) continue;

    // Verify mapped columns exist
    const childColOK = child.headers.includes(rel.childColumn);
    const parentColOK = parent.headers.includes(rel.parentColumn);

    if (!childColOK) {
      result.push(
        issue(
          'BAD_SCHEMA',
          rel.childDataset,
          rel.childColumn,
          JSON.stringify(['missing-child-column', key]),
          `FK source column ${rel.childColumn} is missing from ${rel.childDataset}.`,
          'Check the child CSV column mapping.',
        ),
      );
    }
    if (!parentColOK) {
      result.push(
        issue(
          'BAD_SCHEMA',
          rel.parentDataset,
          rel.parentColumn,
          JSON.stringify(['missing-parent-column', key]),
          `FK target column ${rel.parentColumn} is missing from ${rel.parentDataset}.`,
          'Check the parent CSV column mapping.',
        ),
      );
    }
    if (!childColOK || !parentColOK) continue;

    const parentRule = rules[parent.name];
    const childRule = rules[child.name];
    if (!parentRule || !childRule) continue;

    // Phase 5 supports a single-column primary key.
    // Unique-key targets will be supported separately.
    if (parentRule.primaryKey !== rel.parentColumn) {
      result.push(
        issue(
          'FK_TARGET_NOT_UNIQUE',
          rel.childDataset,
          rel.childColumn,
          JSON.stringify(['fk-target-not-pk', key]),
          `The FK target ${rel.parentDataset}.${rel.parentColumn} is not configured as its primary key.`,
          'Reference the declared parent primary key.',
        ),
      );
    }

    // Compare only explicitly declared types.
    const childType = childRule.types[rel.childColumn];
    const parentType = parentRule.types[rel.parentColumn];

    if (
      childType &&
      parentType &&
      SUPPORTED_TYPES.has(childType) &&
      SUPPORTED_TYPES.has(parentType) &&
      childType !== parentType
    ) {
      result.push(
        issue(
          'INCOMPATIBLE_COLUMN_TYPE',
          rel.childDataset,
          rel.childColumn,
          JSON.stringify(['fk-type', key]),
          `Declared FK column types differ for ${rel.childDataset}.${rel.childColumn} and ${rel.parentDataset}.${rel.parentColumn}.`,
          'Configure matching declared types and review the intended database schema.',
        ),
      );
    }
  }

  return finalizeIssues(result);
}
