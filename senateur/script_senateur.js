/*************************************************
 * Sénateurs -- liste depuis senateur/senateur_raw.json
 * (fichier généré par le workflow update_senateur.yml)
 * - Mapping robuste (ODSEN_GENERAL.json varie selon millésimes)
 * - Recherche: nom, groupe, département
 * - Cartes compatibles avec la CSS Députés
 *************************************************/

const URL_LOCAL = "./senateur_raw.json"; // même dossier que index_senateur.html

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("senateurs"),
  err:    document.getElementById("err"),
};

let SENATEURS = [];

/* ---------- Utils ---------- */
const esc = (s) => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const nonEmpty = (x) => x != null && String(x).trim() !== "";

function showErr(msg){
  console.error(msg);
  if (els.err) els.err.textContent = String(msg);
}

/* ---------- Mapping d'un enregistrement du Sénat vers notre modèle ---------- */
function mapSenator(raw){
  // ODSEN_* peut être {result:{records:[{fields:{...}}]}} ou un tableau d’objets plats
  const f = raw?.fields || raw || {};

  // Civilité / nom / prénom
  const civ    = f.civilite || f.civiliteCourte || f.civ || "";
  const nom    = f.nom || f.nomUsuel || f.nomNaissance || f.nomUsage || "";
  const prenom = f.prenom || f.prenoms || f.prenomUsage || "";

  // Nom complet
  let fullName = [civ, prenom, nom].filter(nonEmpty).join(" ").replace(/\s+/g," ").trim();
  if (!nonEmpty(fullName)) fullName = [prenom, nom].filter(nonEmpty).join(" ").trim();

  // Groupe (sigle + libellé)
  const sigle   = f.groupeAbrev || f.groupeSigle || f.groupe_code || f.libelleAbrev || f.groupe || "";
  const libelle = f.groupeLibelle || f.groupe_long || f.libelle || f.groupeNom || "";
  const groupe  = nonEmpty(sigle) ? (nonEmpty(libelle) ? `${sigle} -- ${libelle}` : sigle)
                                  : (libelle || "");

  // Département / territoire
  const departement = f.departement || f.departementNom || f.departementLibelle
                   || f.circonscription || f.territoire || "";

  // URL fiche & photo
  const urlFiche = f.url || f.urlFiche || f.lien || f.page || "";
  const idPhoto  = f.idPhoto || f.idSenat || f.matricule || f.numero || "";
  const urlPhoto = f.photo || f.urlPhoto
                || (nonEmpty(idPhoto) ? `https://www.senat.fr/senimg/${idPhoto}.jpg` : "");

  // Identifiant interne
  const id = String(
    f.id || f.idSenat || f.matricule || f.uid
    || `${(nom||"")}-${(prenom||"")}`.toLowerCase()
  );

  return {
    id,
    nom: nonEmpty(fullName) ? fullName : (nom || "").trim(),
    groupe: nonEmpty(groupe) ? groupe : "--",
    departement: nonEmpty(departement) ? departement : "--",
    url: nonEmpty(urlFiche) ? urlFiche : "https://www.senat.fr/senateurs/senatlistealpha.html",
    photo: nonEmpty(urlPhoto) ? urlPhoto : "https://www.senat.fr/mi/defaut-senateur.jpg"
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

  // Rendre chaque carte entièrement cliquable (sans interférer avec le lien)
  els.grid.querySelectorAll(".card").forEach(card => {
    const btn = card.querySelector(".btn");
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // si clic sur le lien, ne double pas
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
    const r = await fetch(URL_LOCAL + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(`Chargement sénateurs: HTTP ${r.status}`);
    const data = await r.json();

    // Deux schémas fréquents : tableau direct OU result.records[].fields
    let rows = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data?.result?.records) {
      rows = data.result.records;
    } else if (data?.records) {
      rows = data.records;
    }

    SENATEURS = rows.map(mapSenator).