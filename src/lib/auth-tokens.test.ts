import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authToken: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  prisma: { authToken: null as unknown },
}));
mocks.prisma.authToken = mocks.authToken;

vi.mock("./prisma", () => ({ prisma: mocks.prisma }));

import { consumeAuthToken } from "./auth-tokens";

describe("one-time auth tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authToken.findFirst.mockResolvedValue({ id: "token-row", userId: "user-1" });
  });

  it("only returns a user when the conditional consume update wins the race", async () => {
    mocks.authToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeAuthToken("raw-token", "password-reset")).resolves.toBeNull();

    expect(mocks.authToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "token-row", consumedAt: null }),
      }),
    );
  });

  it("returns the owner for the single successful conditional claim", async () => {
    mocks.authToken.updateMany.mockResolvedValue({ count: 1 });
    await expect(consumeAuthToken("raw-token", "email-verify")).resolves.toBe("user-1");
  });
});
