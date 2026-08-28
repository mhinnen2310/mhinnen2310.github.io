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

## Gratis online preview (Render + Supabase)

GitHub Pages kan deze applicatie niet uitvoeren: de webshop heeft Next.js-serverroutes, Prisma, PostgreSQL, authenticatie en webhooks nodig. Voor een afgeschermde testomgeving staat `render.yaml` klaar.

1. Maak een gratis Supabase-project en een private Storage-bucket `demifietsen-media`.
2. Gebruik de Supabase pooler connection string als `DATABASE_URL` en pas lokaal de migraties toe met `npm run db:deploy`.
3. De Render-build voert `npm run db:bootstrap` uit. Alleen wanneer de previewdatabase nog geen gebruikers bevat, wordt de demo-seed eenmalig uitgevoerd. Latere deployments bewaren de bestaande data.
4. Maak op Render een Blueprint van deze repository en vul de geheime variabelen uit `render.yaml` in.
5. Vul voor `NEXT_PUBLIC_SITE_URL` en `APP_BASE_URL` dezelfde toegewezen `https://...onrender.com`-URL in en start daarna een nieuwe deployment.

`DEPLOYMENT_MODE=preview` houdt betalingen op de mock-provider en voegt `noindex` toe. Verwijder deze instelling niet om een echte winkel te simuleren; een echte productieomgeving vereist Mollie, SMTP, monitoring, backups en juridisch gecontroleerde teksten.

Supabase Storage wordt gebruikt wanneer `STORAGE_DRIVER=supabase`. De service-role key blijft uitsluitend een server-side omgevingsvariabele en mag nooit in Git worden gezet.
