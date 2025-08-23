/*************************************************
 * Députés -- cartes + photos + mapping groupes
 * Données locales : ./deputes.json (généré par Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";

/* Groupes (codes → sigle + nom + couleur) */
const GROUPES = {
  "PO800490": { sigle: "RE",  nom: "Renaissance",                             couleur: "#ffd700" },
  "PO800491": { sigle: "RN",  nom: "Rassemblement national",                  couleur: "#1e90ff" },
  "PO800492": { sigle: "LFI", nom: "La France insoumise",                     couleur: "#ff1493" },
  "PO800493": { sigle: "SOC", nom: "Socialistes et apparentés",               couleur: "#dc143c" },
  "PO800494": { sigle: "LR",  nom: "Les Républicains",                        couleur: "#4169e1" },
  "PO800495": { sigle: "EELV",nom: "Écologistes",                             couleur: "#228b22" },
  "PO845485": { sigle: "HOR", nom: "Horizons & Indépendants",                 couleur: "#8a2be2" },
  "PO845454": { sigle: "UDI", nom: "UDI et Indépendants",                     couleur: "#6495ed" },
  "PO845429": { sigle: "LIOT",nom: "Libertés, Indépendants, Outre‑mer…",      couleur: "#8b4513" },
  "PO800496": { sigle: "DEM", nom: "Les Démocrates (MoDem & Ind.)",           couleur: "#20b2aa" },
  "PO845452": { sigle: "GDR", nom: "Gauche Démocrate et Républicaine",        couleur: "#b22222" },
  "PO845470": { sigle: "NUP", nom: "Non‑inscrits proches NUPES / divers NUPES",couleur: "#ff4500" },
};

const $ = sel => document.querySelector(sel);
const els = {
  q:       $("#q"),
  groupe:  $("#groupe"),
  dept:    $("#dept"),
  legend:  $("#groupes-legend"),
  count:   $("#count"),
  err:     $("#err"),
  list:    $("#deputes-list"),
};

let rows = [];
let sortK = "nom";
let sortAsc = true;

/* Helpers */
const esc = s => (s||"").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function photoSrc17(id){ return `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`; }
function photoSrc16(id){ return `https://www2.assemblee-nationale.fr/static/tribun/16/photos/${id}.jpg`; }
function photoSrc15(id){ return `https://www2.assemblee-nationale.fr/static/tribun/15/photos/${id}.jpg`; }
function fallbackSvg(){
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'>
       <rect width='100%' height='100%' rx='8' ry='8' fill='#eef1f5'/>
       <text x='50%' y='52%' text-anchor='middle' font-family='system-ui' font-size='12' fill='#9aa3ae'>photo</text>
     </svg>`
  );
}
function chainOnError(img,id){
  const chain = [photoSrc17(id), photoSrc16(id), photoSrc15(id), fallbackSvg()];
  let i = 1;
  img.onerror = () => { if(i < chain.length){ img.src = chain[i++]; } else { img.onerror=null; } };
}

/* Filtres */
function hydrateFilters(){
  if(!els.groupe || !els.dept) return;
  const uniqSort = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,'fr',{sensitivity:'base'}));

  const groupesAff = uniqSort(rows.map(r => GROUPES[r.groupe]?.nom || GROUPES[r.groupe]?.sigle || r.groupe));
  els.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupesAff.map(g => `<option>${esc(g)}</option>`).join("");

  const depts = uniqSort(rows.map(r => r.dept));
  els.dept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d => `<option>${esc(d)}</option>`).join("");
}

function renderLegend(){
  if(!els.legend) return;
  const seen = new Set(rows.map(r => r.groupe).filter(Boolean));
  const items = [];
  seen.forEach(id => {
    const g = GROUPES[id];
    if(!g) return;
    items.push(`<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.nom || g.sigle)}</span>`);
  });
  els.legend.innerHTML = items.join(" ");
}

/* Rendu cartes */
function render(){
  if(!els.list) return;

  const q = (els.q?.value || "").toLowerCase().trim();
  const gsel = (els.groupe?.value || "");
  const dsel = (els.dept?.value || "");

  let filt = rows.filter(r =>
    (!gsel || (GROUPES[r.groupe]?.nom || GROUPES[r.groupe]?.sigle || r.groupe) === gsel) &&
    (!dsel || r.dept === dsel) &&
    (!q || [r.nom, r.circo, r.dept, GROUPES[r.groupe]?.nom, GROUPES[r.groupe]?.sigle, r.email]
          .some(v => (v||"").toLowerCase().includes(q)))
  );

  // tri simple
  filt.sort((a,b)=>{
    const A = noDia((a[sortK]||"")+"").toLowerCase();
    const B = noDia((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (A>B?1:A<B?-1:0) : (A<B?1:A>B?-1:0);
  });

  els.list.innerHTML = filt.map(r=>{
    const g = GROUPES[r.groupe] || { sigle: r.groupe, nom: r.groupe, couleur:"#777" };
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "";
    const pid = `img-${esc(r.id)}`;
    return `
      <article class="depute-card">
        <div class="depute-photo-wrap">
          <img id="${pid}" class="depute-photo" alt="Photo ${esc(r.nom)}" src="${photoSrc17(r.id)}">
        </div>
        <div class="depute-body">
          <h3 class="depute-name">${esc(r.nom)}</h3>
          <div class="depute-lines">
            <div>Circo <strong>${esc(r.circo || "--")}</strong> · ${esc(r.dept || "--")}</div>
            <div>Groupe :
              <span class="depute-groupe" style="color:${g.couleur}">${esc(g.nom || g.sigle)}</span>
            </div>
            <div>${mail}</div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // chaînage des photos
  filt.forEach(r=>{
    const img = document.getElementById(`img-${r.id}`);
    if(img) chainOnError(img, r.id);
  });

  if(els.count) els.count.textContent = `${filt.length} député·e·s affiché·e·s`;
}

/* Listeners */
els.q?.addEventListener("input", render);
els.groupe?.addEventListener("change", render);
els.dept?.addEventListener("change", render);

/* Init */
(async function init(){
  try{
    const res = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, {cache:"no-cache"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = await res.json();

    // filtrer les entrées vides, dédoublonner
    rows = (rows||[]).filter(d => d && d.nom);
    const seen = new Set();
    rows = rows.filter(d=>{
      const k = d.id || `${d.nom}|${d.circo||""}|${d.dept||""}`;
      if(seen.has(k)) return false; seen.add(k); return true;
    });

    hydrateFilters();
    renderLegend();
    render();
  }catch(e){
    els.err && (els.err.textContent = `Erreur de chargement : ${e.message||e}`);
    console.error(e);
  }
})();