import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
}).strict();

export const updateProjectSchema = projectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required"
);

export const datasetSchema = z.object({
  name: z.string().trim().min(1).max(255)
    .regex(/\.csv$/i, "Only CSV filenames are supported"),
  rowCount: z.number().int().min(0),
}).strict();

export const mappingSchema = z.object({
  mappings: z.array(z.object({
    datasetId: z.string().min(1),
    columns: z.array(z.object({
      source: z.string().trim().min(1).max(128),
      target: z.string().trim().min(1).max(128),
    }).strict()).max(256),
  }).strict()).max(25),
}).strict();

export const relationshipSchema = z.object({
  relationships: z.array(z.object({
    parentDatasetId: z.string().min(1),
    childDatasetId: z.string().min(1),
    parentColumn: z.string().trim().min(1).max(128),
    childColumn: z.string().trim().min(1).max(128),
  }).strict()).max(100),
}).strict();

const count = z.number().int().nonnegative().refine(Number.isSafeInteger, "Count must be a safe integer");

const evaluatedValidationRun = z.object({
  status: z.enum(["READY", "READY_WITH_WARNINGS", "BLOCKED"]),
  totalRows: count,
  validRows: count,
  invalidRows: count,
  issueCount: count,
}).strict().superRefine((data, ctx) => {
  if (data.totalRows !== data.validRows + data.invalidRows) {
    ctx.addIssue({
      code: "custom",
      path: ["totalRows"],
      message: "Total rows must equal valid rows plus invalid rows",
    });
  }
  if (data.status === "READY" && data.issueCount !== 0) {
    ctx.addIssue({
      code: "custom",
      path: ["issueCount"],
      message: "READY runs cannot have reported issues",
    });
  }
  if (data.status === "READY_WITH_WARNINGS" && data.issueCount < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["issueCount"],
      message: "READY_WITH_WARNINGS requires at least one reported warning",
    });
  }
  if (data.status === "BLOCKED" && data.issueCount < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["issueCount"],
      message: "BLOCKED requires at least one reported issue",
    });
  }
});

const configurationErrorRun = z.object({
  status: z.literal("CONFIG_ERROR"),
  totalRows: count,
  // The engine deliberately does not evaluate row validity on schema errors.
  validRows: z.null(),
  invalidRows: z.null(),
  issueCount: count.min(1),
}).strict();

/** Browser-submitted summary metadata only. The API must authenticate ownership. */
export const validationRunSchema = z.union([
  evaluatedValidationRun,
  configurationErrorRun,
]);

export type ValidationRunPayload = z.infer<typeof validationRunSchema>;
