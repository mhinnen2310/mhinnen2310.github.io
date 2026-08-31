(() => {
  const modalCopy = {
    actions: { kicker: "Actie vereist", title: "Eén lijst, rustig afwerken", body: "<p>2 reserveringen verlopen</p><p>1 betaling controleren</p><p>2 werkplaatsfietsen incompleet</p><p class=\"muted\">In de echte app opent elke regel direct de juiste detailpagina.</p>" },
    reservation: { kicker: "Reservering", title: "Reservering van mevrouw De Vries", body: "<p><strong>Gazelle Ultimate C8 · DF-000974</strong></p><p>Verloopt vandaag om 16:30. Bel de klant of geef de fiets vrij.</p>" },
    payment: { kicker: "Betaling controleren", title: "Order DF-2026-0142", body: "<p><strong>€ 1.499 · Mollie: betaald</strong></p><p>De reservering is verlopen. Controleer eerst de order en kies daarna één duidelijke oplossing.</p>" },
    workshop: { kicker: "Service / werkplaats", title: "DF-000974 — remmen controleren", body: "<p>Open taak: achterrem afstellen en proefrit uitvoeren.</p><p class=\"muted\">De status staat na opslaan meteen in de gedeelde agenda.</p>" },
    availability: { kicker: "Beschikbaarheid", title: "Vrij blok om 09:00", body: "<p>Dit blok is beschikbaar voor een proefrit of klantafspraak.</p><p class=\"muted\">Beschikbaarheidsregels worden centraal beheerd.</p>" },
    appointment: { kicker: "Afspraak", title: "Marianne de Vries · 11:30", body: "<p><strong>Proefrit Gazelle Ultimate C8</strong></p><p>06 12 34 56 78 · marianne@example.nl</p>" },
    bike: { kicker: "Fietsdossier", title: "Gazelle Ultimate C8", body: "<p><strong>DF-000974 · beschikbaar · € 1.499</strong></p><p>Open foto’s, intake, service, marge of de QR-koppeling vanuit één dossier.</p>" },
    customer: { kicker: "Klantdossier", title: "Marianne de Vries", body: "<p>Gazelle Ultimate C8 · gekocht 12 augustus 2026</p><p>Factuur, garantie, serviceverzoeken en contactgegevens staan hier samen.</p>" },
    notifications: { kicker: "Meldingen", title: "Welke meldingen wil je krijgen?", body: "<p><label class=\"demo-toggle\"><input type=\"checkbox\" checked> Verkopen en betalingen</label></p><p><label class=\"demo-toggle\"><input type=\"checkbox\" checked> Lage voorraad en oude fietsen</label></p><p><label class=\"demo-toggle\"><input type=\"checkbox\"> Afspraken en service</label></p>" },
    website: { kicker: "Websitebeheer", title: "Tekst direct aanpassen", body: "<p>Pas homepage, garantie, bezorgen, proefrit en CTA’s aan. Elke opslag maakt automatisch een versie die je kunt terugzetten.</p>" },
    users: { kicker: "Accounts", title: "Personeel en rollen", body: "<p><strong>Jan · eigenaar</strong></p><p>Medewerkers kunnen operationele acties uitvoeren; klanten zien alleen hun eigen dossier.</p>" },
    settings: { kicker: "Instellingen", title: "App-instellingen", body: "<p>Wijzig pincode, zet biometrie aan en kies per onderwerp welke pushmeldingen je ontvangt.</p>" },
    scan: { kicker: "QR scannen", title: "Richt de camera op het label", body: "<p>Na het scannen opent direct het juiste fietsdossier. De server controleert de code opnieuw.</p>" },
    "new-bike": { kicker: "Intake", title: "Nieuwe fiets innemen", body: "<p>Volg de vaste checklist: framenummer, sleutels, lader, accu, diefstalcontrole en foto’s.</p>" },
    profile: { kicker: "Profiel", title: "Jan van Demi Fietsen", body: "<p>Eigenaar · laatste synchronisatie zojuist</p>" },
    help: { kicker: "Uitleg", title: "Zo werkt dit scherm", body: "<p>Begin bovenaan met Actie vereist. De vier knoppen eronder zijn de meest gebruikte handelingen. Alles overige staat in de navigatie.</p>" },
    home: { kicker: "Vandaag", title: "Je bent al op Vandaag", body: "<p>Hier staan de belangrijkste acties en de eerstvolgende afspraken.</p>" },
    inventory: { kicker: "Voorraad", title: "Voorraad openen", body: "<p>Zoek op merk, model of DF-nummer. Filter daarna op de status.</p>" },
    agenda: { kicker: "Agenda", title: "Gedeelde agenda", body: "<p>Groen = beschikbaar, blauw = afspraak, amber = service/werkplaats.</p>" },
  };

  const backdrop = document.querySelector(".modal-backdrop");
  const title = backdrop?.querySelector("[data-modal-title]");
  const kicker = backdrop?.querySelector("[data-modal-kicker]");
  const copy = backdrop?.querySelector("[data-modal-copy]");
  const close = () => { if (backdrop) backdrop.hidden = true; };
  const open = (name) => {
    const item = modalCopy[name] || modalCopy.actions;
    if (!backdrop || !title || !kicker || !copy) return;
    kicker.textContent = item.kicker; title.textContent = item.title; copy.innerHTML = item.body; backdrop.hidden = false;
    backdrop.querySelector("[data-modal-confirm]")?.focus();
  };
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-modal]");
    if (target) { event.preventDefault(); open(target.dataset.modal); return; }
    const viewTarget = event.target.closest("[data-view-target]");
    if (viewTarget) { const view = viewTarget.dataset.viewTarget; document.querySelector(`[data-view=\"${view}\"]`)?.click(); return; }
    if (event.target.closest("[data-modal-close]") || event.target === backdrop) close();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  document.querySelectorAll("[data-view]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault(); const view = link.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === link));
    document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === view));
    document.querySelector("[data-menu]")?.classList.remove("is-open"); window.history.replaceState(null, "", `#${view}`);
  }));
  document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => document.querySelector("[data-menu]")?.classList.toggle("is-open"));
  const filterInput = document.querySelector("[data-filter-input]");
  const filterSelect = document.querySelector("[data-filter-select]");
  const rows = [...document.querySelectorAll("[data-filter-list] [data-filter]")];
  const empty = document.querySelector("[data-empty]");
  const filter = () => {
    const query = (filterInput?.value || "").trim().toLowerCase(); const status = filterSelect?.value || "all"; let visible = 0;
    rows.forEach((row) => { const text = row.dataset.filter || ""; const matchesText = !query || text.includes(query); const matchesStatus = status === "all" || text.includes(status); row.hidden = !(matchesText && matchesStatus); if (!row.hidden) visible++; });
    if (empty) empty.hidden = visible !== 0;
  };
  filterInput?.addEventListener("input", filter); filterSelect?.addEventListener("change", filter);
  const initial = location.hash.slice(1); if (initial && document.querySelector(`[data-view=\"${initial}\"]`)) document.querySelector(`[data-view=\"${initial}\"]`).click();
})();
