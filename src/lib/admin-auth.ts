import { getSessionUser, roleAtLeast, type SessionUser } from "./auth";

/** Return the current staff member, without throwing from route handlers. */
export async function getStaffUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && roleAtLeast(user.role, "STAFF") ? user : null;
}
