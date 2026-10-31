import { sameExportRevisions } from "./contracts";
import { freezeExport, type DatabaseExportPlan, type DatabaseExportManifest } from "./types";
import { MONGO_EXPORT_LIMITS, mongoOptionsSchema, mongoStorageFamily, MongoExportError, type MongoOptions } from "./mongodb-contracts";
import { assertMongoCollectionName, assertMongoFieldName } from "./mongodb-values";

export type MongoCollectionDefinition = {
  name: string;
  options: { collation: { locale: "simple" }; validator?: { $jsonSchema: { bsonType: "object"; additionalProperties: false; required?: string[]; properties: Record<string, unknown> } };
    validationLevel?: "strict"; validationAction?: "error" };
  indexes: { key: Record<string, 1>; name: string; unique: true; collation: { locale: "simple" } }[];
};
export interface MongoMetadataArtifact {
  readonly filename: "datarehearsal-mongodb-definitions.json";
  readonly content: string;
  readonly definitions: { collections: readonly MongoCollectionDefinition[] };
  readonly manifest: {
    readonly version: 1; readonly target: "MONGODB"; readonly renderer: "MONGODB_FLAT_EJSON_V1";
    readonly containsRecords: false; readonly databaseCompatibility: "NOT_VERIFIED"; readonly execution: "NOT_EXECUTED";
    readonly configuredPreflight: DatabaseExportManifest["configuredPreflight"];
    readonly schema: DatabaseExportManifest["schema"]; readonly options: MongoOptions;
    readonly unsupportedFeatures: readonly string[]; readonly assumptions: readonly string[];
    readonly foreignKeyEnforcement: "NONE"; readonly destructiveOperations: false;
  };
  readonly instructions: string;
}
const owned = new WeakMap<MongoMetadataArtifact, { plan: DatabaseExportPlan; options: MongoOptions }>();
export function getMongoMetadataScope(artifact: MongoMetadataArtifact, plan: DatabaseExportPlan) {
  const scope = owned.get(artifact);
  if (!scope || scope.plan !== plan) throw new MongoExportError("STALE");
  return scope;
}

