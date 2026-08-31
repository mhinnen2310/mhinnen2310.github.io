# P0 rapport — technische betrouwbaarheid

## Scope

Deze wijziging blijft binnen P0. Er is geen nieuwe kassaflow, terminalintegratie
of frontend-redesign gebouwd.

## Gewijzigd

- Eén centrale server-side sale-completion flow is toegevoegd in
  `src/lib/orders.ts`. Alleen deze flow schrijft een fiets van `RESERVED`
  naar `SOLD`.
- De flow verwerkt atomair: orderbetaling, alle bijbehorende fietsreserveringen,
  fietsstatus en gerealiseerde prijs, garantie-records, één factuur en
  auditlogs.
- `confirmManualPayment(orderId, method, actor)` vormt de veilige basis voor
  toekomstige CASH- en BANK_TRANSFER-bevestiging. Hij vereist minimaal
  `STAFF`, gebruikt uitsluitend het server-side ordertotaal en loopt door
  exact dezelfde sale-completion transactie. Er is bewust geen kassascherm of
  openbare route toegevoegd.
- `Payment.method` onderscheidt de zakelijke betaalmethode van de technische
  provider: `MOLLIE`, `SUMUP`, `CASH`, `BANK_TRANSFER` en `MOCK`.
- Checkout maakt nu binnen één transactie voor **iedere** unieke fiets een
  actieve checkout-reservering. Fiets- en productupdates zijn conditioneel op
  actuele status, voorraad en server-side prijs; de lockvolgorde is stabiel.
- Een lokale Payment-intentie bestaat vóór de externe provider-call. Mislukte,
  verlopen en geannuleerde betalingen claimen de PENDING-order één keer,
  geven alle fietsen uit de orderregels vrij (ook historische regels zonder
  reservation row) en herstellen voorraad één keer.
- Ambigue provider-creatie na een extern betalingskenmerk houdt de reservering
  tijdelijk vast in plaats van die onveilig vrij te geven. Voor Mollie kan een
  geverifieerde webhook de lokale binding via provider-metadata herstellen;
  de bestaande TTL-sweep is de bovengrens als geen betaling volgt.
- Webhook-events gebruiken nu een lease-status (`PROCESSING` + `updatedAt`).
  Gecrashte of mislukte verwerkingen kunnen worden teruggepakt, terwijl een
  actieve verwerking niet dubbel wordt uitgevoerd.
- Generieke fietsstatuswijzigingen kunnen niet meer naar `SOLD` of
  `RESERVED` gaan. Handmatig reserveren/vrijgeven is transactioneel; een
  checkout-reservering kan niet vanuit het adminscherm worden losgelaten.
- De generieke admin-orderstatusroute kan geen order meer annuleren of een
  onbetaalde order fulfilment-statussen geven. Hij gebruikt de beveiligde
  orderlifecycle.
- Bij een echte succesvolle online verkoop wordt de factuur in dezelfde
  transactie vastgelegd. PDF-generatie en e-mail zijn best effort ná commit.
  De factuurmail bevat nu een geldige, gesigneerde gast-downloadlink.
- Facturen hebben een nullable unieke `issuedOrderKey`, zodat één normale
  ISSUED-factuur per order ook bij gelijktijdige verwerking afgedwongen is.
- IP-fingerprints zijn vervangen door keyed HMAC-SHA256
  (`ip-hmac-v1-…`). Productie en preview vereisen `IP_HASH_SECRET`.
- Eenmalige auth-tokens worden nu conditioneel geclaimd, zodat twee gelijktijdige
  verzoeken dezelfde reset-/verificatietoken niet allebei kunnen gebruiken.
- Datatypen zijn gecorrigeerd: `wheelSizeInches Decimal(4,1)`,
  `batteryAh Decimal(5,2)` en `labourMinutes Int`. Publieke weergaven en
  catalogusfilters zetten Decimal-waarden veilig om naar numbers. Alle
  bestaande geldvelden zijn gecontroleerd en blijven integer cents.

## Waarom

De oude checkout reserveerde meerdere fietsen als `RESERVED`, maar schreef
slechts voor de eerste fiets een Reservation-record. Daardoor kon vrijgave of
betaling een fiets overslaan. Daarnaast kon de adminstatus een fiets direct
als `SOLD` zetten, buiten order, betaling, factuur, garantie en audittrail
om. Beide paden zijn vervangen door invarianten die de order als bron van
waarheid behandelen.

## Migrations

