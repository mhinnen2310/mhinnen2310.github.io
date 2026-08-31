import { describe, expect, it } from "vitest";
import { qrPdfPageCount } from "./qr-pdf";
import { createQrToken, matchesQrSearch, qrDisplayCode, qrUrl } from "./qr-tags";

describe("QR asset-tag primitives", () => {
  it("uses stable, human-readable unique serial display codes", () => {
    expect(qrDisplayCode(1)).toBe("DF-000001");
    expect(qrDisplayCode(2481)).toBe("DF-002481");
    expect(new Set([qrDisplayCode(500), qrDisplayCode(501)]).size).toBe(2);
  });
  it("creates opaque cryptographic URL tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createQrToken()));
    expect(tokens.size).toBe(100);
    expect([...tokens].every((token) => /^[A-Za-z0-9_-]{43}$/.test(token))).toBe(true);
    expect([...tokens].some((token) => token.includes("2481"))).toBe(false);
  });
  it("finds a display code with and without formatting without prefix ambiguity", () => {
    const tag = { displayCode: "DF-000974", serialNumber: 974 };
    expect(matchesQrSearch(tag, "DF-000974")).toBe(true);
    expect(matchesQrSearch(tag, "000974")).toBe(true);
    expect(matchesQrSearch(tag, "974")).toBe(true);
    expect(matchesQrSearch(tag, "975")).toBe(false);
  });
  it("paginates printable sheets deterministically", () => {
    expect(qrPdfPageCount(15, 15)).toBe(1);
    expect(qrPdfPageCount(16, 15)).toBe(2);
    expect(qrPdfPageCount(30, 15)).toBe(2);
    expect(qrPdfPageCount(100, 15)).toBe(7);
    expect(qrPdfPageCount(100, 10)).toBe(10);
  });
  it("builds sticker URLs from the permanent base supplied for the batch", () => {
    expect(qrUrl("opaque-token", "https://qr.example.nl/")).toBe("https://qr.example.nl/q/opaque-token");
  });
});
