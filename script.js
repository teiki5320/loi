/*************************************************
 * Lois -- cartes + remplacement des auteurs (PA/PO)
 * Ingrédients :
 *   - ./lois/lois.json
 *   - ./deputes/deputes.json            (map PA → Nom)
 *   - ./organes_map.json  (optionnel)   (map PO → {nom, sigle})
 *************************************************/

const URL_LOIS     = "./lois/lois.json";
const URL_DEPUTES  = "./deputes/deputes.json";
const URL_ORGANES1 = "./organes_map.json";   // selon ton workflow
const URL_ORGANES2 = "./organes/organes_map.json"; // fallback si rangé ailleurs

// DOM
const $ = (s) => document.querySelector(s);
const el = {
  grid:   $("#lois"),
  search: $("#search"),
};

// stockages
let LOIS = [];
const MAP_PA = Object.create(null);   // { "PA4100": "Nom Prénom" }
const MAP_PO = Object.create(null);   // { "PO845485": {nom, sigle} }

// utils
const esc = s => (s ?? "").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const includesQ = (val, q) => (val||"").toLowerCase().includes(q);

// --- charge organes_map.json si présent (optionnel) ---
async function tryLoadOrganes() {
  // essaie chemin 1 puis 2 ; si erreur → ignorer
  for (const u of [URL_ORGANES1, URL_ORGANES2]) {
    try {
      const r = await fetch(u, { cache: "no-cache" });
      if (!r.ok) continue;
      const data = await r.json();
      Object.entries(data || {}).forEach(([po, obj]) => { MAP_PO[po] = obj; });
      return; // chargé
    } catch {}
  }
}

// --- traduit une chaîne "auteur" en libellé humain ---
function normalizeAuteurs(auteur) {
  if (!auteur) return "";
  // extrait tous les tokens style PA/PO + digits
  const tokens = String(auteur).match(/\bP[AO]\d+\b/g) || [];
  if (tokens.length === 0) return auteur; // rien à mapper

  const labels = tokens.map(code => {
    if (code.startsWith("PA") && MAP_PA[code]) {
      return MAP_PA[code];
    }
    if (code.startsWith("PO") && MAP_PO[code]) {
      const { sigle, nom } = MAP_PO[code];
      // Affiche le sigle s’il existe, sinon le nom complet
      return sigle ? `${sigle} -- ${nom}` : (nom || code);
    }
    return code; // inconnu, on garde le code
  });

  // déduplique et recombine proprement
  const uniq = [...new Set(labels)];
  return uniq.join(", ");
}

// --- rendu des cartes ---
function render() {
  if (!el.grid) return;
  const q = (el.search?.value || "").trim().toLowerCase();

  const list = LOIS.filter(l =>
    !q ||
    includesQ(l.titre, q) ||
    includesQ(l.type, q)  ||
    includesQ(l.auteurNom, q) ||
    includesQ(l.etat, q)
  );

  el.grid.innerHTML = list.map(l => `
    <div class="card">
      <h3 class="card-title" title="${esc(l.titre || "")}">${esc(l.titre || "Sans titre")}</h3>
      <p><b>Type :</b> ${esc(l.type || "")}</p>
      <p><b>Auteur :</b> ${esc(l.auteurNom || l.auteur || "--")}</p>
      ${l.date ? `<p><b>Date :</b> ${esc(l.date)}</p>` : ""}
      ${l.etat ? `<p><b>État :</b> ${esc(l.etat)}</p>` : ""}
      ${l.url  ? `<p><a href="${esc(l.url)}" target="_blank" rel="noopener">Voir le dossier</a></p>` : ""}
    </div>
  `).join("");
}

// --- init ---
(async function init() {
  try {
    // 1) charger députés → map PA
    const depRes = await fetch(URL_DEPUTES, { cache: "no-cache" });
    if (depRes.ok) {
      const deps = await depRes.json();
      (deps || []).forEach(d => { if (d?.id && d?.nom) MAP_PA[d.id] = d.nom; });
    }

    // 2) charger organes (optionnel)
    await tryLoadOrganes();

    // 3) charger lois
    const loisRes = await fetch(URL_LOIS, { cache: "no-cache" });
    if (!loisRes.ok) throw new Error(`Chargement lois.json: HTTP ${loisRes.status}`);
    LOIS = await loisRes.json();

    // 4) enrichir auteurs
    LOIS.forEach(l => { l.auteurNom = normalizeAuteurs(l.auteur); });

    // 5) premier rendu + recherche live
    render();
    el.search && el.search.addEventListener("input", render);
  } catch (e) {
    console.error(e);
    if (el.grid) el.grid.innerHTML = `<p style="color:#c00">Erreur de chargement des données.</p>`;
  }
})();