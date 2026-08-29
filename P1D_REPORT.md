# P1-D report — centrale verkoopworkflow

## Centrale architectuur

`Order` is het bestaande en passende verkooprecord; er is bewust geen tweede, concurrerend `Sale`-model toegevoegd. De enige route naar `Bike.SOLD` blijft de centrale completion in `src/lib/orders.ts`.

De atomaire volgorde is nu: gereserveerde fiets → `SALE_PENDING` → payment/order claim → `SOLD`, reservation-conversie, gerealiseerde prijs/margebasis, warranty snapshots, immutable invoice en auditlog. Een fout draait de hele transactie terug.

## Betalingen

- Online, Mollie en toekomstige SumUp-adapters gebruiken de geverifieerde payment-entrypoint; SumUp is nog niet technisch gekoppeld.
- CASH en BANK_TRANSFER vereisen een expliciete staff-bevestiging; een bankoverschrijving wordt nooit automatisch betaald verklaard.
- Handmatige betalingen bewaren nu expliciet `confirmedById`, `confirmedAt`, bedrag/methode en bij CASH optioneel ontvangen bedrag en wisselgeld, naast de bestaande provider-metadata.
- Ontvangen bedrag minus wisselgeld moet exact het server-side ordertotaal opleveren. Clientdata bepaalt geen verkoopprijs of betaalbedrag.

## Factuur en garantie

- De bestaande invoice-engine wordt in dezelfde completion-transactie gebruikt: automatisch nummer, immutable snapshots en één normale factuur per order. PDF-generatie blijft best-effort ná commit en de bestaande download-/mailflow blijft herbruikbaar.
- Warranty-records worden bij verkoop aangemaakt voor fiets, accu en elektrisch systeem waar van toepassing. Duur en voorwaarden zijn de sale-time snapshot; accugarantie kan per fiets afwijken.

## Migratie

`prisma/migrations/20260903000000_p1d_manual_payment_receipts/migration.sql`

Voegt expliciete handmatige-bevestigingsvelden en de relatie naar de bevestigende medewerker toe aan `Payment`.

## Concurrency en audit

- De order wordt conditioneel van `PENDING` naar `PAID` geclaimd.
- Iedere fiets wordt conditioneel van `RESERVED` naar `SALE_PENDING` en vervolgens alleen met de eigen actieve reservering naar `SOLD` gebracht.
- Dubbele completion, late payment en ontbrekende reserveringen gaan naar veilige review/geen verkoop.
- Sale-, bike-, payment- en invoice-events blijven geaudit.

## Tests en controles

- De centrale sale-test controleert nu expliciet de conditionele `RESERVED → SALE_PENDING → SOLD`-stappen.
- Prisma validate, typecheck, tests, lint en productiebuild zijn uitgevoerd.

## P1-E

- SumUp-terminaladapter, terminal-events en settlement/reconciliatie.
- Bedieningsscherm voor kassa-/bankbevestiging (de veilige serverbasis bestaat al).
