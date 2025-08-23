/*************************************************
 * Députés -- cartes en grille + filtres + photos
 * Source : ./deputes.json (généré par GitHub Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";

/* Mapping groupes */
const GROUPES = {
  "PO800490": { sigle:"RE",  nom:"Renaissance",                                            couleur:"#ffd700" },
  "PO800491": { sigle:"RN",  nom:"Rassemblement national",                                 couleur:"#1e90ff" },
  "PO800492": { sigle:"LFI", nom:"La France insoumise - NUPES",                            couleur:"#ff1493" },
  "PO800493": { sigle:"SOC", nom:"Socialistes et apparentés - NUPES",                      couleur:"#dc143c" },
  "PO800494": { sigle:"LR",  nom:"Les Républicains",                                       couleur:"#4169e1" },
  "PO800495": { sigle:"EELV",nom:"Écologistes - NUPES",                                    couleur:"#228b22" },
  "PO800496": { sigle:"DEM", nom:"Démocrates (MoDem et Indépendants)",                     couleur:"#20b2aa" },
  "PO845485": { sigle:"HOR", nom:"Horizons et apparentés",                                 couleur:"#8a2be2" },
  "PO845454": { sigle:"UDI", nom:"UDI et Indépendants",                                    couleur:"#6495ed" },
  "PO845429": { sigle:"LIOT",nom:"Libertés, Indépendants, Outre‑mer et Territoires",       couleur:"#8b4513" },
  "PO845452": { sigle:"GDR", nom:"Gauche démocrate et républicaine - NUPES",               couleur:"#b22222" },
  "PO845470": { sigle:"NUP", nom:"Non‑inscrits proches NUPES / divers NUPES",              couleur:"#ff4500" },
};

const el = {
  q:      document.getElementById("q"),
  groupe: document.getElementById("groupe"),
  dept:   document.getElementById("dept"),
  count:  document.getElementById("count"),
  err:    document.getElementById("err"),
  list:   document.getElementById("deputes-list"),
  legend: document.getElementById("groupes-legend"),
};

let rows = [];
const esc = s => (s||"").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const showError = (m,e)=>{ el.err.textContent=m+(e?`\n${e.message||e}`:""); console.error(m,e); };

/* Photos : essais multiples (17→16→15 + variantes nom) */
const fallbackPhoto = () =>
  "data:image/svg+xml;utf8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'><rect width='100%' height='100%' fill='#eef1f6'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='#99a'>photo</text></svg>");

function candidates(id){
  if(!id) return [];
  const plain=id.replace(/^PA/i,"");
  const digits=(id.match(/\d+/)||[""])[0];
  const bases=["https://www2.assemblee-nationale.fr/static/tribun/17/photos/","https://www2.assemblee-nationale.fr/static/tribun/16/photos/","https://www2.assemblee-nationale.fr/static/tribun/15/photos/"];
  const names=[`${id}.jpg`,`${id}.JPG`,`${plain}.jpg`,`${plain}.JPG`,`${digits}.jpg`,`${digits}.JPG`];
  const out=[]; for(const b of bases) for(const n of names) out.push(b+n); return out;
}
const buildPhoto = id => (candidates(id)[0] || fallbackPhoto());
function chainOnError(img,id){
  const urls=candidates(id); let i=0;
  img.onerror=()=>{ i++; if(i<urls.length) img.src=urls[i]; else { img.onerror=null; img.src=fallbackPhoto(); } };
}

/* Filtres & légende */
function hydrateFilters(){
  const uniq = a => [...new Set(a.filter(Boolean))].sort();
  // Groupes (libellé = nom + sigle)
  const ids = uniq(rows.map(r=>r.groupe));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` +
    ids.map(id=>{
      const g=GROUPES[id]; const label=g?`${g.nom} (${g.sigle})`:id;
      return `<option value="${id}">${esc(label)}</option>`;
    }).join("");
  // Départements
  const depts = uniq(rows.map(r=>r.dept));
  el.dept.innerHTML = `<option value="">Tous départements</option>` +
    depts.map(d=>`<option>${esc(d)}</option>`).join("");
}
function renderLegend(){
  const present=new Set(rows.map(r=>r.groupe).filter(Boolean));
  el.legend.innerHTML=[...present].map(id=>{
    const g=GROUPES[id]; if(!g) return "";
    return `<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}</span>`;
  }).join("");
}

/* Rendu cartes (grille) */
function render(){
  const q=(el.q.value||"").toLowerCase().trim();
  const gsel=el.groupe.value||"";
  const dsel=el.dept.value||"";

  const filtered = rows.filter(r =>
    (!gsel || r.groupe===gsel) &&
    (!dsel || r.dept===dsel) &&
    (!q || [r.nom,r.circo,r.dept,(GROUPES[r.groupe]?.sigle||r.groupe),r.email].some(x=>(x||"").toLowerCase().includes(q)))
  );

  el.list.innerHTML = filtered.map(r=>{
    const g = GROUPES[r.groupe] || { sigle:r.groupe, nom:r.groupe, couleur:"#999" };
    const photo = buildPhoto(r.id);
    const mail  = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";
    return `
      <article class="card">
        <img class="photo" src="${photo}" alt="Photo ${esc(r.nom)}" id="img-${esc(r.id)}">
        <div>
          <h3 class="title">${esc(r.nom)}</h3>
          <div class="chips">
            <span class="chip">Circo ${esc(r.circo||"--")}</span>
            <span class="chip">${esc(r.dept||"--")}</span>
            <span class="chip groupe" style="color:${g.couleur}" title="${esc(g.nom)}">${esc(g.sigle)}</span>
          </div>
          <div class="meta">Groupe : ${esc(g.nom)}</div>
          <div class="meta">${mail}</div>
        </div>
      </article>
    `;
  }).join("");

  // fallback photos
  filtered.forEach(r=>{
    const img=document.getElementById(`img-${r.id}`);
    if(img) chainOnError(img, r.id);
  });

  el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

/* Events */
el.q.addEventListener("input", render);
el.groupe.addEventListener("change", render);
el.dept.addEventListener("change", render);

/* Init */
(async function(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`,{cache:"no-cache"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = (await r.json() || []).filter(d=>d && (d.nom||"").trim());

    // dédoublonnage défensif
    const seen=new Set();
    rows = rows.filter(d=>{ const k=d.id||`${d.nom}|${d.circo}|${d.dept}`; if(seen.has(k)) return false; seen.add(k); return true; });

    hydrateFilters();
    renderLegend();
    render();
  }catch(e){ showError("Impossible de charger deputes.json.", e); }
})();