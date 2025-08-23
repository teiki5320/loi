/*************************************************
 * Lois -- rendu des cartes + mapping auteur -> nom
 * Emplacements attendus (depuis /loi/index.html) :
 *   - ./lois/lois.json
 *   - ./deputes/deputes.json
 *************************************************/

const URL_LOIS     = "./lois/lois.json";
const URL_DEPUTES  = "./deputes/deputes.json";

// -- DOM (on s’adapte aux noms déjà présents)
const el = {
  grid:   document.getElementById("grid") || document.getElementById("lois-grid") || document.querySelector("main"),
  q:      document.getElementById("q"),
  err:    document.getElementById("err"),
  count:  document.getElementById("count")
};

const showError = (msg, e) => {
  const txt = msg + (e ? " -- " + (e.message || e) : "");
  console.error(txt, e);
  if (el.err) el.err.textContent = txt;
};

const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

// -- petites utilitaires d’affichage
const fmt = {
  date: d => d ? new Date(d).toLocaleDateString("fr-FR") : "--",
  Etat: s => s || "--",
};

// -- Chargement JSON avec cache-bust et messages clairs
async function fetchJson(url) {
  const r = await fetch(url + "?v=" + Date.now(), { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
  return r.json();
}

let LOIS = [];
let MAP_DEPUTE_NOM = new Map(); // "PAxxxx" -> "Nom Prénom"

// -- rendu
function render() {
  if (!el.grid) return;

  const q = noDia(el.q?.value || "");

  let data = LOIS;
  if (q) {
    data = data.filter(d =>
      [d.titre, d.type, d.etat, d.auteurNom]
        .some(x => noDia(x).includes(q))
    );
  }

  el.grid.innerHTML = data.map(d => {
    const ligne1 = `
      <div class="law-card">
        <h3 class="law-title" title="${esc(d.titre)}">${esc(d.titre)}</h3>
        <div class="law-meta"><strong>Type :</strong> ${esc(d.type || "--")}</div>
        <div class="law-meta"><strong>Auteur :</strong> ${esc(d.auteurNom || d.auteur || "--")}</div>
        <div class="law-meta">
          <strong>Date :</strong> ${esc(fmt.date(d.date))} &nbsp;--&nbsp; <strong>État :</strong> ${esc(fmt.Etat(d.etat))}
        </div>
        ${d.url ? `<a class="law-link" href="${esc(d.url)}" target="_blank" rel="noopener">Voir le dossier</a>` : ""}
      </div>
    `;
    return ligne1;
  }).join("");

  if (el.count) el.count.textContent = `${data.length} dossier(s) affiché(s)`;
}

// -- init
(async function init(){
  try {
    // 1) Charger députés -> construire le map PAxxxx -> Nom
    const deputes = await fetchJson(URL_DEPUTES);
    // les clés possibles : id / uid / identifiant ; le workflow normalise en "id"
    deputes.forEach(d => {
      if (d && d.id && d.nom) MAP_DEPUTE_NOM.set(String(d.id), String(d.nom));
    });

    // 2) Charger lois
    const lois = await fetchJson(URL_LOIS);
    // Attendu : [{ id, titre, type, auteur, url, nor, date, etat }]
    LOIS = (lois || []).map(x => {
      const auteurNom = MAP_DEPUTE_NOM.get(String(x.auteur || "")) || (x.auteur || "");
      return { ...x, auteurNom };
    });

    render();

    // Recherche
    el.q && el.q.addEventListener("input", render);

  } catch (e) {
    showError("Erreur de chargement des données (lois ou députés).", e);
  }
})();