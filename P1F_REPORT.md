# P1-F report — Android-clientbasis

## Aangelegd

- Nieuw native Kotlin/Jetpack Compose-project onder `android/`.
- Medewerkersstartscherm met QR, nieuwe fiets, voorraad, werkplaats, verkoop,
  advertenties en reserveringen als toegangspunten.
- Camera- en internetpermissie en een Android App Link voor `/q/<token>`.
- Dunne OkHttp-clientadapter: de app stuurt uitsluitend geautoriseerde requests;
  prijs-, voorraad-, betalings- en verkoopregels blijven in de backend.
- Mobiele sessiegrondslag in Prisma (`MobileSession`) met opaque, gehashte
  access- en refresh-tokens, 15 minuten access-geldigheid, refreshrotatie,
  device-binding en sessierevocatie bij een replay of device-mismatch.
- Mobiele login- en refresh-routes: `/api/mobile/auth/login` en
  `/api/mobile/auth/refresh`, plus handset-specifiek uitloggen via
  `/api/mobile/auth/logout`.
- Login en refresh hebben database-backed rate limiting, privacyvriendelijke
  IP-audit en auditregels voor inloggen, vernieuwen en uitloggen.
- Mobiele adapters hergebruiken de centrale domeinfuncties voor QR-binding,
  fietsintake, fotoverwerking, ServiceTasks, verkoopstart en CASH/BANK
  completion. De app kan geen prijs, status of betaalbedrag als waarheid
  aanleveren.
- Centrale medewerker-verkoopstart reserveert elk fysiek exemplaar conditioneel
  met de actuele serverprijs en tax-snapshot. De bestaande atomaire
  `confirmManualPayment` flow blijft de enige route naar `SOLD`, factuur,
  garantie en audit.
- Android gebruikt de website-identiteit: diepgroen, warm gebroken wit, donkere
  inkt en gedempte statuskleuren in plaats van het standaardpaarse Compose-thema.
- Werkende login, voorraadophaalactie, QR-camera/ML Kit-resolving, basisintake,
  werkplaatsregel en CASH-verkoopstart in de client.
- Lokale app-lock: een PBKDF2-gehashte, zes-cijferige pincode in versleutelde
  opslag; lock na app-achtergrond en biometrische ontgrendeling wanneer het
  toestel een sterke vingerafdruk heeft ingesteld.
- Java- en Kotlin-bytecode-targets zijn expliciet op Java 17 vastgezet, zodat de
  app ook vanaf de door Android Studio meegeleverde nieuwere JDK betrouwbaar kan
  bouwen.

## Migrations

- `20260904000000_p1f_mobile_sessions`: maakt `MobileSession` met de benodigde
  unieke token-hashes, expiratietijden, device-hash en relatiereferentie naar
  `User`.

## APK

- Debug-APK is gebouwd en lokaal beschikbaar als
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- Dit bestand is voor interne testinstallatie geschikt, maar is geen definitieve
  distributierelease: een release-APK moet met een beheerde, blijvende signing
  key worden ondertekend. Die sleutel hoort niet ad-hoc in de repository of in
  broncode te worden gemaakt/opgeslagen.

## Nog niet als afgerond claimen

- Foto-opname/-upload is server-side beschikbaar, maar de Android cameragalerij
  UI voor intakefoto's is nog niet toegevoegd.
- De advertentie- en reserveringsknoppen zijn nog geen mobiele workflows; er
  zijn bewust geen halfveilige mutatie-endpoints voor toegevoegd.
- SumUp blijft, conform P1-D/P1-F-afbakening, een backendgestuurde integratie en
  is niet in de Android-client geïmplementeerd.
- Offlinewerking is nu alleen heldere foutfeedback; er is bewust geen offline
  schrijfqueue die bedrijfsregels zou kunnen omzeilen.

## Validatie

- Android SDK Platform 35 is opnieuw geïnstalleerd en gecontroleerd op
  `android.jar`.
- `:app:assembleDebug` is succesvol uitgevoerd op 30 augustus 2026.
- `npm run typecheck` en `npm test`: 48 tests geslaagd, waaronder nieuwe
  mobiele sessie-/rotatie-/revocatietests.
- `git diff --check` is schoon; de melding over Prisma betreft uitsluitend de
  Windows-regelafbreking van een bestaand bestand.
