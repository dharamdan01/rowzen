/**
 * Phase 6 deterministic, in-memory dependency analysis.
 * Each edge is parent -> child, representing a parent-first import requirement.
 * This is a static ordering advisory, not a PostgreSQL execution guarantee.
 * Does not inspect raw CSV row values or call a database.
 */
import type { ForeignKeyDeclaration } from "./foreign-keys";
import { createIssue, finalizeIssues } from "./issues";
import type { RehearsalIssue } from "./types";

export type DependencyEdge = {
  parentDataset: string;
  childDataset: string;
};

export type DependencyGraphResult = {
  /** Alphabetically sorted dataset identifiers. */
  nodes: string[];
  /** Unique, sorted parent -> child edges. */
  edges: DependencyEdge[];
  /** Deterministic, parent-first order. Partial if a cycle exists. */
  importOrder: string[];
  /** Only datasets that actually participate in a directed cycle. */
  cycleGroups: string[][];
  /** Datasets outside cycles whose ordering depends on a cyclic dataset. */
  blockedByCycles: string[];
  /** Datasets without a justified complete position (includes cycle members). */
  unresolvedDatasets: string[];
  /** Structured configuration and cycle issues. */
  issues: RehearsalIssue[];
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeRelation(relation: ForeignKeyDeclaration) {
  const childDataset = relation.childDataset.trim();
  const parentDataset = relation.parentDataset.trim();
  const childColumns = "childColumns" in relation
    ? [...relation.childColumns].map((c) => c.trim())
    : [relation.childColumn.trim()];
  const parentColumns = "parentColumns" in relation
    ? [...relation.parentColumns].map((c) => c.trim())
    : [relation.parentColumn.trim()];

  return { childDataset, parentDataset, childColumns, parentColumns };
}

function configIssue(
  dataset: string,
  ruleId: string,
  explanation: string,
  suggestedInvestigation: string,
  code: "BAD_SCHEMA" | "MISSING_REFERENCE_DATASET" = "BAD_SCHEMA",
): RehearsalIssue {
  return createIssue({
    code,
    severity: "ERROR",
    category: "SCHEMA",
    dataset: dataset || "(unnamed dataset)",
    rowNumber: null,
    column: null,
    ruleId,
    explanation,
    suggestedInvestigation,
  });
}

/**
 * Analyze a dependency graph from the configured datasets and FK declarations.
 * Input order and repeated identical edges never affect the resulting report.
 * Invalid declarations produce CONFIG issues and no claimed import plan.
 */
export function analyzeDependencyGraph(
  datasets: readonly string[],
  relationships: readonly ForeignKeyDeclaration[],
): DependencyGraphResult {
  const issues: RehearsalIssue[] = [];
  const seenIssueIds = new Set<string>();
  function addIssue(issue: RehearsalIssue): void {
    if (!seenIssueIds.has(issue.id)) {
      seenIssueIds.add(issue.id);
      issues.push(issue);
    }
  }

  const names = datasets.map((name) => name.trim());
  const nodes = [...new Set(names.filter(Boolean))].sort(compareText);
  const nodeSet = new Set(nodes);

  if (!datasets.length) {
    addIssue(configIssue(
      "(unnamed dataset)", "graph:no-datasets",
      "The dependency graph cannot be built without datasets.",
      "Upload at least one dataset before computing an import order.",
    ));
  }
  if (names.some((name) => !name)) {
    addIssue(configIssue(
      "(unnamed dataset)", "graph:empty-dataset-name",
      "A dataset has an empty name.",
      "Assign each dataset a nonempty name.",
    ));
  }
  const nameCounts = new Map<string, number>();
  for (const name of names.filter(Boolean)) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  for (const name of nodes) {
    if ((nameCounts.get(name) ?? 0) > 1) {
      addIssue(configIssue(
        name, JSON.stringify(["graph", "duplicate-dataset", name]),
        `Dataset '${name}' is declared more than once.`,
        "Rename or remove duplicated datasets before computing import order.",
      ));
    }
  }

  const edgeKeys = new Set<string>();
  const edges: DependencyEdge[] = [];
  const normalized = relationships.map(normalizeRelation).sort((a, b) =>
    compareText(JSON.stringify(a), JSON.stringify(b)));

  for (const relation of normalized) {
    const { childDataset, parentDataset, childColumns, parentColumns } = relation;
    const ruleId = JSON.stringify(["graph-fk-v1", childDataset, childColumns, parentDataset, parentColumns]);
    if (!childDataset || !parentDataset || !childColumns.length ||
      childColumns.length !== parentColumns.length ||
      [...childColumns, ...parentColumns].some((column) => !column) ||
      new Set(childColumns).size !== childColumns.length ||
      new Set(parentColumns).size !== parentColumns.length) {
      addIssue(configIssue(
        childDataset, `${ruleId}:invalid-declaration`,
        "A dependency contains empty dataset/column names, repeated columns, or mismatched key lengths.",
        "Correct the declared foreign-key column pairs before computing import order.",
      ));
      continue;
    }
    if (!nodeSet.has(childDataset)) {
      addIssue(configIssue(
        childDataset, `${ruleId}:missing-child`,
        `Child dataset '${childDataset}' is not supplied.`,
        "Upload the child dataset or remove the foreign-key relationship.",
        "MISSING_REFERENCE_DATASET",
      ));
    }
    if (!nodeSet.has(parentDataset)) {
      addIssue(configIssue(
        childDataset, `${ruleId}:missing-parent`,
        `Referenced parent dataset '${parentDataset}' is not supplied.`,
        "Upload the parent dataset or correct the relationship.",
        "MISSING_REFERENCE_DATASET",
      ));
    }
    if (!nodeSet.has(childDataset) || !nodeSet.has(parentDataset)) continue;

    const edgeId = JSON.stringify([parentDataset, childDataset]);
    if (!edgeKeys.has(edgeId)) {
      edgeKeys.add(edgeId);
      edges.push({ parentDataset, childDataset });
    }
  }
  edges.sort((a, b) =>
    compareText(a.parentDataset, b.parentDataset) ||
    compareText(a.childDataset, b.childDataset));

  // A graph with invalid configuration must not claim a safe import ordering.
  if (issues.length) {
    return {
      nodes, edges, importOrder: [], cycleGroups: [],
      blockedByCycles: [], unresolvedDatasets: nodes,
      issues: finalizeIssues(issues),
    };
  }

  const children = new Map(nodes.map((name) => [name, new Set<string>()]));
  const indegree = new Map(nodes.map((name) => [name, 0]));
  for (const { parentDataset, childDataset } of edges) {
    children.get(parentDataset)!.add(childDataset);
    indegree.set(childDataset, indegree.get(childDataset)! + 1);
  }
  const orderedChildren = new Map([...children].map(([name, list]) =>
    [name, [...list].sort(compareText)] as const));

  // Kahn's algorithm, lexicographically sorted queue for stable tie-breaking.
  const ready = nodes.filter((name) => indegree.get(name) === 0);
  const importOrder: string[] = [];
  while (ready.length) {
    const parent = ready.shift()!;
    importOrder.push(parent);
    for (const child of orderedChildren.get(parent)!) {
      const remaining = indegree.get(child)! - 1;
      indegree.set(child, remaining);
      if (remaining === 0) {
        ready.push(child);
        ready.sort(compareText);
      }
    }
  }

  // Tarjan strongly-connected components; a cycle is an SCC with >1 node,
  // or a single node with an explicit self-reference.
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycleGroups: string[][] = [];
  let nextIndex = 0;

  function visit(current: string): void {
    index.set(current, nextIndex);
    lowlink.set(current, nextIndex);
    nextIndex++;
    stack.push(current);
    onStack.add(current);

    for (const child of orderedChildren.get(current)!) {
      if (!index.has(child)) {
        visit(child);
        lowlink.set(current, Math.min(lowlink.get(current)!, lowlink.get(child)!));
      } else if (onStack.has(child)) {
        lowlink.set(current, Math.min(lowlink.get(current)!, index.get(child)!));
      }
    }

    if (lowlink.get(current) !== index.get(current)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== current);
    component.sort(compareText);
    if (component.length > 1 || children.get(component[0])!.has(component[0])) {
      cycleGroups.push(component);
    }
  }

  for (const name of nodes) {
    if (!index.has(name)) visit(name);
  }
  cycleGroups.sort((a, b) => compareText(a[0], b[0]));

  const cycleMembers = new Set(cycleGroups.flat());
  const impacted = new Set(cycleMembers);
  const queue = [...cycleMembers].sort(compareText);
  for (let i = 0; i < queue.length; i++) {
    for (const child of orderedChildren.get(queue[i])!) {
      if (!impacted.has(child)) {
        impacted.add(child);
        queue.push(child);
      }
    }
  }
  const blockedByCycles = [...impacted].filter((n) => !cycleMembers.has(n)).sort(compareText);
  const unresolvedDatasets = [...impacted].sort(compareText);

  for (const group of cycleGroups) {
    addIssue(createIssue({
      code: "DEPENDENCY_CYCLE",
      severity: "ERROR",
      category: "DEPENDENCY",
      dataset: group[0],
      rowNumber: null,
      column: null,
      ruleId: JSON.stringify(["dependency-cycle-v1", group]),
      explanation: `Datasets ${group.map((name) => `'${name}'`).join(", ")} form a circular dependency; no parent-first ordering exists for these datasets.`,
      suggestedInvestigation: "Review the FK relationships. A staged load or target-specific constraint deferral may require separate database review; it is not validated by this static preflight.",
    }));
  }

  return {
    nodes, edges, importOrder, cycleGroups,
    blockedByCycles, unresolvedDatasets,
    issues: finalizeIssues(issues),
  };
}
