import { describe, expect, it } from "vitest";
import { parseMollieWebhookBody } from "./mollie-webhook";

describe("parseMollieWebhookBody", () => {
  it("parses Mollie's documented form-encoded payment id", () => {
    expect(parseMollieWebhookBody("id=tr_d0b0E3EA3v", "application/x-www-form-urlencoded")).toEqual({
      id: "tr_d0b0E3EA3v",
    });
  });

  it("accepts a JSON payload from an intermediary", () => {
    expect(parseMollieWebhookBody('{"id":"tr_json"}', "application/json")).toEqual({ id: "tr_json" });
  });

  it("rejects bodies without a usable payment id", () => {
    expect(parseMollieWebhookBody("status=paid", "application/x-www-form-urlencoded")).toBeNull();
  });
});
