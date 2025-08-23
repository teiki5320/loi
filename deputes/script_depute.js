/*************************************************
 * Députés -- cartes + groupes + photos
 * Données : /loi/deputes/deputes.json
 *************************************************/
const URL_DEPUTES = "/loi/deputes/deputes.json";

/* PO → {sigle, nom, couleur}  (exhaustif côté AN non garanti) */
const GROUPES = {
  "PO800490": { sigle:"RE",  nom:"Renaissance",                              couleur:"#ffd700" },
  "PO800491": { sigle:"RN",  nom:"Rassemblement National",                   couleur:"#1e90ff" },
  "PO800492": { sigle:"LFI", nom:"La France insoumise",                      couleur:"#ff1493" },
  "PO800493": { sigle:"SOC", nom:"Socialistes et apparentés (SOC)",          couleur:"#c62535" },
  "PO800494": { sigle:"LR",  nom:"Les Républicains",                          couleur:"#4169e1" },
  "PO800495": { sigle:"EELV",nom:"Écologiste et Social (ÉcoS)",              couleur:"#228b22" },
  "PO845485": { sigle:"HOR", nom:"Horizons & Indépendants (HOR)",             couleur:"#8a2be2" },
  "PO845454": { sigle:"UDI", nom:"UDI et Indépendants (UDI)",                 couleur:"#6495ed" },
  "PO845429": { sigle:"LIOT",nom:"Libertés, Indépendants, Outre‑mer, Territoires (LIOT)", couleur:"#8b4513" },
  "PO800496": { sigle:"DEM", nom:"Les Démocrates (MoDem & Ind.)",             couleur:"#20b2aa" },
  "PO845452": { sigle:"GDR", nom:"Gauche Démocrate et Républicaine (GDR)",    couleur:"#b22222" },
  "PO845470": { sigle:"NUP", nom:"Non‑inscrits proches NUPES / divers NUPES", couleur:"#ff4500" },
};

const els = {
  q:       document.getElementById("q"),
  g:       document.getElementById("groupe"),
  d:       document.getElementById("dept"),
  legend:  document.getElementById("groupes-legend"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
};

const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const esc   = s => (s??"").toString().replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));

let rows = [];

/* Photos AN : on essaye 17 puis 16 puis 15, sinon placeholder */
function photoURL(id, serie=17){
  if(!id) return "";
  return `https://www2.assemblee-nationale.fr/static/tribun/${serie}/photos/${id}.jpg`;
}
function attachFallback(img, id){
  const series=[17,16,15];
  let i=0;
  img.onerror=()=>{ i++; if(i<series.length) img.src=photoURL(id,series[i]); else img.src=placeholder(); };
}
function placeholder(){
  return "data:image/svg+xml;utf8,"+
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92"><rect width="100%" height="100%" fill="#f1f3f6"/><text x="50%" y="52%" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#9aa3ad">photo</text></svg>`);
}

/* Filtres */
function hydrateFilters(){
  if(els.g){
    const sigles=[...new Set(rows.map(r=>GROUPES[r.groupe]?.nom || GROUPES[r.groupe]?.sigle || r.groupe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
    els.g.innerHTML = `<option value="">Tous groupes</option>` + sigles.map(s=>`<option>${esc(s)}</option>`).join("");
  }
  if(els.d){
    const depts=[...new Set(rows.map(r=>r.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
    els.d.innerHTML = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
  }
}
function renderLegend(){
  if(!els.legend) return;
  const seen=new Set(rows.map(r=>r.groupe).filter(Boolean));
  els.legend.innerHTML = [...seen].map(id=>{
    const g=GROUPES[id]; if(!g) return "";
    return `<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.nom)}</span>`;
  }).join("");
}

/* Rendu cartes */
function render(){
  if(!els.list) return;
  const q=noDia(els.q?.value||"");
  const gs=els.g?.value||"";
  const ds=els.d?.value||"";

  const data = rows.filter(r=>{
    const gLabel = GROUPES[r.groupe]?.nom || GROUPES[r.groupe]?.sigle || r.groupe || "";
    return (!gs || gLabel===gs)
        && (!ds || r.dept===ds)
        && (!q || [r.nom,r.circo,r.dept,gLabel,r.email].some(x=>noDia(x).includes(q)));
  });

  els.list.innerHTML = data.map(r=>{
    const g = GROUPES[r.groupe] || { sigle:(r.groupe||"--"), nom:(r.groupe||"--"), couleur:"#999" };
    const mail = r.email ? `<a href="mailto:${encodeURIComponent(r.email)}">${esc(r.email)}</a>` : "--";
    const id = esc(r.id||"");
    const src = photoURL(id,17) || placeholder();
    return `
      <article class="dp-card">
        <img class="dp-photo" id="p-${id}" src="${src}" alt="Photo ${esc(r.nom)}" />
        <div class="dp-body">
          <h3 class="dp-name">${esc(r.nom||"--")}</h3>
          <div class="dp-chips">
            <span class="chip">Circo ${esc(r.circo||"--")}</span>
            <span class="chip">${esc(r.dept||"--")}</span>
          </div>
          <div class="dp-group">Groupe : <b style="color:${g.couleur}">${esc(g.nom)}</b></div>
          <div class="dp-mail">${mail}</div>
        </div>
      </article>`;
  }).join("");

  data.forEach(r=>{
    const img=document.getElementById("p-"+(r.id||""));
    if(img) attachFallback(img, r.id);
  });

  els.count && (els.count.textContent = `${data.length} député·e·s affiché·e·s`);
}

/* Init */
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`,{cache:"no-cache"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const arr = await r.json();
    rows = (arr||[]).filter(d=>d?.nom);

    // dédoublonnage par id
    const seen=new Set();
    rows = rows.filter(d=>{
      const k=d.id||d.nom; if(seen.has(k)) return false; seen.add(k); return true;
    });

    hydrateFilters();
    renderLegend();

    els.q     && els.q.addEventListener("input",  render);
    els.g     && els.g.addEventListener("change", render);
    els.d     && els.d.addEventListener("change", render);

    render();
  }catch(e){
    console.error(e);
    els.err && (els.err.textContent="Erreur de chargement des députés. "+(e?.message||e));
  }
})();