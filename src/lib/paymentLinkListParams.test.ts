import { describe, expect, it } from "vitest";
import { transactionSortFromUi } from "./paymentLinkListParams";

describe("transactionSortFromUi", () => {
  it("maps amount sorts and defaults to latest-by-time", () => {
    expect(transactionSortFromUi("high")).toBe("amount_desc");
    expect(transactionSortFromUi("low")).toBe("amount_asc");
    expect(transactionSortFromUi("none")).toBe("time");
  });
});
