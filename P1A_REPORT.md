# P1-A rapport — fietsdossier en voorraadbeheer

## Gerealiseerde functionaliteit

- `/admin/accessoires` kan nu accessoires aanmaken. De creatie vereist SKU,
  naam, verkoopprijs en openingsvoorraad; die openingsvoorraad wordt in
  dezelfde transactie als `StockMovement` met reden `receive` vastgelegd.
  Bestaande accessoires kunnen ook titel, categorie, prijzen, voorraadgrens,
  zichtbaarheid en beschrijving beheren.
- Nieuwe fietsen worden vanuit `/admin/fietsen/nieuw` aangemaakt met een
  transactioneel, server-side gegenereerd inventarisnummer (`DF-B-jaar-volgnummer`).
  Elke nieuwe fiets start altijd als `INTAKE`.
- Het fietsdossier is uitgebreid met beheersecties voor overzicht,
  specificaties, elektrisch/accu, conditie, werkplaats, foto's, inkoop en
  kosten, verkoop en historie. Alle bestaande gestructureerde Bike-velden
  worden via een allow-list server-side gevalideerd; lege invoer wordt als
  `null` opgeslagen waar dat semantisch juist is.
- Inkoop, onderdelen, reparatie en overige kosten blijven integer cents.
  Arbeid blijft minuten. Totale kostprijs, verwachte brutomarge en
  gerealiseerde brutomarge worden uitsluitend uit serverdata berekend.
- De voorraadlijst heeft zoeken op inventarisnummer, merk, model en
  framenummer, plus filters op status, merk, elektrisch en fietstype. Zij
  toont omslagfoto, prijs, locatie, binnenkomstdatum en dagen in voorraad/
  beschikbaar.
- Fietsbeelden kunnen worden geüpload, geordend, als omslag ingesteld,
  verwijderd en als intern gemarkeerd. Interne beelden worden consequent uit
  catalogus, zoekresultaten, winkelwagen, vergelijkbare fietsen en publieke
  detailpagina's gefilterd.
- `SALE_PENDING` is als lifecycle-eigen status toegevoegd. Generieke
  adminstatuswijzigingen kunnen `RESERVED`, `SALE_PENDING` of `SOLD` niet
  betreden of verlaten. `SOLD -> ARCHIVED` blijft mogelijk; verkoop zelf
  blijft exclusief de P0 sale-completion flow.
- Prijswijzigingen schrijven conditioneel een `PriceHistoryEntry` met oude en
  nieuwe centwaarde. Status-, foto-, werkplaats-, voorraad- en
  dossierwijzigingen behouden auditlogging.
- `INTAKE`, `WORKSHOP`, `READY` en `SALE_PENDING` zijn niet publiek via een
  directe slug toegankelijk. Het normale aanbod blijft uitsluitend
  `AVAILABLE`; gereserveerde en verkochte/archief-fietsen gebruiken de
  bestaande bewuste publieke paden.

## Gewijzigde databasevelden en migratie

Nieuwe migratie:

`prisma/migrations/20260831000000_p1a_inventory_admin/migration.sql`

- voegt `BikeStatus.SALE_PENDING` toe;
- voegt nullable `Bike.variant` en `Bike.modelYear` toe;
- voegt `BikeImage.isInternal` met veilige default `false` toe en indexeert
  publiek/intern beeldophalen.

De migratie is aangemaakt en gevalideerd, maar niet op een database toegepast.
Historische foto's blijven daardoor publiek totdat een medewerker ze expliciet
als intern markeert.

## Belangrijke architectuurkeuzes

- Geen nieuw voorraad- of lifecycle-systeem: P1-A hergebruikt `Bike`,
  `Product`, `ServiceTask`, `PriceHistoryEntry`, `StockMovement` en
  `AuditLog`.
- `src/lib/bike-input.ts` en `src/lib/product-input.ts` vormen de centrale
  server-side invoergrens. De client converteert alleen voor gebruiksgemak;
  status, centwaarden, identifiers en opslag komen nooit van clientvertrouwen.
- Het bestaande `NumberCounter` levert het atomaire inventarisnummer en
  vermijdt een race bij gelijktijdige intake.
- Foto-opslag blijft de bestaande storage abstraction gebruiken. DB-mutaties
  voor omslag, volgorde en zichtbaarheid zijn transactioneel; objectverwijdering
  is best-effort ná de databasecommit.

## Tests en controles

Toegevoegd/uitgebreid:

- correcte intake-startstatus en server-side validatie;
- P0-decimalen voor wielmaat/accu en integer-centvalidatie;
- accessoirevalidatie;
- toegestane/verboden lifecycletransities inclusief `SALE_PENDING`;
- handmatig `SOLD` en handmatig `SALE_PENDING` blokkeren;
- kostprijs/marge en voorraadouderdom;
- publieke statusafscherming;
- atomaire prijswijziging met prijshistorie.

Uitgevoerd en geslaagd:

```text
npx prisma validate  # met uitsluitend proceslokale DIRECT_URL=DATABASE_URL
npm run typecheck
npm test             # 14 bestanden, 36 tests
npm run lint
npm run build
git diff --check
```

## Bekende beperkingen en technische schuld

- De volgorde van foto's wordt met pijlen beheerd; er is bewust geen drag-and-drop
  dependency toegevoegd.
- Service-regels zijn toevoegbaar en af te ronden/heropenen; volledig bewerken,
  verwijderen en een onderdelenmagazijn behoren niet tot deze sprint.
- Er zijn gerichte unit/mocked-transactietests. Voor release blijft een
  migratietest tegen een aparte PostgreSQL-stagingdatabase nodig.
- De normale accessoire-editor beheert nog geen accessoire-afbeeldingen;
  bestaande media blijft intact.

## Expliciet naar P1-B

- Uitgebreide werkplaatsplanning, onderdelenverbruik en taakbewerking.
- Volledig accudossier met meet-/SOH-protocol en intakecontroleproces.
- QR-tags en mobiele/Android intake.
- SumUp, kassascherm en operationele betaalreconciliatie.
- Marktplaats/Facebook-publicatie en AI-functies.
