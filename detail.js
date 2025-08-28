(() => {
  const $ = (s) => document.querySelector(s);
  const set = (sel, val, placeholder = "--") => {
    const el = $(sel);
    if (!el) return;
    el.textContent = (val == null || val === "") ? placeholder : val;
    el.classList.remove("skeleton");
    el.style.removeProperty("height");
  };

  const id = new URLSearchParams(location.search).get("id")?.toUpperCase();
  if (!id) {
    set("#title", "Loi introuvable");
    set("#subtitle", "");
    return;
  }

  async function fetchJSON(u) {
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function main() {
    try {
      // on lit le fichier généré par GitHub Actions
      const enriched = await fetch("./lois/lois_AI.json?v=" + Date.now()).then(r => r.json());
      const item = enriched.find(x => x.id === id);

      if (!item) throw new Error("Not found");

      // Remplissage du DOM
      set("#title", item.titre);
      const sub = [item.type，item.auteur，item.date].filter(Boolean).join(" • ");
      set("#subtitle", sub, "");

      // Résumé
      set("#resume", item.resume || "Résumé non disponible");

      // Impacts
      $("#impacts").innerHTML = item.impacts?.length
        ? item.impacts.map(x => `<li>${x}</li>`).join("")
        : `<li class="muted">--</li>`;

      // Statut, nature, dates
      set("#statut", item.etat);
      set("#nature", item.type);
      $("#dates").innerHTML = item.date
        ? `<li>${item.date}</li>`
        : `<li class="muted">--</li>`;

      // Lien officiel
      const a = $("#legifrance");
      a.href = item.url || "#";
      if (!item.url) {
        a.classList.add("muted");
        a.textContent = "Lien indisponible";
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    } catch (e) {
      console.error(e);
      set("#title", `Loi ${id}`);
      set("#resume", "Impossible de charger les données.");
      $("#impacts").innerHTML = `<li class="muted">--</li>`;
    }
  }

  main();
})();