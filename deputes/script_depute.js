/*************************************************
 * Députés -- cartes + filtres + groupes enrichis
 * Source : /deputes/deputes.json (avec groupeSigle / groupeLibelle)
 *************************************************/

const URL_DEPUTES = "./deputes.json"; // depuis /deputes/index_depute.html

// --- DOM
const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend"),
};

let rows = [];
let sortK = "nom";
let sortAsc = true;

// --- utils
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

// photos AN 17 -> 16 -> 15 -> placeholder
function buildPhoto(id){ 
  if(!id) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'><rect width='100%' height='100%' fill='%23f0f0f0'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23999'>photo</text></svg>";
  return `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`;
}
function chainOnError(img, id){
  const tries = [
    `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/16/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/15/photos/${id}.jpg`,
  ];
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < tries.length) img.src = tries[i];
    else { img.onerror = null; img.src = buildPhoto(""); }
  };
}

// --- filtres
function hydrateFilters(){
  if (!el.groupe || !el.dept) return;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  // IMPORTANT : on affiche le nom lisible (groupeSigle si dispo, sinon code)
  const groupesLisibles = uniq(rows.map(r => r.groupeSigle || r.groupe || ""));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` +
    groupesLisibles.map(s => `<option>${esc(s)}</option>`).join("");

  const depts = uniq(rows.map(r => r.dept || ""));
  el.dept.innerHTML = `<option value="">Tous départements</option>` +
    depts.map(d => `<option>${esc(d)}</option>`).join("");
}

// légende simple (uniquement sigles présents)
function renderLegend(){
  if (!el.legend) return;
  const present = [...new Set(rows.map(r => r.groupeSigle || r.groupe).filter(Boolean))];
  el.legend.innerHTML = present.map(s => `<span class="legend-item"><span class="legend-dot"></span>${esc(s)}</span>`).join("");
}

// --- rendu
function render(){
  if (!el.list) return;

  const q    = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");
  const dsel = (el.dept?.value || "");

  let filtered = rows.filter(r => {
    const gLabel = r.groupeSigle || r.groupe || "";
    const hay = [r.nom, r.circo, r.dept, gLabel, r.email].join(" ").toLowerCase();
    return (!gsel || gLabel === gsel)
        && (!dsel || r.dept === dsel)
        && (!q || hay.includes(q));
  });

  filtered.sort((a,b)=>{
    const va = noDia(String(a[sortK]||"")).toLowerCase();
    const vb = noDia(String(b[sortK]||"")).toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.list.innerHTML = filtered.map(r => {
    const photo = buildPhoto(r.id);
    const gLabel = r.groupeSigle || r.groupe || "";
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";
    return `
      <div class="depute-card">
        <div>
          <img class="depute-photo" src="${photo}" alt="Photo ${esc(r.nom)}" id="img-${esc(r.id)}">
        </div>
        <div>
          <div class="depute-header">${esc(r.nom)}</div>
          <div class="depute-meta">
            <span class="chip">Circo ${esc(r.circo || "--")}</span>
            <span class="chip">${esc(r.dept || "--")}</span>
          </div>
          <div class="depute-meta">
            Groupe : <strong>${esc(gLabel)}</strong>
          </div>
          <div class="depute-meta">
            ${mail}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // fallback 17→16→15
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (img) chainOnError(img, r.id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

// --- listeners
el.q     && el.q.addEventListener("input", render);
el.groupe&& el.groupe.addEventListener("change", render);
el.dept  && el.dept.addEventListener("change", render);

// --- init
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // sécurité : on ne garde que les entrées avec un nom
    rows = (rows||[]).filter(d => d && (d.nom||"").trim());

    // dédoublonnage (id prioritaire)
    const seen = new Set();
    rows = rows.filter(d => {
      const k = d.id || `${d.nom}|${d.circo||""}|${d.dept||""}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    });

    hydrateFilters();
    renderLegend();
    render();
  } catch (e) {
    showError("Impossible de charger deputes.json.", e);
    el.count && (el.count.textContent = "Erreur de chargement");
  }
})();