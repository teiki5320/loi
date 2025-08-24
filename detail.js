// detail.js -- lit ?id=... puis affiche la fiche en appelant TON Worker
(() => {
  const $ = (s) => document.querySelector(s);
  const set = (sel, val, placeholder = "--") => {
    const el = $(sel); if (!el) return;
    el.textContent = (val == null || val === "") ? placeholder : val;
    // retire le squelette si présent
    el.classList.remove("skeleton");
    el.style.removeProperty("height");
  };

  const params = new URLSearchParams(location.search);
  const id = (params.get("id") || "").toUpperCase();

  // permet d'override l’API via ?api=... pour tester
  const apiOverride = params.get("api");
  const API = (apiOverride || window.API_BASE || "").replace(/\/$/,"");

  if (!id) {
    set("#title", "Loi introuvable");
    set("#subtitle", "");
    return;
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function normalize(item) {
    if (!item) return null;
    const idStr = String(item.ref || item.id || item.numero || item.code || item.reference || "").toUpperCase();
    return {
      id: idStr,
      titre: item.titre || item.intitule || "Sans titre",
      type:  item.type || item.nature || "",
      auteur:item.auteur || item.author || "",
      date:  item.date || item.dateEvenement || item.derniere_date || "",
      etat:  item.etat || item.statut || item.phase || "",
      url:   item.legifranceUrl || item.url || item.lien || ""
    };
  }

  async function loadFromWorker() {
    // Attendu côté Worker: /lois/:id -> { titre, type/nature, auteur, date, etat/statut, resume, impacts[], url/legifranceUrl, deputes[]?, dates[]? }
    const data = await fetchJSON(`${API}/lois/${encodeURIComponent(id)}`);
    const base = normalize(data);
    const resume  = data.resume || null;
    const impacts = Array.isArray(data.impacts) ? data.impacts : [];
    const deputes = Array.isArray(data.deputes) ? data.deputes : [];
    const dates   = Array.isArray(data.dates)   ? data.dates   : (base.date ? [base.date] : []);
    return { ...base, resume, impacts, deputes, dates };
  }

  async function loadFromLocalFallback() {
    // Fallback minimal en cas d’indispo Worker : on lit ./lois/lois.json
    const arr = await fetchJSON("./lois/lois.json?fallback=1");
    const list = Array.isArray(arr) ? arr : (arr.lois || arr.items || []);
    const found = list.find(x =>
      String(x.ref || x.id || x.numero || x.code || x.reference || "").toUpperCase() === id
    );
    const base = normalize(found) || { id, titre:`Loi ${id}` };
    return { ...base, resume: null, impacts: [], deputes: [], dates: base.date ? [base.date] : [] };
  }

  function render(d) {
    set("#title", d.titre);
    const sub = [d.type, d.auteur, d.date].filter(Boolean).join(" • ");
    set("#subtitle", sub, "");

    // Députés
    const dep = $("#deputes");
    dep.innerHTML = d.deputes?.length
      ? d.deputes.map(n => `<span class="chip">${n}</span>`).join("")
      : `<span class="muted">--</span>`;

    // Résumé
    set("#resume", d.resume || "Résumé en cours de génération…");

    // Impacts
    $("#impacts").innerHTML = d.impacts?.length
      ? d.impacts.map(x => `<li>${x}</li>`).join("")
      : `<li class="muted">En cours de génération…</li>`;

    // Statut / Nature / Dates
    set("#statut", d.etat);
    set("#nature", d.type);
    $("#dates").innerHTML = d.dates?.length
      ? d.dates.map(x => `<li>${x}</li>`).join("")
      : `<li class="muted">--</li>`;

    // Lien texte officiel
    const a = $("#legifrance");
    a.href = d.url || "#";
    if (!d.url) {
      a.classList.add("muted");
      a.textContent = "Lien indisponible";
      a.removeAttribute("target");
      a.removeAttribute("rel");
    }
  }

  (async function main(){
    try {
      const data = await loadFromWorker();
      render(data);
    } catch (e) {
      console.warn("Worker indisponible, fallback local.", e);
      try {
        const data = await loadFromLocalFallback();
        render(data);
      } catch (e2) {
        set("#title", `Loi ${id}`);
        set("#subtitle", "");
        set("#resume", "Impossible de charger les données.");
        $("#impacts").innerHTML = `<li class="muted">--</li>`;
      }
    }
  })();
})();