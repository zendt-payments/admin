import { describe, expect, it } from "vitest";
import { base64UrlToBuffer, bufferToBase64Url } from "./webAuthnBuffer";

describe("webAuthnBuffer", () => {
  it("round-trips credential ids", () => {
    const input = new Uint8Array([1, 2, 3, 255, 0, 128]).buffer;
    const encoded = bufferToBase64Url(input);
    const decoded = new Uint8Array(base64UrlToBuffer(encoded));
    expect(decoded).toEqual(new Uint8Array([1, 2, 3, 255, 0, 128]));
  });
});
