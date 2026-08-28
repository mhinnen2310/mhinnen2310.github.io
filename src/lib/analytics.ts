import { prisma } from "./prisma";

/**
 * First-party, privacy-conscious analytics (spec 40).
 *
 * Events are stored locally (AnalyticsEvent) and power the admin
 * operational dashboard. No third-party tracker is required; an external
 * (e.g. Plausible/Matomo) integration can be added as a separate adapter
 * later. Only business-relevant events are recorded:
 *
 *   product_view, catalogue_search, appointment_started,
 *   appointment_completed, add_to_cart, checkout_started, purchase
 */

export interface TrackEventInput {
  event: string;
  entityType?: string | null;
  entityId?: string | null;
  sessionId?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function trackEvent(
  event: string,
  entityType?: string | null,
  entityId?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        meta: (meta ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    // Observability must never break the request path.
    console.error(`analytics: failed to record "${event}"`, err);
  }
}

export async function track(input: TrackEventInput): Promise<void> {
  return trackEvent(input.event, input.entityType, input.entityId, input.meta);
}
