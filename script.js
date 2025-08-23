/*************************************************
 * Lois -- affichage en cartes + auteur lisible
 * - Charge ./lois/lois.json (workflow GitHub)
 * - Charge ./deputes/deputes.json pour résoudre PAxxxxx -> Nom Prénom
 * - Pour les POxxxxx (groupes), montre le sigle (ou le nom complet)
 *************************************************/

const URL_LOIS = "./lois/lois.json";
const URL_DEPUTES = "./deputes/deputes.json";

// Sélecteurs (doivent exister dans l’index des lois)
const el = {
  q:    document.getElementById("q"),     // <input type="search" id="q">
  grid: document.getElementById("grid"),  // conteneur des cartes
  err:  document.getElementById("err"),   // <pre id="err"> facultatif
  count:document.getElementById("count"), // petit compteur (facultatif)
};

// Dictionnaire des groupes (PO…)
const GROUPES = {
  "PO800490": { sigle: "RE",   nom: "Renaissance" },
  "PO800491": { sigle: "RN",   nom: "Rassemblement National" },
  "PO800492": { sigle: "LFI",  nom: "La France insoumise" },
  "PO800493": { sigle: "SOC",  nom: "Socialistes" },
  "PO800494": { sigle: "LR",   nom: "Les Républicains" },
  "PO800495": { sigle: "EELV", nom: "Écologistes" },
  "PO845485": { sigle: "HOR",  nom: "Horizons et apparentés" },
  "PO845454": { sigle: "UDI",  nom: "UDI et Indépendants" },
  "PO845429": { sigle: "LIOT", nom: "Libertés, Indépendants, Outre-mer et Territoires" },
  "PO800496": { sigle: "DEM",  nom: "Démocrates (MoDem et Ind.)" },
  "PO845452": { sigle: "GDR",  nom: "Gauche démocrate et républicaine" },
  "PO845470": { sigle: "NUP",  nom: "NUPES / divers NUPES" },
};

// État
let LOIS = [];                // tableau d’objets { id, titre, type, auteur, url, nor, date, etat }
let MAP_DEP = new Map();      // "PAxxxx" -> "Nom Prénom"
let query = "";

// Utils
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

// Résout l’auteur (code) en affichage lisible
function resolveAuteur(code, {long=false} = {}) {
  if (!code) return "";
  if (code.startsWith("PA")) {
    return MAP_DEP.get(code) || code; // député trouvé ? nom sinon code brut
  }
  if (code.startsWith("PO")) {
    const g = GROUPES[code];
    if (!g) return code;
    return long ? g.nom : g.sigle;    // sigle court par défaut, nom complet si demandé
  }
  // Autres cas possibles: Gouvernement, Sénat, etc. (on laisse tel quel)
  return code;
}

// Rendu des cartes + filtre
function render() {
  if (!el.grid) return;

  const q = query.trim().toLowerCase();
  let data = LOIS;

  if (q) {
    data = LOIS.filter(l => {
      const hay = [
        l.titre, l.type, l.etat, l.nor, l.date,
        resolveAuteur(l.auteur, {long:true}), // on cherche aussi dans l’auteur résolu
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // Compteur
  if (el.count) el.count.textContent = `${data.length} dossiers`;

  // Cartes
  el.grid.innerHTML = data.map(l => {
    const titre = l.titre || "";
    const titreShort = titre.length > 90 ? titre.slice(0, 90) + "…" : titre;
    const auteur = resolveAuteur(l.auteur) || "--";

    return `
      <article class="card">
        <h3 title="${esc(titre)}">${esc(titreShort)}</h3>
        <p><b>Type :</b> ${esc(l.type || "--")}</p>
        <p><b>Auteur :</b> ${esc(auteur)}</p>
        <p><b>Date :</b> ${esc(l.date || "--")} &nbsp; <b>État :</b> ${esc(l.etat || "--")}</p>
        ${l.url ? `<p><a href="${esc(l.url)}" target="_blank" rel="noopener">Voir le dossier</a></p>` : ""}
      </article>
    `;
  }).join("");
}

// Déclencheurs
el.q && el.q.addEventListener("input", (e)=>{
  query = e.target.value || "";
  render();
});

// Init
(async function init(){
  try {
    // Charge lois + députés en parallèle (no-cache pour contourner le cache CDN si besoin)
    const [rLois, rDeps] = await Promise.all([
      fetch(`${URL_LOIS}?v=${Date.now()}`,   { cache: "no-cache" }),
      fetch(`${URL_DEPUTES}?v=${Date.now()}`,{ cache: "no-cache" }),
    ]);
    if (!rLois.ok) throw new Error(`Lois HTTP ${rLois.status}`);
    if (!rDeps.ok) throw new Error(`Députés HTTP ${rDeps.status}`);

    const [lois, deputes] = await Promise.all([rLois.json(), rDeps.json()]);
    LOIS = Array.isArray(lois) ? lois : [];

    // construit la map "PAxxxx" -> "Nom Prénom"
    MAP_DEP.clear();
    (deputes || []).forEach(d => {
      if (d?.id && d?.nom) MAP_DEP.set(d.id, d.nom);
    });

    render();
  } catch (e) {
    console.error(e);
    if (el.err) el.err.textContent = `Erreur de chargement: ${e.message || e}`;
    if (el.grid) el.grid.innerHTML = "";
  }
})();