import { cookies } from "next/headers";
import { UI_MODE_COOKIE } from "@/lib/ui-mode-cookie";

export type UiMode = "initial" | "redesign";

export async function getUiMode(): Promise<UiMode> {
  const store = await cookies();
  return store.get(UI_MODE_COOKIE)?.value === "initial" ? "initial" : "redesign";
}
