# Demi Fietsen — UI redesign concept

Dit is een los, interactief concept voor de website/beheeromgeving en de
Android-medewerkersapp. Het raakt geen productiecomponenten en gebruikt geen
framework of buildstap. Open `index.html` of `app.html` rechtstreeks in een
browser, of start lokaal:

```text
python -m http.server 4173 --directory concept-redesign
```

## Ontwerpkeuzes

- De startpagina beantwoordt eerst: **wat moet vandaag gebeuren?**
- Eén primaire actie per scherm; zelden meer dan vier keuzes tegelijk.
- De webshop blijft compact en commercieel; beheer en app krijgen grotere
  klikvlakken (minimaal 48 px) en meer witruimte waar dat fouten voorkomt.
- De gedeelde agenda heeft drie herkenbare soorten blokken: beschikbaar,
  afspraak en service/werkplaats.
- Een actie blijft zichtbaar totdat hij is opgelost; meldingen zijn niet alleen
  een rood bolletje.
- Geen icon-only knoppen, geen swipe-gebaren als enige bediening en altijd een
  tekstuele terugweg.

## Pagina’s in het concept

- `index.html`: website + eenvoudig beheer-dashboard, inclusief actie-inbox,
  voorraad, gedeelde agenda en klantoverzicht.
- `app.html`: Android-startscherm, QR-actie, intake, meldingen en instellingen.
- `styles.css`: gedeelde visuele taal; responsive en goed leesbaar op tablet.
- `script.js`: alleen prototypegedrag (tabbladen, filters, details en toggles).

## Naar echte schermen vertalen

1. Laat je vader eerst de twee prototypes gebruiken zonder uitleg. Noteer waar
   hij twijfelt of terug wil.
2. Kies daarna de vijf dagelijkse hoofdacties en houd die volgorde vast in web
   en app.
3. Bouw de bestaande routes stapsgewijs om met deze componenten; behoud de
   servervalidatie en permissies uit de productiecode.
4. Laat teksten, contrast en toetsenbordbediening controleren voordat de
   redesign-UI de huidige UI vervangt.
