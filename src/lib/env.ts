/**
 * Centralised, typed access to environment variables.
 * Fail fast on missing critical config in production; be permissive in dev.
 */
const isProduction = process.env.NODE_ENV === "production";
const deploymentMode = process.env.DEPLOYMENT_MODE ?? (isProduction ? "production" : "development");
const isPreview = deploymentMode === "preview";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  deploymentMode,
  isPreview,
  databaseUrl: process.env.DATABASE_URL,
  authSecret: process.env.AUTH_SECRET,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  baseUrl: process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "mollie",
  // A production deployment must never silently prefer a test key merely
  // because both values happen to exist in its environment.
  mollieApiKey: isProduction
    ? process.env.MOLLIE_API_KEY
    : process.env.MOLLIE_API_KEY_TEST ?? process.env.MOLLIE_API_KEY,
  mediaStoragePath: process.env.MEDIA_STORAGE_PATH ?? "./storage/media",
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "supabase",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "demifietsen-media",
  emailTransport: (process.env.EMAIL_TRANSPORT ?? "console") as "console" | "smtp",
  smtpUrl: process.env.SMTP_URL,
  emailFrom: process.env.EMAIL_FROM ?? "Demi Fietsen <noreply@demifietsen.nl>",
  newsletterProvider: process.env.NEWSLETTER_PROVIDER ?? "none",
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES ?? 30),
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  cronSecret: process.env.CRON_SECRET,
  enableMockPaymentWebhook:
    (!isProduction || isPreview) && (process.env.ENABLE_MOCK_PAYMENT_WEBHOOK ?? "1") === "1",
};

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function assertEnv() {
  if (env.isProduction && !env.isPreview) {
    const missing: string[] = [];
    if (!env.databaseUrl) missing.push("DATABASE_URL");
    if (!env.authSecret) missing.push("AUTH_SECRET");
    if (!env.mollieApiKey) missing.push("MOLLIE_API_KEY");
    if (!env.smtpUrl) missing.push("SMTP_URL");
    if (!process.env.EMAIL_FROM) missing.push("EMAIL_FROM");
    if (!env.cronSecret) missing.push("CRON_SECRET");
    if (!isPublicHttpsUrl(env.siteUrl)) missing.push("NEXT_PUBLIC_SITE_URL (publieke https URL)");
    if (!isPublicHttpsUrl(env.baseUrl)) missing.push("APP_BASE_URL (publieke https URL)");
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    if (env.paymentProvider !== "mollie") {
      throw new Error("PAYMENT_PROVIDER must be 'mollie' in production");
    }
    if (env.emailTransport !== "smtp") {
      throw new Error("EMAIL_TRANSPORT must be 'smtp' in production");
    }
    if (!Number.isFinite(env.reservationTtlMinutes) || env.reservationTtlMinutes < 1) {
      throw new Error("RESERVATION_TTL_MINUTES must be a positive number");
    }
  }

  if (env.isPreview) {
    const missing: string[] = [];
    if (!env.databaseUrl) missing.push("DATABASE_URL");
    if (!env.authSecret) missing.push("AUTH_SECRET");
    if (!isPublicHttpsUrl(env.siteUrl)) missing.push("NEXT_PUBLIC_SITE_URL (publieke https URL)");
    if (!isPublicHttpsUrl(env.baseUrl)) missing.push("APP_BASE_URL (publieke https URL)");
    if (env.storageDriver !== "supabase") missing.push("STORAGE_DRIVER=supabase");
    if (!env.supabaseUrl) missing.push("SUPABASE_URL");
    if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length > 0) {
      throw new Error(`Missing preview environment variables: ${missing.join(", ")}`);
    }
    if (env.paymentProvider !== "mock") {
      throw new Error("PAYMENT_PROVIDER must be 'mock' in preview mode");
    }
  }
}
