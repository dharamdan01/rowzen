// Pure URL query parsing: safe defaults, bounded page sizes and stable navigation.
export const HISTORY_STATUSES = [
  "ALL", "READY", "READY_WITH_WARNINGS", "BLOCKED", "CONFIG_ERROR",
] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];
export type HistoryOrder = "newest" | "oldest";
export type HistoryPageSize = 10 | 25 | 50;

export type HistoryRawParams = Record<string, string | string[] | undefined>;

export interface HistoryFilters {
  search: string;
  projectId?: string;
  status: HistoryStatus;
  order: HistoryOrder;
  page: number;
  pageSize: HistoryPageSize;
}

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function positivePage(value: string): number {
  if (!/^[1-9]\d{0,5}$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function parseHistoryFilters(raw: HistoryRawParams): HistoryFilters {
  const statusInput = single(raw.status);
  const orderInput = single(raw.order);
  const sizeInput = single(raw.pageSize);
  const projectId = single(raw.projectId).trim().slice(0, 200);
  return {
    search: single(raw.q).trim().slice(0, 80),
    ...(projectId ? { projectId } : {}),
    status: HISTORY_STATUSES.includes(statusInput as HistoryStatus)
      ? (statusInput as HistoryStatus) : "ALL",
    order: orderInput === "oldest" ? "oldest" : "newest",
    page: positivePage(single(raw.page)),
    pageSize: sizeInput === "25" ? 25 : sizeInput === "50" ? 50 : 10,
  };
}

export function historyPageHref(filters: HistoryFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.search) query.set("q", filters.search);
  if (filters.projectId) query.set("projectId", filters.projectId);
  if (filters.status !== "ALL") query.set("status", filters.status);
  if (filters.order !== "newest") query.set("order", filters.order);
  if (filters.pageSize !== 10) query.set("pageSize", String(filters.pageSize));
  if (Number.isSafeInteger(page) && page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/results?${value}` : "/results";
}

// In Prisma's LIKE-backed contains searches, escape SQL wildcard characters
// so searching a literal '_' or '%' does not unexpectedly match everything.
export function escapeHistorySearch(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** Carry normalized list state, not an arbitrary redirect destination. */
export function historyDetailHref(reportId: string, filters: HistoryFilters, page: number): string {
  const returnTo = historyPageHref(filters, page);
  const detail = `/results/${encodeURIComponent(reportId)}`;
  return returnTo === "/results" ? detail : `${detail}?${new URLSearchParams({ returnTo })}`;
}

export function historyReturnHref(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/results")) return "/results";
  try {
    const url = new URL(value, "https://history.invalid");
    if (url.origin !== "https://history.invalid" || url.pathname !== "/results") return "/results";
    const filters = parseHistoryFilters(Object.fromEntries([...url.searchParams.keys()].map(key => [key, url.searchParams.getAll(key)])));
    return historyPageHref(filters, filters.page);
  } catch { return "/results"; }
}
