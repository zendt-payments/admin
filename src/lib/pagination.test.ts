import { describe, it, expect } from "vitest";

describe("cursor pagination helpers", () => {
  it("getNextPageParam returns cursor when hasMore", () => {
    const lastPage = {
      items: [{ id: 1 }],
      pagination: { limit: 20, hasMore: true, nextCursor: "2026-05-23T00:00:00.000Z|abc" },
    };
    const next = lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined;
    expect(next).toBe("2026-05-23T00:00:00.000Z|abc");
  });

  it("getNextPageParam is undefined when no more pages", () => {
    const lastPage = {
      items: [],
      pagination: { limit: 20, hasMore: false, nextCursor: null },
    };
    const next = lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined;
    expect(next).toBeUndefined();
  });
});
