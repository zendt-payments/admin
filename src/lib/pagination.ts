export type CursorPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: CursorPagination;
};

export const DEFAULT_LIST_PAGE_SIZE = 20;
