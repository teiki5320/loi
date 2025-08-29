/*************************************************
 * Sénateurs -- liste depuis senateurs_raw.json
 * Source (workflow): https://data.senat.fr/data/senateurs/ODSEN_GENERAL.json
 * - Lecture locale: ./senateurs_raw.json (plus rapide & fiable)
 * - Mapping robuste des champs (le Sénat varie selon les millésimes)
 * - Recherche: nom, groupe, département
 * - Cartes cliquables vers la fiche officielle
 *************************************************/

const URL_SENAT_LOCAL = "./senateurs_raw.json";

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("senateurs"),
};

let SENATEURS = [];

/* ---------- Utils ---------- */
const esc = s => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function isNonEmpty(x){ return x != null && String(x).trim() !== ""; }

/* ---------- Mapping robuste d’un enregistrement vers notre modèle ---------- */
function mapSenator(raw){
  // Beaucoup de dumps ODSEN_* ont la forme result.records[].fields ; on gère aussi le tableau direct
  const f = raw?.fields || raw || {};

  // Civilité / nom / prénom
  const civ    = f.civilite || f.civiliteCourte || f.civ || "";
  const nom    = f.nom || f.nomUsuel || f.nomNaissance || f.nomUsage || "";
  const prenom = f.prenom || f.prenoms || f.prenomUsage || "";

  // Nom complet
  let fullName = [civ, prenom, nom].filter(isNonEmpty).join(" ").replace(/\s+/g," ").trim();
  if (!isNonEmpty(fullName)) fullName = [prenom, nom].filter(isNonEmpty).join(" ").trim();

  // Groupe (sigle + libellé)
  const sigle   = f.groupeAbrev || f.groupeSigle || f.groupe_code || f.libelleAbrev || f.groupe || "";
  const libelle = f.groupeLibelle || f.groupe_long || f.libelle || f.groupeNom || "";
  const groupe  = isNonEmpty(sigle) ? (isNonEmpty(libelle) ? `${sigle} -- ${libelle}` : sigle)
                                    : (libelle || "");

  // Département / territoire
  const departement = f.departement || f.departementNom || f.departementLibelle || f.circonscription || f.territoire || "";

  // URL fiche & photo (selon millésime)
  const urlFiche = f.url || f.urlFiche || f.lien || f.page || "";
  const idPhoto  = f.idPhoto || f.idSenat || f.matricule || f.numero || "";
  const urlPhoto = f.photo || f.urlPhoto || (isNonEmpty(idPhoto) ? `https://www.senat.fr/senimg/${idPhoto}.jpg` : "");

  // Identifiant interne
  const id = String(
    f.id || f.idSenat || f.matricule || f.uid || `${(nom||"")}-${(prenom||"")}`.toLowerCase()
  );

  return {
    id,
    nom: isNonEmpty(fullName) ? fullName : (nom || "").trim(),
    groupe: groupe || "--",
    departement: departement || "--",
    url: isNonEmpty(urlFiche) ? urlFiche : "https://www.senat.fr/senateurs/senatlistealpha.html",
    photo: isNonEmpty(urlPhoto) ? urlPhoto : "https://www.senat.fr/mi/defaut-senateur.jpg"
  };
}

/* ---------- Rendu ---------- */
function render(){
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = !q ? SENATEURS : SENATEURS.filter(s =>
    [s.nom, s.groupe, s.departement].some(v => (v||"").toLowerCase().includes(q))
  );

  els.grid.innerHTML = filtered.map(s => `
    <article class="card" tabindex="0" aria-label="Voir la fiche de ${esc(s.nom)}">
      <img class="avatar" src="${esc(s.photo)}" alt="Photo de ${esc(s.nom)}"
           onerror="this.src='https://www.senat.fr/mi/defaut-senateur.jpg'"/>
      <h3>${esc(s.nom)}</h3>
      <div class="meta">
        <div class="badge"><strong>Groupe</strong><div>${esc(s.groupe)}</div></div>
        <div class="badge"><strong>Département</strong><div>${esc(s.departement)}</div></div>
      </div>
      <a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Voir la fiche</a>
    </article>
  `).join("");

  // Rendre la carte entière cliquable (en plus du bouton)
  els.grid.querySelectorAll(".card").forEach(card => {
    const btn = card.querySelector(".btn");
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // si clic sur le lien, ne double-pas
      if (btn && btn.href) window.open(btn.href, "_blank", "noopener");
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (btn && btn.href) window.open(btn.href, "_blank", "noopener");
      }
    });
  });
}

/* ---------- Init ---------- */
async function init(){
  try{
    const r = await fetch(URL_SENAT_LOCAL + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(`Chargement sénateurs: HTTP ${r.status}`);
    const data = await r.json();

    // Deux schémas fréquents : tableau direct OU result.records[].fields
    let rows = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data?.result?.records) {
      rows = data.result.records;      // [{fields:{...}}, ...]
    } else if (data?.records) {
      rows = data.records;              // [{fields:{...}}, ...]
    } else {
      rows = [];
    }

    SENATEURS = rows.map(mapSenator).filter(s => isNonEmpty(s.nom));
    render();
  } catch (e) {
    console.error(e);
    els.grid.innerHTML = `<p style="opacity:.7">Impossible de charger les données des sénateurs.</p>`;
  }
}

init();
els.search && els.search.addEventListener("input", render);