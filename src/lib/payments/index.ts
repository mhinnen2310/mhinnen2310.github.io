import { assertEnv, env } from "../env";
import { MollieProvider } from "./mollie";
import { MockProvider } from "./mock";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  assertEnv();
  if (cached) return cached;
  if (env.paymentProvider === "mollie") {
    cached = new MollieProvider();
  } else {
    cached = new MockProvider();
  }
  return cached;
}
