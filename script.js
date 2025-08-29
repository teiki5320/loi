/*************************************************
 * Lois – liste
 * Source : lois.json + deputes.json + (groupes.json via data.gouv.fr) + lois_AI.json
 * - Auteurs lisibles (PA… / PO… via an_actors.json en priorité)
 * - Mini-résumé IA sous les cases Date & État
 * - Cartes cliquables vers detail.html?id=…
 * - Barre de recherche (titre, type, état, auteur)
 *************************************************/

const URL_LOIS     = "./lois/lois.json";
const URL_LOIS_AI  = "./lois/lois_AI.json";
const URL_DEPUTES  = "./deputes/deputes.json";
const URL_GROUPES  = "./deputes/groupes.json"; // format officiel data.gouv.fr (id/libelleAbrev/libelle)
// ★ NEW: mapping global PA/PO (députés, sénat, AN, groupes, etc.)
const URL_ACTEURS  = "./data/an_actors.json";

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("lois"),
  err:    document.getElementById("err"),
};

let LOIS = [];
let MAP_DEPUTES = {}; // { PAxxxxx -> "Nom Député" }
let MAP_GROUPES = {}; // { POxxxxx -> "SIGLE -- Libellé" }
let MAP_AI      = {}; // { ID -> { resume, impacts[] } }
// ★ NEW
let MAP_ACTEURS = {}; // { CODE -> "Nom lisible" }