/** Flat configured metadata only: no BSON client, rows, nesting, inference or execution. */
export function prepareMongoMetadata(plan: DatabaseExportPlan, input: unknown, assertCurrent: () => void): MongoMetadataArtifact {
  assertCurrent();
  const parsed = mongoOptionsSchema.safeParse(input);
  if (!parsed.success) throw new MongoExportError("INVALID_OPTIONS");
  const options = parsed.data;
  if (!sameExportRevisions(plan.revisions, options.revisions)) throw new MongoExportError("STALE");
  if (plan.status !== "PLANNED" || plan.manifest.target !== "MONGODB" || plan.manifest.mode !== "SCHEMA_ONLY") throw new MongoExportError("INVALID_OPTIONS");
  const tables = plan.manifest.schema.datasets;
  const collections = new Map(options.collections.map(item => [item.datasetId, item]));
  const columns = new Map(options.columns.map(item => [item.columnId, item]));
  const planned = new Map(plan.manifest.choices.map(item => [item.columnId, item]));
  if (collections.size !== options.collections.length || collections.size !== tables.length || options.columns.length !== columns.size || columns.size !== planned.size ||
      [...collections.keys()].some(id => !tables.some(table => table.id === id)) || [...columns.keys()].some(id => !planned.has(id)) ||
      new Set(options.collections.map(item => item.name.toLowerCase())).size !== options.collections.length) throw new MongoExportError("INVALID_OPTIONS");
  let ordinal = 0;
  const definitions: MongoCollectionDefinition[] = tables.map(table => {
    const collection = collections.get(table.id)!;
    assertMongoCollectionName(collection.name);
    const hasId = table.columns.some(column => column.target === "_id");
    if (collection.idPolicy !== (hasId ? "PRESERVE_CONFIGURED_ID" : "ALLOW_SERVER_GENERATED_ID")) throw new MongoExportError("INVALID_OPTIONS");
    const required: string[] = [], properties: [string, unknown][] = [];
    for (const column of table.columns) {
      if (!column.target) throw new MongoExportError("UNSUPPORTED_NAME");
      assertMongoFieldName(column.target);
      const choice = columns.get(column.id)!, approved = planned.get(column.id)!;
      if (mongoStorageFamily(choice.type) !== approved.storage || choice.emptyPolicy !== approved.emptyPolicy ||
          (column.target === "_id" && choice.emptyPolicy !== "REJECT_EMPTY")) throw new MongoExportError("UNSUPPORTED_TYPE");
      const bsonType = ({ STRING: "string", INT32: "int", INT64: "long", DECIMAL128: "decimal", BOOLEAN: "bool", DATE_UTC_MIDNIGHT: "date" } as const)[choice.type];
      properties.push([column.target, { bsonType: choice.emptyPolicy === "EMPTY_STRING_AS_NULL" ? [bsonType, "null"] : bsonType,
        ...(choice.type === "STRING" && choice.emptyPolicy === "REJECT_EMPTY" ? { minLength: 1 } : {}) }]);
      if (choice.emptyPolicy === "REJECT_EMPTY") required.push(column.target);
    }
    if (!hasId) properties.push(["_id", { bsonType: "objectId" }]);
    const definition: MongoCollectionDefinition = { name: collection.name, options: { collation: { locale: "simple" } }, indexes: [] };
    if (options.includeValidators) Object.assign(definition.options, { validator: { $jsonSchema: { bsonType: "object", additionalProperties: false,
      ...(required.length ? { required } : {}), properties: Object.fromEntries(properties) } }, validationLevel: "strict", validationAction: "error" });
    if (options.includeUniqueIndexes) for (const key of plan.manifest.schema.keys.filter(key => key.dataset === table.name && key.effective)) {
      if (key.columns.length > 32) throw new MongoExportError("UNSUPPORTED_TYPE");
      if (key.columns.length === 1 && key.columns[0].target === "_id") continue; // Native _id uniqueness already exists.
      definition.indexes.push({ key: Object.fromEntries(key.columns.map(column => [column.target!, 1 as const])), name: `dr_mongo_key_${ordinal++}`,
        unique: true, collation: { locale: "simple" } });
    }
    return definition;
  });
  const normalizedOptions = { ...options, collections: tables.map(table => collections.get(table.id)!),
    columns: tables.flatMap(table => table.columns.map(column => columns.get(column.id)!)) };
  const content = JSON.stringify({ collections: definitions }, null, 2) + "\n";
  if (new TextEncoder().encode(content).length > MONGO_EXPORT_LIMITS.totalBytes) throw new MongoExportError("OVERSIZED");
  const artifact: MongoMetadataArtifact = freezeExport({ filename: "datarehearsal-mongodb-definitions.json", content,
    definitions: { collections: definitions }, manifest: { version: 1, target: "MONGODB", renderer: "MONGODB_FLAT_EJSON_V1", containsRecords: false,
      databaseCompatibility: "NOT_VERIFIED", execution: "NOT_EXECUTED", configuredPreflight: plan.manifest.configuredPreflight,
      schema: plan.manifest.schema, options: normalizedOptions, foreignKeyEnforcement: "NONE", destructiveOperations: false,
      unsupportedFeatures: ["SQL foreign keys, cascades and cross-collection referential integrity are metadata only; MongoDB does not enforce them automatically.",
        "SQL primary/composite keys remain existing fields. Optional required validators and unique indexes are not a SQL PRIMARY KEY.",
        "Trimmed CSV equality, SQL NULL uniqueness and missing-field semantics are not equivalent to ordinary MongoDB unique indexes.",
        "Partial/sparse uniqueness, custom checks, triggers, defaults, nesting, arrays, ObjectId conversion and floating-point conversions are unsupported.",
        ...(options.includeValidators ? [] : ["Collection validators are not included; configured required/type rules are not enforced by this artifact."]),
        ...(options.includeUniqueIndexes ? [] : ["Declared key indexes are not included; only MongoDB's native _id uniqueness is automatic."])],
      assumptions: ["Documents remain flat. Every applied target column is retained unless an exact empty cell is explicitly omitted.",
        "Existing _id values are preserved. Without configured _id, the explicitly acknowledged server-generated ObjectId is a technical identity, not a source primary-key transformation.",
        "DATE_UTC_MIDNIGHT explicitly converts date-only text into a BSON instant at UTC midnight; STRING preserves date-only text.",
        "Unique indexes use simple binary collation, include every value and treat null/missing as the same index key. They do not skip empty strings.",
        "Local duplicate checks cover every declared key after conversion even when index generation is off. Partial/sparse nullable-key policies are not inferred.",
        "Definitions apply to new collections only. No existing data, privileges, sharding or server environment was verified.",
        "Metadata labels may be private. No record values, issue prose or correction history are included in this manifest."] },
    instructions: ["Review metadata, unsupported SQL constraints, explicit BSON/NULL/missing choices and _id policy before importing.",
      "Only use a new disposable database/collections first. The application never connects to or imports into a database.",
      "Definitions are JSON data, not a shell script. If desired, create NEW collections with their reviewed options, then create their reviewed indexes using mongosh.",
      "For each reviewed definition c: db.createCollection(c.name,c.options); if(c.indexes.length) db.runCommand({createIndexes:c.name,indexes:c.indexes});",
      "Supply reviewed connection settings yourself. For each record file, use the collection mapping in the manifest:",
      "mongoimport --uri <YOUR_REVIEWED_URI> --collection <COLLECTION_FROM_MANIFEST> --type json --file <JSONL_FILE_FROM_MANIFEST> --mode insert --stopOnError --maintainInsertionOrder",
      "The files use Extended JSON v2, one document per line. Do not use --legacy, --jsonArray, --drop, upsert/merge/delete or --bypassDocumentValidation.",
      "mongoimport is not an atomic multi-document or multi-collection restore. Errors can leave partial imports; stop and inspect the new disposable destination.",
      "Foreign keys and relationships are NOT enforced. Preserve application-level referential-integrity checks yourself; no nesting or $lookup behavior is generated.",
      "Record files contain sensitive data. Keep consented files local and review before sharing. Definitions/manifests contain schema metadata only.", ""].join("\n") });
  owned.set(artifact, Object.freeze({ plan, options: artifact.manifest.options }));
  assertCurrent(); return artifact;
}
