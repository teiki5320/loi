/*************************************************
 * Députés -- cartes avec photo + mapping groupes
 * Source locale : /deputes/deputes.json (généré par Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";   // depuis /deputes/index_depute.html

/* === Mapping manuel des groupes (tel que fourni) === */
const GROUPES = {
  "PO800490": { sigle: "RE",   couleur: "#ffd700" }, // Renaissance
  "PO800491": { sigle: "RN",   couleur: "#1e90ff" }, // Rassemblement National
  "PO800492": { sigle: "LFI",  couleur: "#ff1493" }, // La France Insoumise
  "PO800493": { sigle: "SOC",  couleur: "#dc143c" }, // Socialistes
  "PO800494": { sigle: "LR",   couleur: "#4169e1" }, // Les Républicains
  "PO800495": { sigle: "EELV", couleur: "#228b22" }, // Écologistes
  "PO845485": { sigle: "HOR",  couleur: "#8a2be2" }, // Horizons
  "PO845454": { sigle: "UDI",  couleur: "#6495ed" }, // UDI / Indépendants
  "PO845429": { sigle: "LIOT", couleur: "#8b4513" }, // Libertés & Territoires
  "PO800496": { sigle: "DEM",  couleur: "#20b2aa" }, // Démocrates (MoDem & Ind.)
  "PO845452": { sigle: "GDR",  couleur: "#b22222" }, // Gauche Démocrate & Républicaine
  "PO845470": { sigle: "NUP",  couleur: "#ff4500" }, // NUPES divers
};

// === DOM ===
const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend") // optionnel : si pas présent, on ignore
};

let rows = [];             // [{id, nom, circo, dept, groupe, email}]
let sortK = "nom";         // tri alpha par défaut
let sortAsc = true;

// === Utils ===
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

// helper photo : candidate URLs + fallback
function buildPhoto(id) {
  if (!id) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'><rect width='100%' height='100%' fill='%23f0f0f0'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23999'>photo</text></svg>";
  const base = "https://www2.assemblee-nationale.fr/static/tribun";
  return `${base}/17/photos/${id}.jpg`; // onerror => chainOnError gèrera 16, 15, puis fallback
}
function chainOnError(img, id) {
  const order = [
    `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/16/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/15/photos/${id}.jpg`
  ];
  let idx = 0;
  img.onerror = () => {
    idx++;
    if (idx < order.length) img.src = order[idx];
    else { img.onerror = null; img.src = buildPhoto(""); }
  };
}

// === Filtres ===
function hydrateFilters() {
  if (!el.groupe || !el.dept) return;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  // Groupes : utiliser des sigles lisibles si connus
  const groupesSigles = uniq(rows.map(r => GROUPES[r.groupe]?.sigle || r.groupe));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupesSigles.map(s=>`<option>${esc(s)}</option>`).join("");

  // Départements
  const depts = uniq(rows.map(r => r.dept));
  el.dept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

// === Légende dynamique (optionnelle) ===
function renderLegend() {
  if (!el.legend) return;
  // ne montrer que les groupes présents dans rows
  const idsPresents = new Set(rows.map(r => r.groupe).filter(Boolean));
  const items = [];
  idsPresents.forEach(id => {
    const g = GROUPES[id];
    if (!g) return;
    items.push(`<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}</span>`);
  });
  el.legend.innerHTML = items.join("") || "";
}

// === Rendu des cartes ===
function render() {
  if (!el.list) return;

  const q     = (el.q?.value || "").trim().toLowerCase();
  const gsel  = (el.groupe?.value || "");
  const dsel  = (el.dept?.value || "");

  let filtered = rows.filter(r =>
    (!gsel || (GROUPES[r.groupe]?.sigle || r.groupe) === gsel) &&
    (!dsel || r.dept === dsel) &&
    (!q || [r.nom, r.circo, r.dept, r.groupe, r.email].some(x => (x||"").toLowerCase().includes(q)))
  );

  // tri simple
  filtered.sort((a,b)=>{
    const va = noDia((a[sortK]||"")+"").toLowerCase();
    const vb = noDia((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.list.innerHTML = filtered.map(r => {
    const g = GROUPES[r.groupe] || { sigle: r.groupe, couleur: "#999" };
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";
    const photoSrc = buildPhoto(r.id);
    return `
      <div class="depute-card">
        <div>
          <img class="depute-photo" src="${photoSrc}" alt="Photo ${esc(r.nom)}" id="img-${esc(r.id)}">
        </div>
        <div>
          <div class="depute-header">${esc(r.nom)}</div>
          <div class="depute-meta">
            <span class="chip">Circo ${esc(r.circo || "--")}</span>
            <span class="chip">${esc(r.dept || "--")}</span>
          </div>
          <div class="depute-meta">
            Groupe :
            <span class="depute-groupe" style="color:${g.couleur}">${esc(g.sigle)}</span>
          </div>
          <div class="depute-meta">
            ${mail}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // bascule photo 17→16→15→fallback si 404
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (img) chainOnError(img, r.id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

// === Listeners ===
el.q     && el.q.addEventListener("input", render);
el.groupe&& el.groupe.addEventListener("change", render);
el.dept  && el.dept.addEventListener("change", render);

// === Init ===
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // fallback: si structure différente (objets vides), filtrer ceux qui ont un nom
    rows = (rows || []).filter(d => d && (d.nom || "").trim().length);

    // dédoublonnage
    const seen = new Set();
    rows = rows.filter(d => {
      const key = d.id || `${d.nom}|${d.circo||""}|${d.dept||""}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });

    hydrateFilters();
    renderLegend();
    render();
  } catch(e){
    showError("Impossible de charger le fichier local deputes.json.", e);
    if (el.count) el.count.textContent = "Erreur de chargement";
  }
})();