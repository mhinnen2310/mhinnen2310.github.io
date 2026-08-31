import { describe, expect, it } from "vitest";
import { mobileError } from "./mobile-route";

describe("mobile API error responses", () => {
  it("does not expose unknown infrastructure errors", async () => {
    const response = mobileError(new Error("Prisma connection details"), "Actie mislukt.");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Actie mislukt." });
  });

  it("preserves an explicitly safe domain message", async () => {
    const error = new Error("Deze fiets is al verkocht.");
    error.name = "BikeAdminError";
    const response = mobileError(error, "Actie mislukt.");
    await expect(response.json()).resolves.toEqual({ error: "Deze fiets is al verkocht." });
  });
});
