/*************************************************
 * Lois (page d’accueil)
 * - Charge le JSON des lois
 * - Essaie de traduire l’ID auteur (PA…/PO…) en nom
 *   grâce au fichier /deputes/deputes.json
 *************************************************/

const URL_LOIS     = "https://teiki5320.github.io/loi/lois/lois.json";
const URL_DEPUTES  = "https://teiki5320.github.io/loi/deputes/deputes.json";

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("lois"),
  err:    document.getElementById("err"),
};

let LOIS = [];               // [{ id,titre,type,auteur,url,nor*,date,etat }, ...]
let AUTEUR_MAP = Object.create(null); // { "PA1234": "Prénom NOM", ... }

/* Utils */
const esc = s => (s ?? "").toString().replace(/[&<>"]/g,
  m => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[m])
);

/* Essaie de résoudre un code auteur.
   - PAxxxxx  -> nom trouvé dans deputes.json (si présent)
   - sinon renvoie le code tel quel */
function formatAuteur(code) {
  if (!code) return "--";
  const name = AUTEUR_MAP[code];
  return name ? `${name}` : code;
}

/* Rendu des cartes */
function render() {
  if (!els.grid) return;

  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = LOIS.filter(l => {
    if (!q) return true;
    return [
      l.titre, l.type, l.etat,
      formatAuteur(l.auteur)
    ].some(v => (v || "").toLowerCase().includes(q));
  });

  els.grid.innerHTML = filtered.map(l => {
    // nettoyage/fallbacks
    const titre = esc(l.titre || "Sans titre");
    const type  = esc(l.type  || "--");
    const etat  = esc(l.etat  || "--");
    const date  = esc(l.date  || "--");
    const auteurTxt = esc(formatAuteur(l.auteur));
    const url   = l.url || "#";

    return `
      <article class="card">
        <h3 class="card-title">${titre}</h3>
        <p><strong>Type :</strong> ${type}</p>
        <p><strong>Auteur :</strong> ${auteurTxt}</p>
        <p><strong>Date :</strong> ${date}</p>
        <p><strong>État :</strong> ${etat}</p>
        <p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Voir le dossier</a></p>
      </article>
    `;
  }).join("");

  if (!filtered.length) {
    els.grid.innerHTML = `<p style="opacity:.7">Aucun résultat.</p>`;
  }
}

/* Chargement auteurs (députés) -> map {id -> nom} */
async function loadAuteursMap() {
  try {
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json(); // [{id, nom, ...}, ...]
    // Certains jeux peuvent avoir des entrées vides : filtrer
    (arr || []).forEach(d => {
      const id = d?.id;
      const nom = d?.nom;
      if (id && nom) AUTEUR_MAP[id] = nom;
    });
    // petit log de contrôle
    console.log("AUTEUR_MAP size:", Object.keys(AUTEUR_MAP).length);
  } catch (e) {
    console.warn("Impossible de charger la table auteurs (députés).", e);
  }
}

/* Chargement des lois */
async function loadLois() {
  const r = await fetch(`${URL_LOIS}?v=${Date.now()}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arr = await r.json();

  // Format attendu : tableau d'objets.
  // Si ce n’est pas le cas, on essaye de deviner.
  LOIS = Array.isArray(arr) ? arr : [];
  console.log("Lois chargées:", LOIS.length);
}

/* Init */
(async function init() {
  try {
    // Charger en parallèle
    await Promise.all([loadLois(), loadAuteursMap()]);
    render();
  } catch (e) {
    els.err.textContent = `Erreur de chargement des lois.\n${e?.message || e}`;
    console.error(e);
  }
})();

/* Recherche */
els.search && els.search.addEventListener("input", render);