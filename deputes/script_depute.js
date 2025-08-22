/*************************************************
 * Députés -- cartes avec photo + mapping groupes
 * JSON généré par GitHub Actions : /deputes/deputes.json
 *************************************************/

// Détection auto : en prod (github.io) => chemin relatif ; en local => URL absolue
const IS_PAGES = location.hostname.endsWith("github.io");
const ABS_BASE = "https://teiki5320.github.io/loi";
const URL_DEPUTES = (IS_PAGES ? "" : ABS_BASE) + "/deputes/deputes.json?v=" + Date.now();

/* === Mapping manuel des groupes (fourni) === */
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

// --- DOM
const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend") // optionnel
};

let rows = [];                  // [{id, nom, circo, dept, groupe, email}]
let sortK = "nom", sortAsc = true;

// --- Utils
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const showError = (msg,e) => {
  const detail = e?.message || (e?.status ? `HTTP ${e.status}` : "");
  if (el.err) el.err.textContent = `${msg} ${detail}`.trim();
  console.error(msg, e);
};

// --- Photos AN : 17 -> 16 -> 15 -> fallback
function buildPhoto(id) {
  if (!id) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'><rect width='100%' height='100%' fill='%23f0f0f0'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23999'>photo</text></svg>";
  return `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`;
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

// --- Filtres
function hydrateFilters() {
  if (!el.groupe || !el.dept) return;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  const groupesSigles = uniq(rows.map(r => GROUPES[r.groupe]?.sigle || r.groupe));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupesSigles.map(s=>`<option>${esc(s)}</option>`).join("");

  const depts = uniq(rows.map(r => r.dept));
  el.dept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

// --- Légende (optionnelle)
function renderLegend() {
  if (!el.legend) return;
  const ids = new Set(rows.map(r => r.groupe).filter(Boolean));
  const items = [];
  ids.forEach(id => {
    const g = GROUPES[id];
    if (!g) return;
    items.push(`<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}</span>`);
  });
  el.legend.innerHTML = items.join("") || "";
}

// --- Rendu cartes
function render() {
  if (!el.list) return;

  const q    = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");
  const dsel = (el.dept?.value || "");

  let filtered = rows.filter(r =>
    (!gsel || (GROUPES[r.groupe]?.sigle || r.groupe) === gsel) &&
    (!dsel || r.dept === dsel) &&
    (!q || [r.nom, r.circo, r.dept, r.groupe, r.email].some(x => (x||"").toLowerCase().includes(q)))
  );

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
            Groupe : <span class="depute-groupe" style="color:${g.couleur}">${esc(g.sigle)}</span>
          </div>
          <div class="depute-meta">${mail}</div>
        </div>
      </div>
    `;
  }).join("");

  // Chaîne de fallback pour les photos
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (img) chainOnError(img, r.id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

// --- Listeners
el.q      && el.q.addEventListener("input", render);
el.groupe && el.groupe.addEventListener("change", render);
el.dept   && el.dept.addEventListener("change", render);

// --- Init
(async function init(){
  try{
    console.log("FETCH", URL_DEPUTES); // pour debugger les chemins si besoin
    const r = await fetch(URL_DEPUTES, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // Garder uniquement ceux qui ont un nom
    rows = (rows || []).filter(d => d && (d.nom || "").trim().length);

    // Dédoublonnage
    const seen = new Set();
    rows = rows.filter(d => {
      const key = d.id || `${d.nom}|${d.circo||""}|${d.dept||""}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });

    hydrateFilters();
    renderLegend();
    render();
  } catch(e){
    showError("Impossible de charger deputes.json.", e);
    if (el.count) el.count.textContent = "Erreur de chargement";
  }
})();