import { useCallback } from "react";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import type { CursorPagination, PaginatedResult } from "../lib/pagination";

type Options<T> = {
  queryKey: QueryKey;
  queryFn: (cursor: string | undefined) => Promise<PaginatedResult<T>>;
  staleTime?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean | "always";
};

export function useInfiniteListQuery<T>(opts: Options<T>) {
  const query = useInfiniteQuery({
    queryKey: opts.queryKey,
    queryFn: ({ pageParam }) => opts.queryFn(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PaginatedResult<T>) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined,
    staleTime: opts.staleTime,
    enabled: opts.enabled,
    refetchInterval: opts.refetchInterval,
    refetchOnWindowFocus: opts.refetchOnWindowFocus,
    refetchOnMount: opts.refetchOnMount,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const lastPagination: CursorPagination | undefined = query.data?.pages.at(-1)?.pagination;

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  return {
    ...query,
    items,
    lastPagination,
    loadMore,
  };
}
