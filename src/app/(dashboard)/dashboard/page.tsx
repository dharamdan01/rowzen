import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { Card } from "../../../components/ui/primitives";
import { requireUser } from "../../../lib/security/authorization";

export const instant = false;

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <section aria-labelledby="dashboard-title" className="space-y-8 sm:space-y-10">
      <header className="border-b border-border pb-6 sm:pb-8">
        <h1 id="dashboard-title" className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          Welcome to Data Rehearsal
        </h1>

        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Prepare, validate, and review CSV datasets before
          importing them into relational databases.
        </p>
      </header>

      <Card aria-labelledby="project-overview-title" className="shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <FolderOpen className="size-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="project-overview-title" className="text-xl font-semibold tracking-tight text-foreground">
              Project Overview
            </h2>

            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Organize datasets into projects, configure schemas,
              validate relationships, and review rehearsal reports.
            </p>

            <Link
              href="/projects"
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:border-primary-hover hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring motion-reduce:transition-none sm:w-auto"
            >
              View Projects
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
