import { describe, expect, it } from "vitest";
import { addMonths } from "./warranty";

describe("addMonths", () => {
  it("clamps 29 August plus six months to the final day of February", () => {
    expect(addMonths(new Date("2026-08-29T12:00:00.000Z"), 6).toISOString()).toBe("2027-02-28T12:00:00.000Z");
  });

  it("clamps a month end in a leap year", () => {
    expect(addMonths(new Date("2024-01-31T09:30:00.000Z"), 1).toISOString()).toBe("2024-02-29T09:30:00.000Z");
  });

  it("keeps the day when it exists in the target month", () => {
    expect(addMonths(new Date("2026-08-15T12:00:00.000Z"), 6).toISOString()).toBe("2027-02-15T12:00:00.000Z");
  });
});
