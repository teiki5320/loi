/*************************************************
 * Lois – liste + extrait IA
 * Source : lois.json + deputes.json + groupes.json + lois_AI.json
 * - Cartes cliquables (délégation)
 * - Auteurs lisibles (député/groupe)
 * - Extrait IA sous Date & État
 *************************************************/

const URL_LOIS     = "./lois/lois.json";
const URL_LOIS_AI  = "./lois/lois_AI.json";
const URL_DEPUTES  = "./deputes/deputes.json";
const URL_GROUPES  = "./deputes/groupes.json";

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("lois"),
  err:    document.getElementById("err"),
};

let LOIS = [];
let MAP_DEPUTES = {}; // { PAxxxx -> "Nom Député" }
let MAP_GROUPES = {}; // { POxxxxx -> "SIGLE -- Libellé" }
let MAP_AI = {};      // { ID -> { resume, impacts[] } }

/* ---------- Utils ---------- */
const esc = (s) =>
  (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function idOf(l) {
  return String(l?.ref || l?.id || l?.numero || l?.code || l?.reference || "").toUpperCase();
}

function excerpt(txt, n = 160) {
  const s = (txt || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* ---------- Auteurs lisibles ---------- */
function formatAuteur(code) {
  if (!code) return "--";
  if (MAP_DEPUTES[code]) return MAP_DEPUTES[code];
  if (MAP_GROUPES[code]) return MAP_GROUPES[code];
  // si c'est un code PO inconnu, c'est parfois le Gouvernement
  if (/^PO\d{3,}$/.test(code)) return "Gouvernement";
  return code; // fallback
}

/* ---------- Chargements ---------- */
async function loadMaps() {
  // Députés
  try {
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`);
    if (r.ok) {
      const arr = await r.json();
      arr.forEach(d => {
        if (d.id && d.nom) MAP_DEPUTES[String(d.id)] = d.nom;
      });
    }
  } catch (e) { console.warn("Pas de mapping députés", e); }

  // Groupes
  try {
    const r = await fetch(`${URL_GROUPES}?v=${Date.now()}`);
    if (r.ok) {
      const arr = await r.json();
      arr.forEach(g => {
        if (g.code) {
          const label = g.sigle ? (g.libelle ? `${g.sigle} -- ${g.libelle}` : g.sigle)
                                : (g.libelle || g.code);
          MAP_GROUPES[String(g.code)] = label;
        }
      });
    }
  } catch (e) { console.warn("Pas de mapping groupes", e); }
}

async function loadLois() {
  const r = await fetch(`${URL_LOIS}?v=${Date.now()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  LOIS = Array.isArray(data) ? data : (data.lois || data.items || []);
}

async function loadAI() {
  try {
    const r = await fetch(`${URL_LOIS_AI}?v=${Date.now()}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json();
    MAP_AI = {};
    (Array.isArray(arr) ? arr : []).forEach(item => {
      const id = String(item.id || "").toUpperCase();
      if (!id) return;
      MAP_AI[id] = { resume: item.resume || "", impacts: item.impacts || [] };
    });
  } catch (e) {
    console.warn("Pas de lois_AI.json (extraits IA désactivés).", e);
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

/* ---------- Délégation : carte cliquable ---------- */
if (els.grid) {
  els.grid.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) return; // clic lien = normal
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
    await Promise.all([loadMaps(), loadLois(), loadAI()]);
    render();
  } catch (e) {
    if (els.err) els.err.textContent = `Erreur de chargement des lois.\n${e?.message || e}`;
    console.error(e);
  }
})();

els.search && els.search.addEventListener("input", render);

/* ---------- (Optionnel) outil debug pour trouver les auteurs inconnus ---------- */
window.listUnknownAuthors = function(){
  const unknown = new Set();
  LOIS.forEach(l => {
    const a = l.auteur;
    if (!a) return;
    if (!(MAP_DEPUTES[a] || MAP_GROUPES[a])) unknown.add(a);
  });
  console.table([...unknown].map(x => ({ code: x })));
  return [...unknown];
};