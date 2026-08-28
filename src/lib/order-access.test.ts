import { describe, expect, it } from "vitest";
import {
  createGuestInvoiceToken,
  createPaymentStatusToken,
  verifyGuestInvoiceToken,
  verifyPaymentStatusToken,
} from "./order-access";

const secret = "test-only-secret";

describe("signed guest order access", () => {
  it("only accepts the status token for its intended order", () => {
    const token = createPaymentStatusToken("DF-2026-000123", secret);
    expect(verifyPaymentStatusToken("DF-2026-000123", token, secret)).toBe(true);
    expect(verifyPaymentStatusToken("DF-2026-000124", token, secret)).toBe(false);
  });

  it("binds a guest invoice token to both the order and its e-mail address", () => {
    const token = createGuestInvoiceToken("DF-2026-000123", "klant@example.nl", secret);
    expect(verifyGuestInvoiceToken("DF-2026-000123", "klant@example.nl", token, secret)).toBe(true);
    expect(verifyGuestInvoiceToken("DF-2026-000123", "andere@example.nl", token, secret)).toBe(false);
  });
});
