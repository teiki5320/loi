/*************************************************
 * Sénateurs -- affichage en cartes
 * Source : senateur_raw.json
 *************************************************/

const URL_SENATEURS = "./senateur_raw.json";

const els = {
  search: document.getElementById("q"),
  grid:   document.getElementById("senateurs-list"), // <- correspond bien à ton HTML
  err:    document.getElementById("err"),
  count:  document.getElementById("count")
};

let SENATEURS = [];

// Petite fonction d'échappement HTML
const esc = s => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ---- Rendu des cartes ----
function render() {
  if (!els.grid) return;
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = SENATEURS.filter(s => {
    if (!q) return true;
    return [
      s.Nom_usuel, s.Prenom_usuel, s.Groupe_politique, s.Circonscription, s.Courrier_electronique
    ].some(v => (v || "").toLowerCase().includes(q));
  });

  els.grid.innerHTML = filtered.map(s => `
    <article class="card" tabindex="0" aria-label="Voir la fiche de ${esc(s.Nom_usuel)}">
      <img class="avatar" src="https://www.senat.fr/senimg/${esc(s.Matricule)}.jpg"
           alt="Photo de ${esc(s.Nom_usuel)}"
           onerror="this.src='https://www.senat.fr/mi/default-senateur.jpg'"/>
      <h3>${esc(s.Nom_usuel)} ${esc(s.Prenom_usuel || "")}</h3>
      <div class="meta">
        <div class="badge"><strong>Groupe</strong> ${esc(s.Groupe_politique || "--")}</div>
        <div class="badge"><strong>Département</strong> ${esc(s.Circonscription || "--")}</div>
        <div class="badge"><strong>Email</strong> ${esc(s.Courrier_electronique || "--")}</div>
      </div>
      <a class="btn" href="https://www.senat.fr/senateur/${esc(s.Matricule)}.html"
         target="_blank" rel="noopener">Voir la fiche</a>
    </article>
  `).join("");

  els.count.textContent = `${filtered.length} sénateurs affichés`;
}

// ---- Chargement ----
async function load() {
  try {
    const r = await fetch(URL_SENATEURS+"?v="+Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    SENATEURS = data.results || data || [];
    render();
  } catch(e) {
    els.err.textContent = "Erreur de chargement : " + e.message;
    console.error(e);
  }
}

// ---- Init ----
load();
els.search?.addEventListener("input", render);