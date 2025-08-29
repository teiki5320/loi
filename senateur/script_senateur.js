/*************************************************
 * Sénateurs -- même rendu que Députés (réutilise style_depute.css)
 * Source workflow: ./senateur_raw.json (api-senat)
 *************************************************/

const URL = "./senateur_raw.json";

const els = {
  q:    document.getElementById("q"),
  list: document.getElementById("deputes-list"),   // même id que la page députés
  count:document.getElementById("count"),
  err:  document.getElementById("err"),
};

let ROWS = [];

/* utils */
const esc = s => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* mapping -> structure attendue par le CSS "députés" */
function mapRow(r){
  // JSON api-senat: { matricule, nom, prenom, url, urlAvatar, groupe:{code,libelle}, circonscription:{libelle}, mail }
  const nom     = r?.nom || "";
  const prenom  = r?.prenom || "";
  const email   = r?.mail || "";
  const groupe  = r?.groupe?.code || r?.groupe?.libelle || "--";
  const circo   = r?.circonscription?.libelle || "--";
  const photo   = r?.urlAvatar ? `https://www.senat.fr${r.urlAvatar}` : "https://www.senat.fr/mi/defaut-senateur.jpg";
  const fiche   = r?.url ? `https://www.senat.fr${r.url}` : "https://www.senat.fr/senateurs/senatlistealpha.html";

  return {
    fullName: `${prenom} ${nom}`.trim(),
    groupe,
    circo,
    email,
    photo,
    fiche,
  };
}

function render(){
  if (!els.list) return;

  const q = (els.q?.value || "").trim().toLowerCase();
  const data = !q ? ROWS : ROWS.filter(d =>
    [d.fullName, d.groupe, d.circo, d.email].some(v => (v||"").toLowerCase().includes(q))
  );

  els.list.innerHTML = data.map(d => `
    <article class="depute-card" tabindex="0" aria-label="${esc(d.fullName)}">
      <div class="depute-photo-wrap">
        <img class="depute-photo" src="${esc(d.photo)}" alt="Photo de ${esc(d.fullName)}"
             onerror="this.src='https://www.senat.fr/mi/defaut-senateur.jpg'">
      </div>
      <div class="depute-body">
        <h3 class="depute-name">${esc(d.fullName)}</h3>
        <div class="depute-lines">
          <div>Circo ${esc(d.circo)}</div>
          <div>Groupe : <span class="depute-groupe">${esc(d.groupe)}</span></div>
          <div>
            ${d.email ? `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : `--`}
          </div>
        </div>
        <!-- lien "voir la fiche" sous le bloc, comme sur députés -->
        <div style="margin-top:6px">
          <a href="${esc(d.fiche)}" target="_blank" rel="noopener">Voir la fiche</a>
        </div>
      </div>
    </article>
  `).join("");

  if (els.count) els.count.textContent = `${data.length} sénateur·rice·s affiché·e·s`;

  // carte cliquable (comme un lien)
  els.list.querySelectorAll(".depute-card").forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      window.open(data[i].fiche, "_blank", "noopener");
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.open(data[i].fiche, "_blank", "noopener");
      }
    });
  });

  if (!data.length) els.list.innerHTML = `<p class="legend-item">Aucun résultat.</p>`;
}

async function init(){
  try{
    const r = await fetch(URL + "?v=" + Date.now(), { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json.results) ? json.results : []);
    ROWS = arr.map(mapRow).filter(x => x.fullName);
    render();
  }catch(e){
    console.error(e);
    if (els.err) els.err.textContent = String(e);
    if (els.list) els.list.innerHTML = `<p class="legend-item">Impossible de charger les données.</p>`;
  }
}

els.q && els.q.addEventListener("input", render);
init();