import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account";
import { getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ipHashOf } from "@/lib/rate-limit";

/**
 * GDPR account deletion (spec 20/38).
 * Removes the account and its personal data; order/invoice financial
 * records are retained but anonymised (legal retention duty).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Ingelogd zijn vereist." }, { status: 401 });
  }

  // Confirmation payload: the client must echo confirm: true.
  let body: { confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Bevestiging ontbreekt." }, { status: 400 });
  }

  await deleteAccount(user.id);
  const ip = await ipHashOf(req.headers);
  // The user row has already been removed. Record this as a system event with
  // the deleted opaque id so the audit insert cannot violate its user FK.
  await audit("account.deleted", "User", user.id, null, null, ip);

  return NextResponse.json({
    ok: true,
    message: "Je account is verwijderd. Bestel- en factuurgegevens blijven per wetgeving bewaard maar zijn geanonimiseerd.",
  });
}
