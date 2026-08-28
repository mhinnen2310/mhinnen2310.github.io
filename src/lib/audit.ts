import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

/**
 * Append-only audit trail for sensitive/admin actions.
 * Never throws — observability must not break the request.
 */
export async function audit(
  action: string,
  entityType: string,
  entityId: string | null,
  meta?: Record<string, unknown> | null,
  actor?: SessionUser | null,
  ipHash?: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        meta: (meta ?? undefined) as object | undefined,
        actorId: actor?.id ?? null,
        actorType: actor ? "USER" : "SYSTEM",
        ipHash: ipHash ?? null,
      },
    });
  } catch (err) {
    console.error(`audit failed: ${action}`, err);
  }
}
