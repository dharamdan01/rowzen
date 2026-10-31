
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "healthy",
      database: "connected",
    });
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503 }
    );
  }
}