Nieuwe migratie:

`prisma/migrations/20260830000000_p0_lifecycle_integrity/migration.sql`

Deze doet het volgende:

- hernoemt wielmaat zonder een onjuiste cm-naar-inch conversie en ondersteunt
  decimale inchmaten;
- zet bestaande gehele `batteryAh` veilig om naar decimalen;
- hernoemt `labourHours` en vermenigvuldigt bestaande uren met 60;
- voegt `PaymentMethod` toe en vult historische providers conservatief aan;
- ruimt eventuele dubbele actieve reserveringen deterministisch op en voegt
  een partial unique index toe: maximaal één ACTIVE-reservering per fiets;
- voegt de unieke normale-factuurkey toe en behoudt historische dubbele
  facturen voor auditdoeleinden;
- voegt webhook-leasingvelden toe;
- wist uitsluitend oude reversibele `ip-<base64>`-waarden uit
  ContactMessage en AuditLog. Nieuwe HMAC-waarden blijven behouden.

De migratie is aangemaakt en gevalideerd, maar niet op een gebruikersdatabase
uitgevoerd.

## Gevonden problemen

- Multi-bike checkout maakte maar één reservation row.
- Release baseerde zich op reservation rows en kon daardoor tweede fietsen
  stranded `RESERVED` achterlaten.
- `markOrderPaid` kon een order betaald maken terwijl een fiets niet
  correct gereserveerd/verkocht was.
- Generieke adminstatus kon `SOLD`, `RESERVED`, orderannulering en
  fulfilment buiten de lifecycle zetten.
- Webhook FAILED-events waren niet opnieuw verwerkbaar; een crash na
  ontvangst kon een event permanent blokkeren.
- Mislukte/terminale orders konden in bepaalde herhaalde paden opnieuw
  voorraad herstellen.
- Facturatie gebeurde niet automatisch bij een echte sale; de bestaande
  factuurmail verwees bovendien naar een niet-bestaande/ongeschikte PDF-link.
- IP-“hashes” waren reversible Base64.
- Auth-token-consumptie had een read-then-write race.
- `.env.example` documenteerde de door Prisma vereiste `DIRECT_URL` niet.

## Tests en controles

Toegevoegd of uitgebreid:

- multi-bike reservation planning en dubbele unieke fietsregels;
- release van alle fietsregels bij betalingsfout, inclusief legacy-gat;
- centrale sale completion, ontbrekende reservering en concurrerende webhook;
- CASH-autorisatie;
- webhook retry/lease en payment-failure routing;
- directe SOLD-weigering;
- HMAC-IP en Decimal-conversie;
- conditionele one-time auth-token-consumptie.

Uitgevoerd en geslaagd:

```text
npx prisma validate
npm run typecheck
npm test        # 11 bestanden, 25 tests
npm run lint
npm run build
git diff --check
```

Voor Prisma-validatie is uitsluitend voor het lokale proces `DIRECT_URL`
tijdelijk gelijk gezet aan de reeds geconfigureerde `DATABASE_URL`; er is
geen database gemigreerd of gewijzigd.

## Resterende risico's

- De nieuwe migratie moet eerst via de normale releaseprocedure en met backup
  op de doelomgeving worden uitgerold.
- Een provider-call is geen gedistribueerde database-transactie. De Mollie
  metadata-recovery beperkt het bekende koppelfalenscenario; een echte
  providerincident blijft operationele monitoring en reconciliatie vereisen.
- Betaalde maar te late/inconsistente betalingen worden bewust niet verkocht;
  ze krijgen `paid_requires_manual_review` en vereisen een bevoegde
  menselijke beoordeling.
- Tests zijn gerichte unit/mocked transaction tests. Voor livegang blijft een
  stagingtest met echte PostgreSQL-migratie en Mollie testmodus nodig.
- Bestaande reversibele IP-fingerprints worden gewist in plaats van omgezet,
  omdat veilig herhasen zonder applicatiegeheim niet mogelijk is.

## Expliciet doorgeschoven naar P1

- Kassascherm en workflow voor CASH/BANK_TRANSFER.
- SumUp-terminaladapter, terminal-webhooks en settlement/reconciliatie-UI.
- Handmatige-review- en exception-queue voor late/inconsistente betalingen.
- Uitgebreide refund/creditnote-bedieningsflow en operationele rapportages.
- End-to-end/browsertests tegen een afzonderlijke stagingdatabase en echte
  betaalprovider-sandbox.
