import { prisma } from "@/lib/prisma";

export const OPERATIONAL_CATEGORIES = ["sales", "inventory", "reservations", "payments", "workshop", "service", "appointments"] as const;
export type OperationalCategory = (typeof OPERATIONAL_CATEGORIES)[number];

export type OperationalNotification = {
  category: OperationalCategory;
  title: string;
  body: string;
  href: string;
  /** Stable state value used to avoid sending an unchanged alert repeatedly. */
  state: string;
};

export async function getOperationalNotifications(now = new Date()) {
  const sixtyDays = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
  const day = now.toISOString().slice(0, 10);
  const [sales, lowQr, products, expiredReservations, manualReviews, oldStock, incompleteWorkshop, newServiceRequests, newAppointments] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: "PAID", paidAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
    prisma.qrTag.count({ where: { status: "UNUSED" } }),
    prisma.product.findMany({ where: { active: true }, select: { stockQuantity: true, lowStockThreshold: true } }),
    prisma.reservation.count({ where: { OR: [{ status: "ACTIVE", expiresAt: { lt: now } }, { status: "EXPIRED", updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } }] } }),
    prisma.payment.count({ where: { status: "paid_requires_manual_review" } }),
    prisma.bike.count({ where: { status: { in: ["AVAILABLE", "READY", "WORKSHOP"] }, createdAt: { lt: sixtyDays } } }),
    prisma.bike.count({ where: { status: "WORKSHOP", serviceTasks: { some: { completed: false } } } }),
    prisma.serviceRequest.count({ where: { status: "NEW" } }),
    prisma.appointment.count({ where: { status: "NEW", preferredDate: { gte: now } } }),
  ]);
  const lowProducts = products.filter((product) => product.stockQuantity <= product.lowStockThreshold).length;
  const notifications: OperationalNotification[] = [
    ...(sales ? [{ category: "sales" as const, title: `${sales} verkoop${sales === 1 ? "" : "en"} vandaag`, body: "Controleer factuur, garantie en aflevering.", href: "/admin/orders", state: `${day}:${sales}` }] : []),
    ...(lowQr < 25 ? [{ category: "inventory" as const, title: `QR-voorraad laag: ${lowQr}`, body: "Maak of bestel tijdig een nieuwe labelbatch.", href: "/admin/qr-labels", state: `qr:${lowQr}` }] : []),
    ...(lowProducts ? [{ category: "inventory" as const, title: `${lowProducts} accessoire${lowProducts === 1 ? "" : "s"} bijna op`, body: "Controleer de voorraad.", href: "/admin/accessoires", state: `products:${lowProducts}` }] : []),
    ...(oldStock ? [{ category: "inventory" as const, title: `${oldStock} fietsen langer dan 60 dagen`, body: "Controleer prijs en advertentie.", href: "/admin/fietsen", state: `old:${oldStock}` }] : []),
    ...(expiredReservations ? [{ category: "reservations" as const, title: `${expiredReservations} reservering${expiredReservations === 1 ? "" : "en"} verlopen`, body: "Geef ze vrij of controleer de betaalstatus.", href: "/admin/reserveringen", state: `expired:${expiredReservations}` }] : []),
    ...(manualReviews ? [{ category: "payments" as const, title: `${manualReviews} betaling${manualReviews === 1 ? "" : "en"} vereisen controle`, body: "Een betaalde order kon niet veilig automatisch afronden.", href: "/admin/betalingen-controleren", state: `review:${manualReviews}` }] : []),
    ...(incompleteWorkshop ? [{ category: "workshop" as const, title: `${incompleteWorkshop} werkplaatsfiets${incompleteWorkshop === 1 ? "" : "en"} incompleet`, body: "Werk openstaande taken af voordat de fiets beschikbaar komt.", href: "/admin/fietsen", state: `workshop:${incompleteWorkshop}` }] : []),
    ...(newServiceRequests ? [{ category: "service" as const, title: `${newServiceRequests} nieuw serviceverzoek${newServiceRequests === 1 ? "" : "en"}`, body: "Bekijk het verzoek en neem contact op met de klant.", href: "/admin/service", state: `service:${newServiceRequests}` }] : []),
    ...(newAppointments ? [{ category: "appointments" as const, title: `${newAppointments} nieuwe afspraak${newAppointments === 1 ? "" : "en"}`, body: "Bevestig de afspraak of neem contact op met de klant.", href: "/admin/afspraken", state: `appointments:${newAppointments}` }] : []),
  ];
  const states = Object.fromEntries(OPERATIONAL_CATEGORIES.map((category) => {
    const categoryItems = notifications.filter((item) => item.category === category);
    return [category, categoryItems.map((item) => item.state).sort().join("|") || "0"];
  })) as Record<OperationalCategory, string>;
  return { notifications, states, generatedAt: now.toISOString() };
}
