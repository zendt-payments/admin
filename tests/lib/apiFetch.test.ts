import { describe, expect, it, vi } from "vitest";
import { isNgrokApiUrl, mergeApiHeaders } from "../../src/lib/apiFetch";

describe("apiFetch", () => {
  it("detects ngrok API URLs", () => {
    expect(isNgrokApiUrl("https://playtime-sitting-detection.ngrok-free.dev")).toBe(true);
    expect(isNgrokApiUrl("https://abc.ngrok-free.app")).toBe(true);
    expect(isNgrokApiUrl("http://localhost:4000")).toBe(false);
  });

  it("adds ngrok skip header for ngrok URLs", () => {
    vi.stubEnv("VITE_API_URL", "https://playtime-sitting-detection.ngrok-free.dev");
    const headers = mergeApiHeaders({ Accept: "application/json" });
    expect(headers.get("ngrok-skip-browser-warning")).toBe("true");
    expect(headers.get("Accept")).toBe("application/json");
  });
});
