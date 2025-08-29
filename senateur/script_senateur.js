/*************************************************
 * Sénateurs -- affichage en cartes
 * Source locale (workflow): senateur/senateur_raw.json
 * - Tolérant au format (results[], records[], senateurs[], tableau)
 * - Filtre ACTIF si le champ Etat/etat/statut est présent
 * - Recherche: nom, groupe, département, email
 * - Rendu compatible avec la CSS "Députés" (.card/.avatar/.meta/.badge/.btn)
 *************************************************/

const URL_LOCAL = "./senateur_raw.json";

/* ---------- Cibles DOM (multi-ID pour être tolérant) ---------- */
const els = {
  search: document.getElementById("search") || document.getElementById("q"),
  grid:   document.getElementById("senateurs") || document.getElementById("senateurs-list"),
  err:    document.getElementById("err"),
  count:  document.getElementById("count"),
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

/* ---------- Mapping générique vers notre modèle ---------- */
function mapRow(row){
  // Certains formats ont row.fields
  const f = row?.fields || row || {};

  // Ids possibles
  const idMat = f.Matricule || f.matricule || f.id || f.idSenat || f.uid || "";
  const id = String(idMat || `${f.Nom_usuel || f.nom || ""}-${f.Prenom_usuel || f.prenom || ""}`).toLowerCase();

  // Nom / prénom / civilité
  const civ    = f.Qualite || f.civilite || f.civ || "";
  const nom    = f.Nom_usuel || f.nom_usuel || f.Nom || f.nom || "";
  const prenom = f.Prenom_usuel || f.prenom_usuel || f.Prenom || f.prenom || "";

  let fullName = [civ, prenom, nom].filter(nonEmpty).join(" ").replace(/\s+/g," ").trim();
  if (!nonEmpty(fullName)) fullName = [prenom, nom].filter(nonEmpty).join(" ").trim();

  // Groupe (sigle + libellé)
  const gSigle   = f.groupe_sigle || f.Groupe_sigle || f.Groupe || f.Groupe_politique || f.groupe || f.groupe_code || "";
  const gLibelle = f.groupe_libelle || f.Groupe_libelle || f.groupe_libelle || f.groupe_long || f.groupeNom || "";
  const groupe   = nonEmpty(gSigle) ? (nonEmpty(gLibelle) ? `${gSigle} -- ${gLibelle}` : gSigle)
                                    : (gLibelle || f.Groupe_politique || f.groupe || "--");

  // Territoire / circo
  const dep = f.Circonscription || f.circonscription || f.departement || f.departementNom || f.territoire || "--";

  // Contact
  const email = f.Courrier_electronique || f.courrier_electronique || f.email || "--";

  // Photo & fiche
  const photo = nonEmpty(idMat)
    ? `https://www.senat.fr/senimg/${idMat}.jpg`
    : "https://www.senat.fr/mi/defaut-senateur.jpg";

  const fiche = nonEmpty(idMat)
    ? `https://www.senat.fr/senateur/${idMat}.html`
    : "https://www.senat.fr/senateurs/senatlistealpha.html";

  // Etat (si présent)
  const etat = (f.Etat || f.etat || f.statut || "").toString();

  return {
    id,
    nom: nonEmpty(fullName) ? fullName : (nom || "").trim(),
    groupe: nonEmpty(groupe) ? groupe : "--",
    departement: nonEmpty(dep) ? dep : "--",
    email,
    photo,
    url: fiche,
    etat,
  };
}

/* ---------- Rendu ---------- */
function render(){
  if (!els.grid) return;

  const q = (els.search?.value || "").trim().toLowerCase();
  const filtered = !q ? SENATEURS : SENATEURS.filter(s =>
    [s.nom, s.groupe, s.departement, s.email].some(v => (v || "").toLowerCase().includes(q))
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

  // Rendre la carte entière cliquable (sans gêner le bouton)
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

  if (els.count) els.count.textContent = `${filtered.length} sénateurs affichés`;
  if (!filtered.length) els.grid.innerHTML = `<p style="opacity:.7">Aucun résultat.</p>`;
}

/* ---------- Chargement ---------- */
async function init(){
  try{
    const r = await fetch(URL_LOCAL + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(`Chargement sénateurs: HTTP ${r.status}`);
    const data = await r.json();

    // Formats possibles
    let rows = [];
    if (Array.isArray(data)) rows = data;
    else if (Array.isArray(data?.results)) rows = data.results;
    else if (Array.isArray(data?.records)) rows = data.records;
    else if (Array.isArray(data?.senateurs)) rows = data.senateurs;
    else rows = [];

    // Filtrer ACTIF si l’info est dispo
    if (rows.some(x => x?.Etat != null || x?.etat != null || x?.statut != null)) {
      rows = rows.filter(x => {
        const v = (x.Etat || x.etat || x.statut || "").toString().toUpperCase();
        return v === "ACTIF" || v === "EN FONCTION";
      });
    }

    SENATEURS = rows.map(mapRow).filter(s => nonEmpty(s.nom));
    if (!SENATEURS.length) showErr("Aucun sénateur parsé (format inattendu du JSON).");
    render();
  } catch (e) {
    showErr(e);
    if (els.grid) els.grid.innerHTML = `<p style="opacity:.7">Impossible de charger les données des sénateurs.</p>`;
  }
}

init();
els.search && els.search.addEventListener("input", render);