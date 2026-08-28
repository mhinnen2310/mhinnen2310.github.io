import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import argon2 from "argon2";
import { prisma } from "./prisma";
import { ipHashOf, rateLimitRequest } from "./rate-limit";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  role: Role;
  email: string;
  name: string | null;
  emailVerified: Date | null;
}

export interface JwtExtras {
  id?: string;
  role?: Role;
}

const credentialsProvider = CredentialsProvider({
  name: "E-mail & wachtwoord",
  credentials: {
    email: { label: "E-mail", type: "email" },
    password: { label: "Wachtwoord", type: "password" },
  },
  async authorize(credentials, req) {
    if (!credentials?.email || !credentials?.password) return null;
    const email = credentials.email.trim().toLowerCase();

    // Brute-force protection: per e-mail + per IP.
    const ip = await ipHashOf(req.headers ?? {});
    const rl = await rateLimitRequest("login", [email, ip ?? "no-ip"], 5, 60 * 10);
    if (!rl.allowed) {
      return null; // indistinguishable from bad credentials
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return null;

    let ok = false;
    try {
      ok = await argon2.verify(user.passwordHash, credentials.password);
    } catch {
      ok = false;
    }
    if (!ok) return null;

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 * 7 }, // 7 days
  secret: process.env.AUTH_SECRET,
  pages: { signIn: "/inloggen" },
  providers: [credentialsProvider],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role?: Role }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        (session.user as unknown as { id?: string }).id = token.id as string | undefined;
        (session.user as unknown as { role?: Role }).role = token.role as Role | undefined;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: "df_session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        // Note: CSRF is mitigated by sameSite=lax + Next.js Server Action nonce protection.
      },
    },
  },
};

export function getSessionUser(): Promise<SessionUser | null> {
  return getServerSession(authOptions).then(async (session) => {
    const u = session?.user as (typeof session extends null ? never : any) | undefined;
    if (!u?.id || !u?.email) return null;
    // Fresh read: role and verification state stay current even if the
    // JWT is older (e.g. admin promoted, e-mail verified since login).
    const fresh = await prisma.user
      .findUnique({ where: { id: u.id as string }, select: { role: true, emailVerified: true, name: true, email: true } })
      .catch(() => null);
    if (!fresh) return null; // account deleted since login
    return {
      id: u.id as string,
      role: fresh.role,
      email: fresh.email,
      name: fresh.name ?? (u.name as string | null) ?? null,
      emailVerified: fresh.emailVerified,
    };
  });
}

// --- Role checks -----------------------------------------------------------

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: Role | undefined | null, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export class ForbiddenError extends Error {
  constructor() {
    super("Niet geautoriseerd");
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Ingelogd zijn vereist");
    this.name = "UnauthenticatedError";
  }
}

/** Server-side guard. Use inside server actions / route handlers. */
export async function requireUser(minRole: Role = "CUSTOMER"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError();
  if (!roleAtLeast(user.role, minRole)) throw new ForbiddenError();
  return user;
}

// --- Passwords ---------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
