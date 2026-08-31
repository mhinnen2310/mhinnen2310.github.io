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

## Dashboard- en navigatie-update (31 augustus 2026)

- Het startscherm volgt nu de goedgekeurde Demi Fietsen-huisstijl: diepgroene
  actiekaart, gebroken witte achtergrond, begroeting met datum, open acties en
  een compacte voorraad-/werkplaatsweergave.
- De oude paarse shell en de oude uitlegtekst zijn uit het hoofdscherm verwijderd.
  Dashboard en meldingen laden automatisch bij openen, verversen periodiek en
  ondersteunen swipe-to-refresh.
- De losse onderste navigatieknoppen zijn vervangen door één brede knop
  **Menu**. De dropdown bevat alle bestaande schermen en Uitloggen, zodat geen
  route verloren gaat en het scherm compact blijft.
- De brede menuknop houdt rekening met de Android-navigatie-/gesture-inset en
  valt daardoor niet meer onder de systeemnavigatiebalk.
- Voorraad gebruikt nu dossierkaarten met fietsnummer, merk/model, prijs en
  een kleurgecodeerde statuschip, plus zoeken en een server-gevalideerd
  statusfilter. De oude vlakke/chat-achtige lijst is verwijderd.
- Nieuwe fiets innemen is opgesplitst in inklapbare **Basisgegevens**-,
  **Inkoop**- en **Intakecheck**-secties. Aanwezigheid, gebreken en
  diefstalcontrole worden met duidelijke Ja/Nee-dropdowns vastgelegd en na
  aanmaken via de bestaande intake-adapter opgeslagen.
- Werkplaats toont per geselecteerd fietsdossier de volledige checklist met
  dropdowns voor Goed, Aandacht nodig, Afkeur en Niet van toepassing. Losse
  werkzaamheden hebben aparte velden voor onderdeelprijs in centen,
  arbeidstijd in minuten en interne opmerkingen.
- Het fietsdossier zelf gebruikt dezelfde inklapbare secties voor basisdata,
  intake, inspectie en foto's; elke wijziging blijft via de bestaande
  servervalidatie en auditlogica lopen.
- De begroeting gebruikt de naam uit het server-loginantwoord wanneer die
  beschikbaar is; de naam wordt bij uitloggen samen met tokens gewist.
- Mobiele inventarisfilters accepteren alleen echte `BikeStatus`-waarden. Een
  onbekende status geeft een veilige 400 in plaats van een Prisma-fout.
- De voorraadweergave heeft aparte tabs **In voorraad** en **Verkocht**. De
  actieve tab sluit `SOLD` en `ARCHIVED` server-side uit; de verkochte tab
  vraagt uitsluitend die statussen op. Daardoor blijven verkochte fietsen ook
  bij grotere voorraden uit de actieve lijst en is de scheiding niet alleen
  cosmetisch.
- Vrijgeven vanuit web- of mobiele reserveringsdetails is gekoppeld aan het
  exacte reserverings-ID. Daardoor kan een gelijktijdige of oudere actieve regel
  niet per ongeluk worden vrijgegeven.
- Mobiele foutantwoorden geven alleen expliciet als veilig gemarkeerde
  domeinmeldingen terug; onbekende database/providerfouten blijven intern en
  krijgen een generieke melding.

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
- `:app:assembleDebug` is succesvol uitgevoerd op 31 augustus 2026. De APK is
  daarna met succes op de lokale Pixel 9-emulator geïnstalleerd en gestart.
- Na de intake-/werkplaats- en voorraad-UI-update is opnieuw
  `:app:assembleDebug` uitgevoerd en is de nieuwe APK op de Pixel 9-emulator
  geïnstalleerd.
- `npm run lint`, `npm run typecheck` en `npm test` zijn succesvol: 20
  testbestanden en 58 tests groen, inclusief de reserverings-ID- en veilige
  mobiele-foutrespons-regressietests.
- `npm run build` is succesvol. De lokale build meldt alleen de bekende
  database-waarschuwingen omdat de ontwikkel-Postgres niet draait; de pagina's
  vallen gecontroleerd terug en de build voltooit.
- `git diff --check` is schoon; de melding over Prisma betreft uitsluitend de
  Windows-regelafbreking van een bestaand bestand.
