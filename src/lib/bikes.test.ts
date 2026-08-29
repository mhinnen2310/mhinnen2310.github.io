import { describe, expect, it } from "vitest";
import { canTransition } from "./bikes";

describe("generic bike status transitions", () => {
  it("cannot enter lifecycle-managed reservation or sale states", () => {
    expect(canTransition("AVAILABLE", "RESERVED")).toBe(false);
    expect(canTransition("AVAILABLE", "SOLD")).toBe(false);
    expect(canTransition("RESERVED", "SOLD")).toBe(false);
  });
});
