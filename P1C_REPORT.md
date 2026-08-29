# P1-C report — permanente QR asset-tags

## Databasewijzigingen

- Nieuwe `QrBatch`- en `QrTag`-modellen, plus `QrTagStatus` (`UNUSED`, `BOUND`, `RETIRED`).
- `QrTag.serialNumber`, `displayCode`, `secureToken` en de optionele `bikeId` zijn uniek. Daardoor kan een nummer/token nooit dubbel bestaan en kan één fiets niet twee actieve permanente tags krijgen.
- Migratie: `prisma/migrations/20260902000000_p1c_qr_asset_tags/migration.sql`.

## Nummering en tokens

- De zichtbare code is `DF-` plus zes cijfers, bijvoorbeeld `DF-002481`.
- Een transactionele `NumberCounter` reserveert een volledig blok nummers via atomaire increment; er is geen `MAX() + 1`-race.
- Iedere URL gebruikt daarnaast een cryptografische 256-bit `randomBytes` token in base64url. De QR-payload is permanent `/q/<secureToken>` en is niet afleidbaar uit de display-code.

## Batches en print

- Beheer kan 1–500 labels aanmaken met 10 of 15 labels per A4.
- Het volledige batchrecord plus alle tags wordt in één serializable transactie aangemaakt; een fout commit geen halve batch.
- PDFKit bouwt iedere download opnieuw, deterministisch uit opgeslagen display-codes/tokens. Herprinten maakt dus geen nieuwe tags.
- De A4-layout is 2×5 of 3×5; elk label bevat merknaam, QR met quiet zone en leesbare DF-code.

## Bindingregels en security

- Alleen staff kan een ongebruikte tag aan een bestaande fiets koppelen. Die mutatie is conditioneel op `UNUSED` en gebeurt transactioneel.
- Gebonden tags keren nooit terug naar `UNUSED`; verkoop wijzigt de binding niet.
- Correctie is een afzonderlijke admin-only route met verplichte reden en audit-event; het is geen algemene unbind/reuse-functie.
- Intrekken is admin-only en alleen voor ongebruikte tags.
- Audit-events: `QR_BATCH_CREATED`, `QR_TAG_BOUND`, `QR_TAG_BINDING_CORRECTED`, `QR_TAG_RETIRED`.
- De publieke resolver selecteert uitsluitend status/code en een minimale fietsverwijzing. Ongekoppelde en niet-publieke fietsen geven een neutrale reactie; inkoop-, kost-, werkplaats-, medewerker- en auditdata verlaten de server niet.

## Interface

- Nieuwe beheerpagina: `/admin/qr-labels`, met voorraadstanden, lage-voorraadindicatie (drempel 25), batchgeneratie, zoeken/filteren en herprint-links.
- Detailpagina per tag ondersteunt binding via inventarisnummer.
- `/q/<token>` toont voor bezoekers een neutrale of publieke fietsweergave; staff krijgt snelle dossier-/koppelacties.

## Tests en controles

- Nieuwe unit-tests voor displaycode, 100 unieke opaque tokens, zoeknormalisatie en PDF-paginering (15, 16, 30, 100 labels).
- Prisma-validatie, typecheck, lint en alle 43 tests zijn geslaagd.

## Bekende beperkingen / P1-F

- De explicitie admin-correctieroute is aanwezig; een ergonomisch correctie-/retire-paneel in de tagdetailpagina kan met Android-ondersteuning in P1-F worden toegevoegd.
- De testset is unitgericht. Voor livegang hoort een PostgreSQL-integratietest voor gelijktijdige batchcreatie/binding en een fysieke stickerprinter-scancheck in staging erbij.
- De PDF wordt on-demand gegenereerd en niet opgeslagen; dit is bewust zodat reprints exact uit de persistente tags komen zonder opslagretentieprobleem.
