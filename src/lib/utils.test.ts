import { describe, expect, it } from "vitest";
import { hashIp, numericValue } from "./utils";

describe("privacy-safe IP fingerprinting", () => {
  it("uses a deterministic keyed HMAC rather than reversible Base64", () => {
    const ip = "203.0.113.42";
    const one = hashIp(ip, "first-test-key");
    const two = hashIp(ip, "first-test-key");
    const differentKey = hashIp(ip, "second-test-key");

    expect(one).toMatch(/^ip-hmac-v1-[a-f0-9]{64}$/);
    expect(one).toBe(two);
    expect(one).not.toBe(differentKey);
    expect(one).not.toContain(ip);
    expect(one).not.toContain(Buffer.from(ip).toString("base64"));
  });
});

describe("numericValue", () => {
  it("converts Decimal-like values without exposing Decimal objects to the UI", () => {
    expect(numericValue({ toNumber: () => 13.8 })).toBe(13.8);
    expect(numericValue("27.5")).toBe(27.5);
    expect(numericValue("not-a-number")).toBeNull();
  });
});
