/*************************************************
 * Sénateurs -- liste depuis senateur/senateur_raw.json
 * JSON attendu : {"results":[{ Nom_usuel, Prenom_usuel, Groupe_politique,
 *                              Circonscription, Courrier_electronique, Etat, ... }]}
 * - Filtre uniquement "ACTIF"
 * - Recherche : nom, groupe, département
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

/* ---------- Mapping dédié au JSON "results" du Sénat ---------- */
function mapFromResultsRow(row){
  // Clés vues dans ton dump : Nom_usuel, Prenom_usuel, Groupe_politique, Circonscription, Courrier_electronique, Etat
  const civ     = row.Qualite || ""; // "M.", "Mme", etc. (optionnel)
  const nom     = row.Nom_usuel || row.nom_usuel || row.Nom || "";
  const prenom  = row.Prenom_usuel || row.prenom_usuel || row.Prenom || "";
  const groupe  = row.Groupe_politique || row.groupe_politique || "";
  const dep     = row.Circonscription || row.circonscription || row.Departement || "";
  const email   = row.Courrier_electronique || row.courrier_electronique || "";
  const etat    = row.Etat || row.etat || "";
  const id      = String(row.Matricule || row.id || `${nom}-${prenom}`).toLowerCase();

  // Nom complet
  let fullName = [civ, prenom, nom].filter(nonEmpty).join(" ").replace(/\s+/g," ").trim();
  if (!nonEmpty(fullName)) fullName = [prenom, nom].filter(nonEmpty).join(" ").trim();

  return {
    id,
    nom: nonEmpty(fullName) ? fullName : (nom || "").trim(),
    groupe: nonEmpty(groupe) ? groupe : "--",
    departement: nonEmpty(dep) ? dep : "--",
    email: nonEmpty(email) ? email : "--",
    etat: etat,
    // pas d’URL/photo directe dans ce jeu, on met des valeurs par défaut
    url: "https://www.senat.fr/senateurs/senatlistealpha.html",
    photo: "https://www.senat.fr/mi/defaut-senateur.jpg"
  };
}

/* ---------- Rendu ---------- */
function render(){
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = !q ? SENATEURS : SENATEURS.filter(s =>
    [s.nom, s.groupe, s.departement, s.email].some(v => (v||"").toLowerCase().includes(q))
  );

  els.grid.innerHTML = filtered.map(s => `
    <article class="card" tabindex="0" aria-label="Voir la fiche de ${esc(s.nom)}">
      <img class="avatar" src="${esc(s.photo)}" alt="Photo de ${esc(s.nom)}"
           onerror="this.src='https://www.senat.fr/mi/defaut-senateur.jpg'"/>
      <h3>${esc(s.nom)}</h3>
      <div class="meta">
        <div class="badge"><strong>Groupe</strong><div>${esc(s.groupe)}</div></div>
        <div class="badge"><strong>Département</strong><div>${esc(s.departement)}</div></div>
        <div class="badge"><strong>Email</strong><div>${esc(s.email)}</div></div>
      </div>
      <a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Voir la fiche</a>
    </article>
  `).join("");

  // Carte entière cliquable (en plus du bouton)
  els.grid.querySelectorAll(".card").forEach(card => {
    const btn = card.querySelector(".btn");
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
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

    // Ton fichier est de la forme {"results":[ ... ]}
    const rows = Array.isArray(data?.results) ? data.results
               : Array.isArray(data) ? data
               : [];
    // Garde uniquement les sénateurs ACTIFS
    SENATEURS = rows.filter(row => (row.Etat || row.etat) === "ACTIF")
                    .map(mapFromResultsRow);

    if (!SENATEURS.length) showErr("Aucun sénateur 'ACTIF' trouvé dans le JSON.");
    render();
  } catch (e) {
    showErr(e);
    els.grid.innerHTML = `<p style="opacity:.7">Impossible de charger les données des sénateurs.</p>`;
  }
}

init();
els.search && els.search.addEventListener("input", render);