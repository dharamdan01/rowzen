import type { FieldType } from "../rehearsal/rules";
import type { DatabaseExportTarget, StorageFamily } from "./contracts";
import type { Capability, ConstraintKind } from "./types";
import { freezeExport } from "./types";

interface TargetCapabilities {
  readonly types: Readonly<Record<FieldType, Capability>>;
  readonly constraints: Readonly<Record<ConstraintKind, Capability>>;
  readonly unspecifiedType: "CHOICE_REQUIRED";
  readonly renderer: "NOT_IMPLEMENTED";
}
const relationalConstraints = {
  PRIMARY_KEY: "SUPPORTED", COMPOSITE_PRIMARY_KEY: "SUPPORTED", UNIQUE_KEY: "SUPPORTED",
  COMPOSITE_UNIQUE_KEY: "SUPPORTED", FOREIGN_KEY: "SUPPORTED", COMPOSITE_FOREIGN_KEY: "SUPPORTED",
  REQUIRED_NONBLANK: "METADATA_ONLY", EMAIL_FORMAT: "METADATA_ONLY",
  CUSTOM_CHECK: "UNSUPPORTED", DEFAULT_VALUE: "UNSUPPORTED", GENERATED_IDENTITY: "UNSUPPORTED",
  CASCADE_ACTION: "UNSUPPORTED", TRIGGER: "UNSUPPORTED",
} as const;
const relationalTypes = {
  string: "SUPPORTED", integer: "CHOICE_REQUIRED", number: "CHOICE_REQUIRED",
  boolean: "SUPPORTED", date: "SUPPORTED", email: "METADATA_ONLY",
} as const;

/** Logical capability catalog only. No physical types, DDL or commands are rendered. */
export const DATABASE_EXPORT_CAPABILITIES: Readonly<Record<DatabaseExportTarget, TargetCapabilities>> = freezeExport({
  POSTGRESQL: { types: relationalTypes, constraints: relationalConstraints, unspecifiedType: "CHOICE_REQUIRED", renderer: "NOT_IMPLEMENTED" },
  MYSQL: { types: relationalTypes, constraints: relationalConstraints, unspecifiedType: "CHOICE_REQUIRED", renderer: "NOT_IMPLEMENTED" },
  MONGODB: {
    types: { ...relationalTypes, date: "CHOICE_REQUIRED" },
    constraints: { ...relationalConstraints, PRIMARY_KEY: "METADATA_ONLY", COMPOSITE_PRIMARY_KEY: "METADATA_ONLY",
      FOREIGN_KEY: "METADATA_ONLY", COMPOSITE_FOREIGN_KEY: "METADATA_ONLY" },
    unspecifiedType: "CHOICE_REQUIRED", renderer: "NOT_IMPLEMENTED",
  },
  GRAPHQL_SDL: {
    types: { ...relationalTypes, integer: "CHOICE_REQUIRED", number: "CHOICE_REQUIRED", date: "UNSUPPORTED" },
    constraints: { ...relationalConstraints, PRIMARY_KEY: "METADATA_ONLY", COMPOSITE_PRIMARY_KEY: "METADATA_ONLY",
      UNIQUE_KEY: "METADATA_ONLY", COMPOSITE_UNIQUE_KEY: "METADATA_ONLY", FOREIGN_KEY: "METADATA_ONLY", COMPOSITE_FOREIGN_KEY: "METADATA_ONLY" },
    unspecifiedType: "CHOICE_REQUIRED", renderer: "NOT_IMPLEMENTED",
  },
});

function commonStorage(type: FieldType | null): readonly StorageFamily[] {
  if (type === null) return ["TEXT"];
  if (type === "integer") return ["TEXT", "INTEGER"];
  if (type === "number") return ["TEXT", "EXACT_DECIMAL", "FLOATING_POINT"];
  if (type === "boolean") return ["TEXT", "BOOLEAN"];
  if (type === "date") return ["TEXT", "DATE_ONLY"];
  return ["TEXT"];
}

// Keep target checks separate: future adapters can narrow these without changing schema description.
function postgresStorage(type: FieldType | null): readonly StorageFamily[] { return commonStorage(type); }
function mysqlStorage(type: FieldType | null): readonly StorageFamily[] { return commonStorage(type); }
function mongoStorage(type: FieldType | null): readonly StorageFamily[] {
  return commonStorage(type); // DATE_ONLY requires the Mongo adapter's explicit UTC-midnight choice.
}
function graphqlStorage(type: FieldType | null): readonly StorageFamily[] {
  return type === "date" ? ["TEXT"] : type === "number" ? ["TEXT", "FLOATING_POINT"] : commonStorage(type);
}
export function supportedStorageFamilies(target: DatabaseExportTarget, type: FieldType | null): readonly StorageFamily[] {
  switch (target) {
    case "POSTGRESQL": return postgresStorage(type);
    case "MYSQL": return mysqlStorage(type);
    case "MONGODB": return mongoStorage(type);
    case "GRAPHQL_SDL": return graphqlStorage(type);
  }
}
