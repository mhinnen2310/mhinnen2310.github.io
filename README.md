# Demi Fietsen webshop

Next.js/TypeScript webshop for unique used e-bikes and stocked accessories. It uses PostgreSQL through Prisma, Mollie for live payments, and local media storage by default.

## Local development

1. Copy `.env.example` to `.env` and fill in the database URL and a local `AUTH_SECRET`.
2. Run `npm run db:deploy` to apply migrations.
3. Run `npm run dev`.

`npm run db:seed` is intentionally destructive demo tooling: it removes existing database rows and inserts fictional customers, placeholder photos and sample orders. Never run it against a production database.

## Quality checks

Run these before publishing changes:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

## Production checklist

The application rejects checkout in production unless these are explicitly configured:

- `PAYMENT_PROVIDER=mollie` with a live `MOLLIE_API_KEY`;
- public HTTPS `NEXT_PUBLIC_SITE_URL` and `APP_BASE_URL` values;
- SMTP (`EMAIL_TRANSPORT=smtp`, `SMTP_URL`, and `EMAIL_FROM`);
- a strong `AUTH_SECRET` and separate `CRON_SECRET`.

Schedule `GET` or `POST /api/maintenance/sweep` every five minutes with either `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. The endpoint expires abandoned checkouts, releases bike reservations and restores accessory stock. Catalogue and checkout requests also run a bounded fallback sweep.

Before a real launch, replace the demo inventory/photos and obtain approved privacy, terms, return and warranty copy. Those business and legal texts are intentionally not fabricated by the application.
