/*************************************************
 * Sénateurs -- rendu aligné sur style_senateur.css
 * Source: ./senateur_raw.json (workflow api-senat)
 *************************************************/

const URL = "./senateur_raw.json";

const els = {
  q:     document.getElementById("q"),
  grid:  document.getElementById("senateurs-list"),
  count: document.getElementById("count"),
  err:   document.getElementById("err"),
};

let ROWS = [];

/* Utils */
const esc = s => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* Map JSON → objet pour la vue */
function mapRow(r){
  // JSON api-senat attendu :
  // { matricule, nom, prenom, url, urlAvatar, groupe:{code,libelle}, circonscription:{libelle}, mail }
  const nom     = r?.nom || "";
  const prenom  = r?.prenom || "";
  const full    = `${prenom} ${nom}`.trim();
  const fiche   = r?.url ? `https://www.senat.fr${r.url}` : "https://www.senat.fr/senateurs/senatlistealpha.html";
  const photo   = r?.urlAvatar ? `https://www.senat.fr${r.urlAvatar}` : "https://www.senat.fr/mi/defaut-senateur.jpg";
  const groupe  = r?.groupe?.code || r?.groupe?.libelle || "--";
  const circo   = r?.circonscription?.libelle || "--";
  const email   = r?.mail || "";

  return { full, fiche, photo, groupe, circo, email };
}

/* Rendu */
function render(){
  if (!els.grid) return;

  const q = (els.q?.value || "").trim().toLowerCase();
  const list = !q ? ROWS : ROWS.filter(d =>
    [d.full, d.groupe, d.circo, d.email].some(v => (v||"").toLowerCase().includes(q))
  );

  els.grid.innerHTML = list.map(d => `
    <article class="senateur-card" tabindex="0" aria-label="${esc(d.full)}">
      <div class="senateur-photo-wrap">
        <img class="senateur-photo" src="${esc(d.photo)}" alt="Photo de ${esc(d.full)}"
             onerror="this.src='https://www.senat.fr/mi/defaut-senateur.jpg'">
      </div>
      <div class="senateur-body">
        <h3 class="senateur-name">${esc(d.full)}</h3>
        <div class="senateur-lines">
          <div>Circo ${esc(d.circo)}</div>
          <div>Groupe : <span class="senateur-groupe">${esc(d.groupe)}</span></div>
          <div>
            ${d.email ? `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : `--`}
          </div>
        </div>
        <div style="margin-top:6px">
          <a href="${esc(d.fiche)}" target="_blank" rel="noopener">Voir la fiche</a>
        </div>
      </div>
    </article>
  `).join("");

  els.count && (els.count.textContent = `${list.length} sénateur·rice·s affiché·e·s`);

  // Rendre chaque carte cliquable (ouvre la fiche)
  els.grid.querySelectorAll(".senateur-card").forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      window.open(list[i].fiche, "_blank", "noopener");
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.open(list[i].fiche, "_blank", "noopener");
      }
    });
  });

  if (!list.length) els.grid.innerHTML = `<p class="legend-item">Aucun résultat.</p>`;
}

/* Init */
async function init(){
  try{
    const r = await fetch(URL + "?v=" + Date.now(), { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json.results) ? json.results : []);
    ROWS = arr.map(mapRow).filter(x => x.full);
    render();
  }catch(e){
    console.error(e);
    els.err && (els.err.textContent = String(e));
    els.grid && (els.grid.innerHTML = `<p class="legend-item">Impossible de charger les données.</p>`);
  }
}

els.q && els.q.addEventListener("input", render);
init();