import { redirect } from "next/navigation";
import HistoryResults from "../../../components/reports/history-results";
import { parseHistoryFilters, type HistoryRawParams } from "../../../lib/reports/history-filters";
import { getCurrentUser } from "../../../lib/security/authorization";
import { getPaginatedOwnedValidationHistory } from "../../../lib/services/paginated-results-history";

// Next.js 16: authentication and Prisma data must stay in request scope.
export const instant = false;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<HistoryRawParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const filters = parseHistoryFilters(await searchParams);
  const history = await getPaginatedOwnedValidationHistory(user.id, filters);

  return (
    <section aria-labelledby="results-title" className="space-y-8 sm:space-y-10">
      <header className="border-b border-border pb-6 sm:pb-8">
        <h1 id="results-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          Validation Results
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Search and review saved validation summaries across your projects.
        </p>
      </header>
      <HistoryResults filters={filters} history={history} />
    </section>
  );
}