/* ---------- Utils ---------- */
const esc = (s) =>
  (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function idOf(l){
  return String(
    l?.ref ||
    l?.cid ||
    l?.dossierLegislatifRef ||
    l?.reference ||
    l?.id ||
    l?.numero ||
    l?.code
  ).toUpperCase();
}

function excerpt(txt, n = 160) {
  const s = (txt || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ★ CHANGED: on regarde d’abord dans MAP_ACTEURS (PA/PO consolidé)
function formatAuteur(code){
  if (!code) return "--";
  const key = String(code).toUpperCase();
  if (MAP_ACTEURS[key]) return MAP_ACTEURS[key];       // priorité absolue
  if (MAP_DEPUTES[key]) return MAP_DEPUTES[key];       // compat
  if (MAP_GROUPES[key]) return MAP_GROUPES[key];       // compat
  // ancien fallback "tout PO = Gouvernement" supprimé pour éviter les erreurs
  return key; // on affiche le code si inconnu
}

/* ---------- Chargements ---------- */
async function loadMaps() {
  // Députés
  try {
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, {cache:"no-store"});
    if (r.ok) {
      const arr = await r.json();
      arr.forEach(d => {
        if (d.id && d.nom) MAP_DEPUTES[String(d.id).toUpperCase()] = d.nom;
      });
    }
  } catch (e) { console.warn("deputes.json KO", e); }

  // Groupes (format data.gouv.fr : { id, libelleAbrev, libelle, … })
  try {
    const r = await fetch(`${URL_GROUPES}?v=${Date.now()}`, {cache:"no-store"});
    if (r.ok) {
      const arr = await r.json();
      (Array.isArray(arr) ? arr : []).forEach(g => {
        const code = String(g.id || "").trim().toUpperCase();
        if (!code) return;
        const sigle   = (g.libelleAbrev || "").trim();
        const libelle = (g.libelle || "").trim();
        const label = sigle ? (libelle ? `${sigle} -- ${libelle}` : sigle)
                            : (libelle || code);
        MAP_GROUPES[code] = label;
      });
    }
  } catch (e) { console.warn("groupes.json KO", e); }
}

// ★ NEW: chargement du mapping consolidé PA/PO
async function loadActeurs(){
  try{
    const r = await fetch(`${URL_ACTEURS}?v=${Date.now()}`, {cache:"no-store"});
    if (r.ok) {
      const arr = await r.json();
      (Array.isArray(arr) ? arr : (arr.items || arr.data || []))
        .forEach(a => {
          const code = String(a?.code || "").toUpperCase();
          const nom  = String(a?.nom  || "").trim();
          if (code && nom) MAP_ACTEURS[code] = nom;
        });
    }
  }catch(e){
    console.warn("an_actors.json indisponible :", e);
  }
}

async function loadLois() {
  const r = await fetch(`${URL_LOIS}?v=${Date.now()}`, {cache:"no-store"});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  LOIS = Array.isArray(data) ? data : (data.lois || data.items || []);
}

async function loadAI() {
  try {
    const r = await fetch(`${URL_LOIS_AI}?v=${Date.now()}`, {cache:"no-store"});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json();
    MAP_AI = {};
    (Array.isArray(arr) ? arr : []).forEach(item => {
      const id = String(item.id || "").toUpperCase();
      if (!id) return;
      MAP_AI[id] = { resume: item.resume || "", impacts: item.impacts || [] };
    });
  } catch (e) {
    console.warn("lois_AI.json indisponible (extraits IA désactivés).", e);
    MAP_AI = {};
  }
}

/* ---------- Rendu ---------- */
function render() {
  if (!els.grid) return;
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = LOIS.filter(l => {
    if (!q) return true;
    return [
      l.titre, l.type, l.etat, formatAuteur(l.auteur)
    ].some(v => (v || "").toLowerCase().includes(q));
  });

  els.grid.innerHTML = filtered.map(l => {
    const titre  = esc(l.titre || "Sans titre");
    const type   = esc(l.type  || "--");
    const etat   = esc(l.etat  || "--");
    const date   = esc(l.date  || "--");
    const auteur = esc(formatAuteur(l.auteur));

    const id = idOf(l);
    const ai = MAP_AI[id];
    const resumeShort = ai && ai.resume ? esc(excerpt(ai.resume, 160)) : "";

    return `
      <article class="card" data-id="${esc(id)}" tabindex="0" aria-label="Voir le détail de ${titre}">
        <h3 class="card-title">${titre}</h3>

        <div class="infos">
          <p><strong class="k">Type</strong><span class="v">${type}</span></p>
          <p><strong class="k">Auteur</strong><span class="v">${auteur}</span></p>
          <p><strong class="k">Date</strong><span class="v">${date}</span></p>
          <p><strong class="k">État</strong><span class="v">${etat}</span></p>
        </div>

        ${ resumeShort ? `<p class="excerpt">${resumeShort}</p>` : "" }

        <p style="margin-top:auto;text-align:center">
          <a class="btn-detail" href="detail.html?id=${encodeURIComponent(id)}">Voir le détail</a>
        </p>
      </article>
    `;
  }).join("");

  if (!filtered.length) {
    els.grid.innerHTML = `<p style="opacity:.7">Aucun résultat.</p>`;
  }
}

/* ---------- Cartes cliquables ---------- */
if (els.grid) {
  els.grid.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) return;
    const card = e.target.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    if (id) location.href = `detail.html?id=${encodeURIComponent(id)}`;
  });

  els.grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    const id = card.dataset.id;
    if (id) location.href = `detail.html?id=${encodeURIComponent(id)}`;
  });
}

/* ---------- Init ---------- */
(async function init() {
  try {
    // ★ CHANGED: on charge d’abord le mapping global PA/PO
    await Promise.all([loadActeurs(), loadMaps(), loadLois(), loadAI()]);
    render();
  } catch (e) {
    if (els.err) els.err.textContent = `Erreur de chargement des lois.\n${e?.message || e}`;
    console.error(e);
  }
})();

els.search && els.search.addEventListener("input", render);

/* ---------- Outil debug : auteurs inconnus ---------- */
// ★ CHANGED: on check aussi le mapping global
window.listUnknownAuthors = function(){
  const unknown = new Set();
  LOIS.forEach(l => {
    const a = l.auteur;
    if (!a) return;
    const key = String(a).toUpperCase();
    if (!(MAP_ACTEURS[key] || MAP_DEPUTES[key] || MAP_GROUPES[key])) unknown.add(key);
  });
  console.table([...unknown].map(x => ({ code: x })));
  return [...unknown];
};