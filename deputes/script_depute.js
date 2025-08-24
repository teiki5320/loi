/*************************************************
 * Députés -- cartes + photos (ID numérique)
 * Source : ./deputes.json (généré par Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";

/* Groupes (codes → sigle/nom/couleur) */
const GROUPES = {
  "PO800490": { sigle: "RE",   libelle: "Renaissance",                               couleur: "#ffd700" },
  "PO800491": { sigle: "RN",   libelle: "Rassemblement National",                    couleur: "#1e90ff" },
  "PO800492": { sigle: "LFI",  libelle: "La France insoumise",                       couleur: "#ff1493" },
  "PO800493": { sigle: "SOC",  libelle: "Socialistes et apparentés",                 couleur: "#dc143c" },
  "PO800494": { sigle: "LR",   libelle: "Les Républicains",                          couleur: "#4169e1" },
  "PO800495": { sigle: "EELV", libelle: "Écologistes",                               couleur: "#228b22" },
  "PO845485": { sigle: "HOR",  libelle: "Horizons & Indépendants",                   couleur: "#8a2be2" },
  "PO845454": { sigle: "UDI",  libelle: "UDI et Indépendants",                       couleur: "#6495ed" },
  "PO845429": { sigle: "LIOT", libelle: "Libertés, Indépendants, Outre‑mer, Terr.",  couleur: "#8b4513" },
  "PO800496": { sigle: "DEM",  libelle: "Les Démocrates (MoDem & Ind.)",             couleur: "#20b2aa" },
  "PO845452": { sigle: "GDR",  libelle: "Gauche Démocrate & Républicaine",           couleur: "#b22222" },
  "PO845470": { sigle: "NUP",  libelle: "Non‑inscrits proches NUPES / divers NUPES", couleur: "#ff4500" }
};

const $ = s => document.querySelector(s);
const el = {
  q:      $("#q"),
  groupe: $("#groupe"),
  dept:   $("#dept"),
  count:  $("#count"),
  err:    $("#err"),
  list:   $("#deputes-list"),
  legend: $("#groupes-legend"),
};

let rows = []; // [{id, nom, circo, dept, groupe, email}]

/* Utils */
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

/* === Photos ===
   Les fichiers photo officiels utilisent l'ID NUMÉRIQUE.
   Exemple: "PA605694" -> "605694.jpg"
*/
function onlyDigits(rawId){
  return String(rawId || "").replace(/\D/g, ""); // garde uniquement [0-9]
}
function photoUrlNum(idNum, leg = 17){
  return `https://www2.assemblee-nationale.fr/static/tribun/${leg}/photos/${idNum}.jpg`;
}
function placeholderDataURI(){
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
       <rect width='100%' height='100%' fill='#f2f3f5'/>
       <circle cx='60' cy='45' r='24' fill='#e1e4e8'/>
       <rect x='24' y='78' width='72' height='18' rx='9' fill='#e1e4e8'/>
       <text x='60' y='115' text-anchor='middle' font-size='10' fill='#9aa0a6'
             font-family='system-ui,sans-serif'>photo</text>
     </svg>`
  );
}

/* onerror inline : tente 17 -> 16 -> 15 puis placeholder */
window.onImgErrNum = function onImgErrNum(img, idNum, leg){
  const next = leg === 17 ? 16 : (leg === 16 ? 15 : null);
  if(next){
    img.onerror = () => onImgErrNum(img, idNum, next);
    img.src = photoUrlNum(idNum, next) + `?v=${Date.now()}`;
  }else{
    img.onerror = null;
    img.src = placeholderDataURI();
  }
};

/* Filtres & légende */
function hydrateFilters(){
  if(!el.groupe || !el.dept) return;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  const groupesAff = uniq(rows.map(r => GROUPES[r.groupe]?.libelle || GROUPES[r.groupe]?.sigle || r.groupe));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupesAff.map(g=>`<option>${esc(g)}</option>`).join("");

  const depts = uniq(rows.map(r => r.dept));
  el.dept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

function renderLegend(){
  if(!el.legend) return;
  const seen = new Set(rows.map(r=>r.groupe).filter(Boolean));
  el.legend.innerHTML = [...seen].map(id=>{
    const g = GROUPES[id]; if(!g) return "";
    return `<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}</span>`;
  }).join(" ");
}

/* Rendu cartes */
function render(){
  if(!el.list) return;

  const q = (el.q?.value || "").toLowerCase().trim();
  const gsel = (el.groupe?.value || "");
  const dsel = (el.dept?.value || "");

  const arr = rows.filter(r=>{
    const g = GROUPES[r.groupe];
    const gLabel = g?.libelle || g?.sigle || r.groupe || "";
    return (!gsel || gLabel === gsel)
        && (!dsel || r.dept === dsel)
        && (!q || [r.nom, r.circo, r.dept, gLabel, g?.sigle, r.email].some(v => (v||"").toLowerCase().includes(q)));
  }).sort((a,b)=> noDia(a.nom).localeCompare(noDia(b.nom),'fr',{sensitivity:'base'}));

  el.list.innerHTML = arr.map(r=>{
    const g = GROUPES[r.groupe] || { sigle:r.groupe, libelle:r.groupe, couleur:"#777" };
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";

    // *** Photo: on extrait UNIQUEMENT les chiffres ***
    const idNum = onlyDigits(r.id);
    const img = idNum
      ? `<img class="depute-photo"
               src="${photoUrlNum(idNum,17)}?v=${Date.now()}"
               alt="Photo ${esc(r.nom)}"
               referrerpolicy="no-referrer"
               onerror="onImgErrNum(this,'${idNum}',17)">`
      : `<img class="depute-photo" src="${placeholderDataURI()}" alt="Photo indisponible">`;

    return `
      <article class="depute-card">
        <div class="depute-photo-wrap">${img}</div>
        <div class="depute-body">
          <h3 class="depute-name">${esc(r.nom || "--")}</h3>
          <div class="depute-lines">
            <div>Circo <strong>${esc(r.circo || "--")}</strong> · ${esc(r.dept || "--")}</div>
            <div>Groupe : <span class="depute-groupe" style="color:${g.couleur}" title="${esc(g.libelle)}">${esc(g.sigle)}</span></div>
            <div>${mail}</div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  el.count && (el.count.textContent = `${arr.length} député·e·s affiché·e·s`);
}

/* Listeners */
el.q     && el.q.addEventListener("input", render);
el.groupe&& el.groupe.addEventListener("change", render);
el.dept  && el.dept.addEventListener("change", render);

/* Init */
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    rows = (rows||[]).filter(d => d && d.id && d.nom);
    const seen = new Set();
    rows = rows.filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)));

    hydrateFilters();
    renderLegend();
    render();
  }catch(e){
    showError("Impossible de charger ./deputes.json.", e);
    el.count && (el.count.textContent = "Erreur de chargement");
  }
})();