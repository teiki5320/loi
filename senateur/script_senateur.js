/*************************************************
 * script_senateur.js
 * Affiche la liste des sénateurs depuis senateur_raw.json
 *************************************************/

const URL_SENATEURS = "./senateur_raw.json";

const els = {
  search: document.getElementById("search"),
  grid: document.getElementById("senateurs-list"),
  count: document.getElementById("count"),
  err: document.getElementById("err")
};

let SENATEURS = [];

// Fonction pour sécuriser le HTML
const esc = (s) =>
  (s ?? "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Chargement du JSON
async function loadSenateurs() {
  try {
    const r = await fetch(URL_SENATEURS + "?v=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    SENATEURS = await r.json();
    render();
  } catch (e) {
    els.err.textContent = "Erreur de chargement : " + e.message;
  }
}

// Rendu des cartes
function render() {
  if (!els.grid) return;
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = SENATEURS.filter((s) => {
    if (!q) return true;
    return [
      s.nom,
      s.prenom,
      s.groupe?.libelle,
      s.circonscription?.libelle,
      s.mail
    ]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  els.grid.innerHTML = filtered
    .map((s) => `
      <article class="card" tabindex="0" aria-label="Voir la fiche de ${esc(s.nom)}">
        <img class="avatar" src="https://www.senat.fr${esc(s.urlAvatar)}" 
             alt="Photo de ${esc(s.nom)}"
             onerror="this.src='https://www.senat.fr/mi/default-senateur.jpg'"/>
        <h3>${esc(s.prenom)} ${esc(s.nom)}</h3>
        <div class="meta">
          <div class="badge"><strong>Groupe</strong> ${esc(s.groupe?.libelle || "--")}</div>
          <div class="badge"><strong>Département</strong> ${esc(s.circonscription?.libelle || "--")}</div>
          <div class="badge"><strong>Email</strong> ${esc(s.mail || "--")}</div>
        </div>
        <a class="btn" href="https://www.senat.fr${esc(s.url)}" target="_blank" rel="noopener">Voir la fiche</a>
      </article>
    `)
    .join("");

  els.count.textContent = `${filtered.length} sénateurs affichés`;
}

els.search && els.search.addEventListener("input", render);

// Init
loadSenateurs();