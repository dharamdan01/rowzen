
import { z } from "zod";

export const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });

export const notFound = () =>
  Response.json({ error: "Resource not found" }, { status: 404 });

export function databaseError(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(error.code)
      : "UNKNOWN";

  console.error("Database operation failed:", code);

  if (code === "P2002") {
    return Response.json(
      { error: "Duplicate value violates a unique constraint" },
      { status: 409 }
    );
  }

  if (code === "P2003") {
    return Response.json(
      { error: "Referenced record does not exist" },
      { status: 409 }
    );
  }

  if (code === "P2025") {
    return notFound();
  }

  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<
  | { data: z.output<S>; error: null }
  | { data: null; error: Response }
> {
  let body: string;

  try {
    body = await request.text();
  } catch {
    return {
      data: null,
      error: Response.json(
        { error: "Unable to read request body" },
        { status: 400 }
      ),
    };
  }

  if (Buffer.byteLength(body, "utf8") > 65536) {
    return {
      data: null,
      error: Response.json(
        { error: "Request body too large" },
        { status: 413 }
      ),
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    return {
      data: null,
      error: Response.json(
        { error: "Invalid JSON" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      data: null,
      error: Response.json(
        {
          error: "Invalid input",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}
