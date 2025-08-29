/*************************************************
 * Sénateurs -- recherche + onglets groupes + filtre département
 * Source: ./senateur_raw.json (issu de l'API Sénat)
 *************************************************/

const URL = "./senateur_raw.json";

const els = {
  q:     document.getElementById("q"),
  grid:  document.getElementById("senateurs-list"),
  tabs:  document.getElementById("tabs-groupes"),
  dept:  document.getElementById("dept"),
  count: document.getElementById("count"),
  err:   document.getElementById("err"),
};

let ROWS = [];
let GROUPES = [];   // [{code, libelle, n}]
let DEPTS = [];     // [{code, libelle}]

const state = {
  q: "",
  groupe: "",   // code de groupe ou ""
  dept: "",     // code de département ou ""
};

/* Utils */
const esc = s => (s ?? "").toString()
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function mapRow(r){
  // JSON attendu :
  // { nom, prenom, url, urlAvatar, groupe:{code,libelle}, circonscription:{code,libelle}, mail, serie, siege }
  const nom     = r?.nom || "";
  const prenom  = r?.prenom || "";
  const full    = `${prenom} ${nom}`.trim();
  const fiche   = r?.url ? `https://www.senat.fr${r.url}` : "https://www.senat.fr/senateurs/senatlistealpha.html";
  const photo   = r?.urlAvatar ? `https://www.senat.fr${r.urlAvatar}` : "https://www.senat.fr/mi/defaut-senateur.jpg";
  const groupeC = r?.groupe?.code || "";
  const groupeL = r?.groupe?.libelle || groupeC || "--";
  const deptC   = r?.circonscription?.code || "";
  const deptL   = r?.circonscription?.libelle || "--";
  const email   = r?.mail || "";
  const serie   = r?.serie ?? null;
  const siege   = r?.siege ?? null;

  return {
    full, fiche, photo,
    groupeCode: groupeC, groupeLib: groupeL,
    deptCode: deptC, deptLib: deptL,
    email, serie, siege,
    search: `${full} ${groupeC} ${groupeL} ${deptC} ${deptL} ${email}`.toLowerCase(),
  };
}

/* Construction des listes d'onglets + départements */
function buildFacets(rows){
  const grpMap = new Map();
  const depMap = new Map();
  for (const r of rows){
    if (r.groupeCode) grpMap.set(r.groupeCode, {code:r.groupeCode, libelle:r.groupeLib, n:(grpMap.get(r.groupeCode)?.n||0)+1});
    if (r.deptCode)   depMap.set(r.deptCode,   {code:r.deptCode,   libelle:r.deptLib});
  }
  GROUPES = Array.from(grpMap.values()).sort((a,b)=> a.code.localeCompare(b.code));
  DEPTS   = Array.from(depMap.values()).sort((a,b)=> (a.libelle||"").localeCompare(b.libelle||""));
}

/* Rendu des onglets groupes */
function renderTabs(){
  if (!els.tabs) return;
  const allClass = state.groupe==="" ? "tab is-active" : "tab";
  const tabs = [
    `<button type="button" class="${allClass}" data-g="">Tous groupes</button>`,
    ...GROUPES.map(g => {
      const cls = (state.groupe===g.code) ? "tab is-active" : "tab";
      const label = esc(g.code || g.libelle);
      return `<button type="button" class="${cls}" data-g="${esc(g.code)}">${label} <span class="muted" style="margin-left:4px">(${g.n})</span></button>`;
    })
  ].join("");
  els.tabs.innerHTML = tabs;

  els.tabs.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.groupe = btn.dataset.g || "";
      render();        // met à jour la liste
      renderTabs();    // rafraîchit l'état actif
    });
  });
}

/* Rendu du select départements */
function renderDeptSelect(){
  if (!els.dept) return;
  els.dept.innerHTML = `<option value="">Tous départements</option>` +
    DEPTS.map(d=> `<option value="${esc(d.code)}">${esc(d.libelle)}</option>`).join("");
  els.dept.value = state.dept;
}

/* Rendu des cartes selon l'état */
function render(){
  if (!els.grid) return;

  const filtered = ROWS.filter(r => {
    if (state.q && !r.search.includes(state.q)) return false;
    if (state.groupe && r.groupeCode !== state.groupe) return false;
    if (state.dept && r.deptCode !== state.dept) return false;
    return true;
  });

  els.grid.innerHTML = filtered.map(d => `
    <article class="senateur-card" tabindex="0" aria-label="${esc(d.full)}">
      <div class="senateur-photo-wrap">
        <img class="senateur-photo" src="${esc(d.photo)}" alt="Photo de ${esc(d.full)}"
             onerror="this.src='https://www.senat.fr/mi/defaut-senateur.jpg'">
      </div>
      <div class="senateur-body">
        <h3 class="senateur-name">${esc(d.full)}</h3>
        <div class="senateur-lines">
          <div>Circo ${esc(d.deptLib)}</div>
          <div>Groupe : <span class="senateur-groupe">${esc(d.groupeCode || d.groupeLib)}</span></div>
          <div>${d.email ? `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : `--`}</div>
          ${d.serie!=null || d.siege!=null ? `<div class="muted">Série ${d.serie ?? "?"} · Siège ${d.siege ?? "?"}</div>` : ``}
        </div>
        <div style="margin-top:6px">
          <a href="${esc(d.fiche)}" target="_blank" rel="noopener">Voir la fiche</a>
        </div>
      </div>
    </article>
  `).join("");

  els.count && (els.count.textContent = `${filtered.length} sénateur·rice·s affiché·e·s`);

  // cartes cliquables
  els.grid.querySelectorAll(".senateur-card").forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const item = filtered[i];
      if (item?.fiche) window.open(item.fiche, "_blank", "noopener");
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = filtered[i];
        if (item?.fiche) window.open(item.fiche, "_blank", "noopener");
      }
    });
  });

  if (!filtered.length) els.grid.innerHTML = `<p class="muted">Aucun résultat.</p>`;
}

/* Init */
async function init(){
  try{
    const r = await fetch(URL + "?v=" + Date.now(), { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json.results) ? json.results : []);
    ROWS = arr.map(mapRow).filter(x => x.full);

    buildFacets(ROWS);
    renderTabs();
    renderDeptSelect();
    render();

  }catch(e){
    console.error(e);
    els.err && (els.err.textContent = String(e));
    els.grid && (els.grid.innerHTML = `<p class="muted">Impossible de charger les données.</p>`);
  }
}

/* Interactions */
els.q && els.q.addEventListener("input", () => { state.q = els.q.value.trim().toLowerCase(); render(); });
els.dept && els.dept.addEventListener("change", () => { state.dept = els.dept.value || ""; render(); });

init();