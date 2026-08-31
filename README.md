# Demi Fietsen webshop

Next.js/TypeScript webshop for unique used e-bikes and stocked accessories. It uses PostgreSQL through Prisma, Mollie for live payments, and local media storage by default.

## Local development

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `DIRECT_URL` and a local `AUTH_SECRET`.
2. Run `npm run db:deploy` to apply migrations.
3. Run `npm run dev`.

### Local Docker testomgeving (aanbevolen)

Voor een volledig lokale test hoef je geen Render- of Supabase-account te
gebruiken. Docker Compose start een eigen PostgreSQL-container en de Next.js-
app met lokale mediastorage:

```text
docker compose -f docker-compose.local.yml up --build
```

Open daarna `http://localhost:3001`. Seed uitsluitend demo-data wanneer je dat
bewust wilt:

```text
docker compose -f docker-compose.local.yml run --rm web npm run db:seed
```

De beheeragenda is één gedeelde kalender voor vrije beschikbaarheidsblokken,
klantafspraken en werkplaats/service-items. De regels voor beschikbaarheid
worden op dezelfde pagina beheerd.

### Nieuwe UI naast de klassieke site

De redesign is als aparte, omkeerbare UI-modus in dezelfde lokale Next-app
opgenomen. Open na het starten van Docker één keer:

```text
http://localhost:3001/redesign
```

Daarna worden ook de bestaande routes (`/fietsen`, `/accessoires`, checkout,
account en alle `/admin`-schermen) in de nieuwe shell geopend. De oorspronkelijke
weergave blijft beschikbaar via `http://localhost:3001/?ui=classic`. Er wordt
geen tweede database of tweede set functies aangemaakt: beide varianten delen
dezelfde serveracties, gegevens en permissies.

De debug-medewerkersapp wijst standaard naar deze Docker-stack via
`http://10.0.2.2:3001` (Android-emulator). Voor een fysieke telefoon bouw je
met `-PapiBaseUrl=http://<LAN-IP-van-je-computer>:3001`.

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
- a strong `AUTH_SECRET`, separate `IP_HASH_SECRET`, and separate `CRON_SECRET`.
- Firebase Admin (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and
  `FIREBASE_PRIVATE_KEY`) plus the matching Android `google-services.json`.

Schedule `GET` or `POST /api/maintenance/sweep` every five minutes (this also
dispatches changed push snapshots) with either `Authorization: Bearer
<CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. The endpoint expires
abandoned checkouts, releases bike reservations and restores accessory stock.
Catalogue and checkout requests also run a bounded fallback sweep.

Before a real launch, replace the demo inventory/photos and obtain approved privacy, terms, return and warranty copy. Those business and legal texts are intentionally not fabricated by the application.

## Optionele online preview (Render + Supabase)

Dit stuk is alleen legacy-documentatie. Voor jouw ontwikkeling en acceptatietest
gebruik je de lokale Docker-stack hierboven; Render en Supabase zijn daarvoor
niet nodig.

GitHub Pages kan deze applicatie niet uitvoeren: de webshop heeft Next.js-serverroutes, Prisma, PostgreSQL, authenticatie en webhooks nodig. Voor een afgeschermde testomgeving staat `render.yaml` klaar.

1. Maak een gratis Supabase-project en een private Storage-bucket `demifietsen-media`.
2. Gebruik de Supabase pooler connection string als `DATABASE_URL` en pas lokaal de migraties toe met `npm run db:deploy`.
3. De Render-build voert `npm run db:bootstrap` uit. Alleen wanneer de previewdatabase nog geen gebruikers bevat, wordt de demo-seed eenmalig uitgevoerd. Latere deployments bewaren de bestaande data.
4. Maak op Render een Blueprint van deze repository en vul de geheime variabelen uit `render.yaml` in.
5. Vul voor `NEXT_PUBLIC_SITE_URL` en `APP_BASE_URL` dezelfde toegewezen `https://...onrender.com`-URL in en start daarna een nieuwe deployment.

`DEPLOYMENT_MODE=preview` houdt betalingen op de mock-provider en voegt `noindex` toe. Verwijder deze instelling niet om een echte winkel te simuleren; een echte productieomgeving vereist Mollie, SMTP, monitoring, backups en juridisch gecontroleerde teksten.

Supabase Storage wordt gebruikt wanneer `STORAGE_DRIVER=supabase`. De service-role key blijft uitsluitend een server-side omgevingsvariabele en mag nooit in Git worden gezet.
