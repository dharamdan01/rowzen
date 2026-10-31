import { Card, Skeleton } from "./primitives";

export default function PageLoading({ label = "Loading workspace...", compact = false }: { label?: string; compact?: boolean }) {
  return <section role="status" aria-busy="true" className="min-w-0 space-y-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div aria-hidden="true" className="space-y-5">
      <Skeleton className="h-7 w-44 max-w-full" />
      <Card className="space-y-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className={`${compact ? "h-11" : "h-24"} rounded-lg`} />
        <Skeleton className="h-4 w-1/2" />
      </Card>
    </div>
  </section>;
}
