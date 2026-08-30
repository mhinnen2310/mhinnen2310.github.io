import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  roleAtLeast: vi.fn(),
  mobileSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("argon2", () => ({ default: { verify: mocks.verify } }));
vi.mock("./env", () => ({ env: { authSecret: "test-mobile-auth-secret" } }));
vi.mock("./auth", () => ({ roleAtLeast: mocks.roleAtLeast }));
vi.mock("./prisma", () => ({ prisma: { mobileSession: mocks.mobileSession, user: mocks.user, $transaction: mocks.transaction } }));

import { loginMobile, MobileAuthError, refreshMobile, revokeMobileSession } from "./mobile-auth";

const staff = { id: "staff-1", email: "staff@example.test", name: "Staff", role: "STAFF", emailVerified: new Date(), passwordHash: "hash" };

describe("mobile authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.verify.mockResolvedValue(true);
    mocks.mobileSession.create.mockResolvedValue({}); mocks.user.update.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it("creates only hashed opaque tokens and updates the staff login timestamp", async () => {
    mocks.user.findUnique.mockResolvedValue(staff);
    const result = await loginMobile(" STAFF@EXAMPLE.TEST ", "correct", "device-identifier-1234");
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.mobileSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessTokenHash: expect.not.stringContaining(result.accessToken), refreshTokenHash: expect.not.stringContaining(result.refreshToken) }) }));
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: staff.id } }));
  });

  it("rejects a non-staff or wrong-password login without identifying the account", async () => {
    mocks.user.findUnique.mockResolvedValue({ ...staff, role: "CUSTOMER" }); mocks.roleAtLeast.mockReturnValue(false);
    await expect(loginMobile(staff.email, "wrong", "device-identifier-1234")).rejects.toThrow("Inloggen mislukt.");
  });

  it("revokes a refresh session when its device binding does not match", async () => {
    mocks.mobileSession.findUnique.mockResolvedValue({ id: "session-1", deviceIdHash: "different", revokedAt: null, refreshExpiresAt: new Date(Date.now() + 60_000) });
    mocks.mobileSession.update.mockResolvedValue({});
    await expect(refreshMobile("a".repeat(43), "device-identifier-1234")).rejects.toThrow("Sessie verlopen");
    expect(mocks.mobileSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revokedReason: "refresh_replay_or_device_mismatch" }) }));
  });

  it("conditionally revokes only the currently valid bearer session on logout", async () => {
    mocks.mobileSession.findUnique.mockResolvedValue({ id: "session-1", revokedAt: null, user: staff }); mocks.mobileSession.updateMany.mockResolvedValue({ count: 1 });
    await expect(revokeMobileSession(`Bearer ${"a".repeat(43)}`)).resolves.toMatchObject({ id: "session-1", user: { id: staff.id } });
    expect(mocks.mobileSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-1", revokedAt: null } }));
  });

  it("does not treat malformed bearer material as a session", async () => {
    await expect(revokeMobileSession("Bearer short")).rejects.toBeInstanceOf(MobileAuthError);
  });
});
