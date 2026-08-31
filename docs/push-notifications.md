# Pushmeldingen lokaal testen

De app heeft nu een echte Firebase Cloud Messaging-keten. De server bewaart
FCM-tokens versleuteld, koppelt ze aan het ingelogde personeelsaccount en
respecteert de categorieën die in **Instellingen → Meldingen** zijn gekozen.
De categorieën zijn verkopen, voorraad, reserveringen, betalingen, werkplaats,
nieuwe serviceverzoeken en nieuwe afspraken.
Een onderhoudsrun vergelijkt de actuele operationele toestand met de vorige
toestand. Daardoor komt een ongewijzigde melding niet iedere minuut opnieuw
binnen.

## Eenmalig Firebase instellen

1. Maak in Firebase een project en registreer een Android-app met package
   `nl.demifietsen.staff`.
2. Voeg de debug- en release-SHA-256-certificaten toe. Je kunt de debugwaarde
   met `android/gradlew.bat signingReport` opvragen.
3. Download `google-services.json` en plaats die lokaal op
   `android/app/google-services.json`. Dit bestand staat bewust in `.gitignore`.
   De Gradle-plugin wordt alleen geactiveerd wanneer dit echte bestand bestaat.
4. Maak voor de server een Firebase service account met FCM-rechten. Zet de
   volgende waarden als server-only environment variables (nooit in Git):
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` en `FIREBASE_PRIVATE_KEY`.
   Bewaar de private key als één regel met `\\n` tussen de regels.

## Server en cron

Voer de nieuwe Prisma-migratie uit:

```text
npm run db:deploy
```

Plan daarna iedere minuut tot vijf minuten één van deze endpoints met de
`CRON_SECRET`:

```text
POST /api/maintenance/push-notifications
POST /api/maintenance/sweep
```

De sweep doet beide: eerst de meldingstoestand bepalen, daarna verlopen
checkout-reserveringen opruimen. Het push-endpoint is handig wanneer je de
sweep al ergens anders uitvoert.

## Lokale Docker-test

Start de lokale stack met:

```text
docker compose -f docker-compose.local.yml up --build
```

De debug-APK gebruikt standaard `http://10.0.2.2:3001`, de Android-emulator-
alias voor de Docker-app op je computer. Voor een fysieke telefoon geef je bij
het bouwen het LAN-adres van je computer mee, bijvoorbeeld:

```text
android/gradlew.bat -PapiBaseUrl=http://192.168.1.20:3001 :app:assembleDebug
```

Zorg dat telefoon en computer op hetzelfde netwerk zitten en dat poort 3001
bereikbaar is.

Zonder Firebase-omgeving blijft de in-app polling werken en meldt het
onderhoudsendpoint `configured: false`; er worden dan geen externe pushes
verstuurd. Voor een echte push-test geef je de drie Firebase-variabelen mee
aan Compose en installeer je `google-services.json` voordat je de debug-APK
bouwt:

```text
docker compose -f docker-compose.local.yml up --build
```

Open de app, geef Android-meldingsrechten, log in met een staff-account en
controleer onder Instellingen de categorieën. Gebruik daar ook **Test
pushmelding** om één bericht naar het huidige toestel te sturen. Maak daarna
in de beheerdata een verkoop, lage voorraad of handmatige betaalreview aan en
roep het endpoint aan met de cron-secret.
