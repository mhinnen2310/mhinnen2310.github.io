# P1-B report — Werkplaats en intake

## Gewijzigd

- `BikeIntake` legt de operationele intakecontrole per unieke fiets vast; commerciële inkoopgegevens blijven bewust op het centrale `Bike`-model.
- `ServiceTask` is uitgebreid met inspectiepunt, resultaat, onderdeel, aantal, kosten in centen, arbeid in minuten, interne foto's, uitvoerdatum en uitvoerende medewerker.
- Elke fiets krijgt één idempotent aangemaakte checklist met: voor-/achterrem, banden, wielen, balhoofd, lagers, aandrijving, versnellingen, verlichting, motor, display, accu en lader.
- Werkplaatskosten worden uitsluitend bij afronden centraal en transactioneel naar `Bike.partsCostCents`, `repairCostCents` en `labourMinutes` geboekt. Heropenen draait dezelfde boeking éénmaal terug.
- Het accudossier onderscheidt nominale labelwaarden van gemeten Ah/Wh/SOH, met testdatum/-methode, cycli, revisie, garantie en een interne acculabelfoto.
- Het beheerdossier toont ontbrekende intake- en inspectiegegevens. De lifecycle is nu strikt `INTAKE → WORKSHOP → READY`; de server weigert `WORKSHOP` zonder complete intake en `READY` zonder complete inspectie.

## Waarom

Dit houdt het dossier van één fysiek fietsobject bij elkaar, voorkomt dubbele kostboeking bij gelijktijdige requests en blokkeert voortgang terwijl verplichte controles nog ontbreken.

## Migratie

- `prisma/migrations/20260901000000_p1b_workshop_intake/migration.sql`
- Voegt `InspectionResult`, `BikeIntake`, accumeetvelden en uitbreidingen voor `ServiceTask` toe.
- Bestaande `ServiceTask`-kosten worden als al geboekt gemarkeerd zodat de migratie geen historische kostprijzen dubbel optelt.

## Gevonden en verholpen risico's

- Intake kon direct naar `READY` worden gezet; dit omzeilde inspectie.
- Een checklist-item zou bij opnieuw aanmaken een unieke constraint raken; de centrale service werkt nu idempotent bij.
- Zonder conditionele boeking kon een dubbele afronding kosten dubbel tellen; `costAppliedAt` wordt transactioneel geclaimd.
- Heropenen liet eerder geboekte kosten achter; dit wordt nu symmetrisch teruggedraaid.

## Tests en controles

- 39 tests in 15 testbestanden geslaagd, inclusief nieuwe tests voor checklistdekking, centen/minuten-berekening en lifecycle.
- `npm run db:generate`, Prisma-validatie, typecheck, lint en productiebuild geslaagd.
- `git diff --check` geslaagd.

## Resterende risico's

- De migratie is aangemaakt maar niet tegen de productie-database uitgevoerd; pas die via de normale releaseprocedure toe en maak vooraf een back-up.
- Foto-opslag volgt de bestaande opslagabstractie; retentie/verwijdering van vervangen acculabels is een operationeel aandachtspunt.

## Naar P1 doorgeschoven

- Kassascherm, SumUp-terminalintegratie en een volledige handmatige betaalworkflow.
- Uitgebreide rapportage/planning voor werkplaatscapaciteit en onderdelenvoorraad.
