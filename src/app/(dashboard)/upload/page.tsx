import { requireUser } from "../../../lib/security/authorization";
import UploadWorkspace from "../../../components/upload/upload-workspace";

export const instant = false;

export default async function UploadPage({ searchParams }: {
  searchParams: Promise<{ projectId?: string | string[] }>;
}) {
  await requireUser();
  const supplied = (await searchParams).projectId;
  const initialProjectId = typeof supplied === "string" ? supplied : "";
  return <UploadWorkspace initialProjectId={initialProjectId} />;
}
