"use client";

import * as React from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { DateRange } from "@/lib/date-range";

/**
 * State a server-driven table needs: the search term, the active filter
 * values and the selected date range.
 */
export interface ServerTableState {
  query: string;
  filters: Record<string, string>;
  dateRange: DateRange;
}

export interface ServerTableOptions {
  /** API path, e.g. `/api/v1/merchant/transactions`. */
  path: string;
  pageSize?: number;
  /** Initial search term, e.g. from a `?q=` query parameter. */
  initialQuery?: string;
  /** Maps the table state to API query parameters. */
  buildQuery?: (
    state: ServerTableState,
  ) => Record<string, string | number | undefined>;
  /** Extra query parameters that do not change with the table state. */
  extraQuery?: Record<string, string | number | undefined>;
}

export interface ServerTableResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  query: string;
  filters: Record<string, string>;
  dateRange: DateRange;
  setQuery: (query: string) => void;
  setFilter: (id: string, value: string) => void;
  setDateRange: (range: DateRange) => void;
  setPage: (page: number) => void;
  refresh: () => void;
}

/**
 * Drives a table whose filtering and pagination happen on the server.
 *
 * The hook owns the query state, fetches the matching page and reports
 * loading and error conditions so the table can render a skeleton or an
 * error state instead of an empty list.
 */
export function useServerTable<T>({
  path,
  pageSize = 10,
  initialQuery = "",
  buildQuery,
  extraQuery,
}: ServerTableOptions): ServerTableResult<T> {
  const [query, setQueryState] = React.useState(initialQuery);
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [dateRange, setDateRangeState] = React.useState<DateRange>("all");
  const [page, setPage] = React.useState(1);

  const [rows, setRows] = React.useState<T[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  // The debounce keeps a fast typist from firing a request per keystroke.
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const state = React.useMemo<ServerTableState>(
    () => ({ query: debouncedQuery, filters, dateRange }),
    [debouncedQuery, filters, dateRange],
  );

  const queryKey = JSON.stringify({
    path,
    state,
    extraQuery,
    reloadToken,
  });

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = {
          ...extraQuery,
          ...(buildQuery ? buildQuery(state) : {}),
          page,
          pageSize,
        };

        const payload = await apiFetch<{
          [key: string]: unknown;
          pagination?: { total?: number; totalPages?: number };
        }>(path, { query: params, signal: controller.signal });

        if (cancelled) return;

        // The list endpoints all return their rows under a named key.
        const listKey = ["transactions", "accounts", "devices", "merchants", "users", "apiKeys", "logs", "data"].find(
          (key) => Array.isArray(payload[key]),
        );

        setRows(
          listKey ? ((payload[listKey] as T[]) ?? []) : ([] as T[]),
        );
        setTotal(payload.pagination?.total ?? 0);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setRows([]);
        setTotal(0);
        setError(
          caught instanceof ApiError
            ? caught.message
            : "We could not reach the server. Please try again.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `queryKey` captures every input that should trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page, pageSize]);

  const setQuery = React.useCallback((value: string) => {
    setQueryState(value);
    setPage(1);
  }, []);

  const setFilter = React.useCallback((id: string, value: string) => {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }, []);

  const setDateRange = React.useCallback((range: DateRange) => {
    setDateRangeState(range);
    setPage(1);
  }, []);

  const refresh = React.useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows,
    total,
    page,
    pageCount,
    pageSize,
    loading,
    error,
    query,
    filters,
    dateRange,
    setQuery,
    setFilter,
    setDateRange,
    setPage,
    refresh,
  };
}
