/*************************************************
 * Députés -- cartes + photos avec fallback 17→16→15
 * Source locale : ./deputes.json (généré par Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";

/* === Mapping groupes (sigle + couleur + libellé long pour le menu) === */
const GROUPES = {
  "PO800490": { sigle: "RE",   libelle:"Renaissance",                               couleur: "#ffd700" },
  "PO800491": { sigle: "RN",   libelle:"Rassemblement National",                    couleur: "#1e90ff" },
  "PO800492": { sigle: "LFI",  libelle:"La France insoumise",                       couleur: "#ff1493" },
  "PO800493": { sigle: "SOC",  libelle:"Socialistes et apparentés",                 couleur: "#dc143c" },
  "PO800494": { sigle: "LR",   libelle:"Les Républicains",                          couleur: "#4169e1" },
  "PO800495": { sigle: "EELV", libelle:"Écologistes",                               couleur: "#228b22" },
  "PO845485": { sigle: "HOR",  libelle:"Horizons & apparentés",                     couleur: "#8a2be2" },
  "PO845454": { sigle: "UDI",  libelle:"UDI et Indépendants",                       couleur: "#6495ed" },
  "PO845429": { sigle: "LIOT", libelle:"Libertés, Indépendants, Outre‑mer, Terr.",  couleur: "#8b4513" },
  "PO800496": { sigle: "DEM",  libelle:"Les Démocrates (MoDem & Ind.)",             couleur: "#20b2aa" },
  "PO845452": { sigle: "GDR",  libelle:"Gauche Démocrate & Républicaine",           couleur: "#b22222" },
  "PO845470": { sigle: "NUP",  libelle:"Non‑inscrits proches NUPES / divers NUPES", couleur: "#ff4500" },
};

/* === DOM === */
const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend"),
};

let rows = [];   // [{id, nom, circo, dept, groupe, email}, …]

/* === Utils === */
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

/* === Photos : construit l'URL et gère le fallback 17→16→15 === */
function photoUrl(id, legislature) {
  return `https://www2.assemblee-nationale.fr/static/tribun/${legislature}/photos/${id}.jpg`;
}
// petit SVG en data URI pour le placeholder
const PH_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect width='100%' height='100%' fill='#f2f3f5'/>
       <circle cx='60' cy='45' r='24' fill='#e1e4e8'/>
       <rect x='24' y='78' width='72' height='18' rx='9' fill='#e1e4e8'/>
       <text x='60' y='115' text-anchor='middle' font-size='10' fill='#9aa0a6' font-family='system-ui,sans-serif'>photo</text>
     </svg>`);

/* Assigne la photo avec fallback. Appel sur chaque <img.depute-photo> */
function attachPhoto(img, id) {
  if (!id) { img.src = PH_PLACEHOLDER; return; }

  const legs = [17, 16, 15];
  let i = 0;

  // d'abord écouter les erreurs, puis définir la première source
  img.onerror = () => {
    i++;
    if (i < legs.length) {
      img.src = photoUrl(id, legs[i]);
    } else {
      img.onerror = null;
      img.src = PH_PLACEHOLDER;
    }
  };

  img.src = photoUrl(id, legs[i]);
}

/* === Filtres / légende === */
function hydrateFilters() {
  if (!el.groupe || !el.dept) return;

  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  // Groupes -> on affiche le libellé long si connu, sinon le code
  const gSeen = uniq(rows.map(r => GROUPES[r.groupe]?.libelle || r.groupe));
  el.groupe.innerHTML =
    `<option value="">Tous groupes</option>` +
    gSeen.map(txt => `<option>${esc(txt)}</option>`).join("");

  const depts = uniq(rows.map(r => r.dept));
  el.dept.innerHTML =
    `<option value="">Tous départements</option>` +
    depts.map(d => `<option>${esc(d)}</option>`).join("");
}

function renderLegend() {
  if (!el.legend) return;
  const ids = new Set(rows.map(r => r.groupe).filter(Boolean));
  const items = [];
  ids.forEach(id => {
    const g = GROUPES[id];
    if (g) items.push(
      `<span class="legend-item">
         <span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}
       </span>`
    );
  });
  el.legend.innerHTML = items.join(" ");
}

/* === Rendu cartes === */
function render() {
  if (!el.list) return;

  const q = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");   // libellé long
  const dsel = (el.dept?.value || "");

  const filtered = rows.filter(r => {
    const gInfo = GROUPES[r.groupe];
    const gLabel = gInfo?.libelle || r.groupe;
    return (!gsel || gLabel === gsel) &&
           (!dsel || r.dept === dsel) &&
           (!q || [r.nom, r.circo, r.dept, gInfo?.sigle, gLabel, r.email]
                 .some(x => (x||"").toLowerCase().includes(q)));
  });

  el.list.innerHTML = filtered.map(r => {
    const g = GROUPES[r.groupe] || { sigle: r.groupe, libelle: r.groupe, couleur: "#888" };

    return `
      <article class="depute-card">
        <div class="depute-avatar">
          <img class="depute-photo" data-id="${esc(r.id)}" alt="Photo ${esc(r.nom)}">
        </div>
        <div class="depute-body">
          <h3 class="depute-name">${esc(r.nom || "--")}</h3>
          <div class="depute-meta">
            <span class="chip">Circo ${esc(r.circo || "--")}</span>
            <span class="chip">${esc(r.dept || "--")}</span>
          </div>
          <div class="depute-meta">
            Groupe :
            <span class="depute-groupe" style="color:${g.couleur}" title="${esc(g.libelle)}">
              ${esc(g.sigle)}
            </span>
          </div>
          <div class="depute-meta">
            ${r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--"}
          </div>
        </div>
      </article>
    `;
  }).join("");

  // brancher/charger les photos (avec fallback) sur toutes les cartes rendues
  document.querySelectorAll(".depute-photo[data-id]").forEach(img => {
    const id = img.getAttribute("data-id");
    attachPhoto(img, id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

/* === Listeners === */
el.q      && el.q.addEventListener("input", render);
el.groupe && el.groupe.addEventListener("change", render);
el.dept   && el.dept.addEventListener("change", render);

/* === Init === */
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // Nettoyage/dédoublonnage léger
    rows = (rows || []).filter(d => d && d.id && d.nom);
    const seen = new Set();
    rows = rows.filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)));

    hydrateFilters();
    renderLegend();
    render();
  } catch(e){
    showError("Impossible de charger ./deputes.json.", e);
    if (el.count) el.count.textContent = "Erreur de chargement";
  }
})();