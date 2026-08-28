import { cookies } from "next/headers";

export const CART_COOKIE = "df_cart";

/** Read the cart token from the request cookie (server side only). */
export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(CART_COOKIE)?.value;
  return v && v.length >= 16 && v.length <= 128 ? v : null;
}

export const CART_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
