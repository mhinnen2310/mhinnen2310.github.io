import { mobileActor, mobileOk } from "@/lib/mobile-route";
import { prisma } from "@/lib/prisma";

/** In-app operational alerts. Remote push delivery can be layered on later without changing the data contract. */
export async function GET(req: Request) {
  const { actor, response } = await mobileActor(req); if (!actor) return response!;
  const now = new Date(); const sixtyDays = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
  const [sales, lowQr, products, expiredReservations, manualReviews, oldStock] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: "PAID", paidAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
    prisma.qrTag.count({ where: { status: "UNUSED" } }),
    prisma.product.findMany({ where: { active: true }, select: { stockQuantity: true, lowStockThreshold: true } }),
    prisma.reservation.count({ where: { status: "ACTIVE", expiresAt: { lt: now } } }),
    prisma.payment.count({ where: { status: "paid_requires_manual_review" } }),
    prisma.bike.count({ where: { status: { in: ["AVAILABLE", "READY", "WORKSHOP"] }, createdAt: { lt: sixtyDays } } }),
  ]);
  const lowProducts = products.filter((product) => product.stockQuantity <= product.lowStockThreshold).length;
  const notifications = [
    ...(sales ? [{ category: "sales", title: `${sales} verkoop${sales === 1 ? "" : "en"} vandaag`, body: "Controleer factuur, garantie en aflevering." }] : []),
    ...(lowQr < 25 ? [{ category: "inventory", title: `QR-voorraad laag: ${lowQr}`, body: "Maak of bestel tijdig een nieuwe labelbatch." }] : []),
    ...(lowProducts ? [{ category: "inventory", title: `${lowProducts} accessoires bijna op`, body: "Controleer de voorraad." }] : []),
    ...(expiredReservations ? [{ category: "reservations", title: `${expiredReservations} reserveringen verlopen`, body: "Geef ze vrij of controleer de betaalstatus." }] : []),
    ...(manualReviews ? [{ category: "payments", title: `${manualReviews} betalingen vereisen controle`, body: "Een betaalde order kon niet veilig automatisch afronden." }] : []),
    ...(oldStock ? [{ category: "inventory", title: `${oldStock} fietsen langer dan 60 dagen`, body: "Controleer prijs en advertentie." }] : []),
  ];
  return mobileOk({ notifications, generatedAt: now.toISOString() });
}
