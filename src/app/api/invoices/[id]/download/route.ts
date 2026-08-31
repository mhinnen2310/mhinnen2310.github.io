import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, roleAtLeast } from "@/lib/auth";
import { getInvoicePdf } from "@/lib/invoices";
import { verifyGuestInvoiceToken } from "@/lib/order-access";

/**
 * Invoice PDF download.
 * Access (any of):
 *  - logged-in owner of the order;
 *  - STAFF/ADMIN/OWNER;
 *  - guest presenting a signed access token returned only after a successful
 *    order-number + e-mail lookup.
 * The PDF is generated from the immutable invoice snapshot (Invariant 8).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { order: { select: { userId: true, orderNumber: true, customerEmail: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const url = new URL(req.url);
  const guestVerified = verifyGuestInvoiceToken(
    invoice.order.orderNumber,
    invoice.order.customerEmail,
    url.searchParams.get("access"),
  );

  if (
    !(
      (user && (invoice.order.userId === user.id || roleAtLeast(user.role, "STAFF"))) ||
      guestVerified
    )
  ) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  const result = await getInvoicePdf(invoice.id);
  if (!result) {
    return NextResponse.json({ error: "Factuur is nog niet beschikbaar." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${result.invoiceNumber}.pdf"`,
    },
  });
}
