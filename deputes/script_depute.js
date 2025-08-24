/*************************************************
 * Députés -- cartes + filtres + photos fallback
 * Source : ./deputes.json (généré par Actions)
 *************************************************/

const URL_DEPUTES = "./deputes.json";

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

// --- utils
const esc = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;","&quot;":"&quot;"}[m]));
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

// === Photos : 17 -> 16 -> 15 -> placeholder
function chainOnError(img, idNum){
  const urls = [
    `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${idNum}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/16/photos/${idNum}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/15/photos/${idNum}.jpg`
  ];
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < urls.length) img.src = urls[i];
    else {
      img.onerror = null;
      img.src = "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'>
           <rect width='100%' height='100%' fill='#eee'/>
           <text x='50%' y='55%' text-anchor='middle' font-size='12'
                 font-family='sans-serif' fill='#999'>photo</text>
         </svg>`
      );
    }
  };
  // première tentative
  img.src = urls[0];
}

// pour certains navigateurs, poser no-referrer AVANT le premier src
function setNoReferrer(img){
  try {
    // attribut HTML + propriété (selon navigateur)
    img.setAttribute('referrerpolicy','no-referrer');
    img.referrerPolicy = 'no-referrer';
  } catch(_) {}
}

// === Filtres
function hydrateFilters(){
  if (!el.groupe || !el.dept) return;
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));

  const groupes = uniq(rows.map(r => r.groupeSigle || r.groupeLibelle || r.groupe || ""));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupes.map(g=>`<option>${esc(g)}</option>`).join("");

  const depts = uniq(rows.map(r => r.dept || ""));
  el.dept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

function renderLegend(){
  if (!el.legend) return;
  const seen = new Set(rows.map(r => r.groupeSigle || r.groupe).filter(Boolean));
  el.legend.innerHTML = [...seen].map(s =>
    `<span class="legend-item"><span class="legend-dot"></span>${esc(s)}</span>`
  ).join(" ");
}

// === Rendu des cartes
function render(){
  if (!el.list) return;

  const q = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");
  const dsel = (el.dept?.value || "");

  const filtered = rows.filter(r => {
    const gLabel = r.groupeSigle || r.groupeLibelle || r.groupe || "";
    return (!gsel || gLabel === gsel)
        && (!dsel || r.dept === dsel)
        && (!q || [r.nom, r.circo, r.dept, gLabel, r.email].some(x => (x||"").toLowerCase().includes(q)));
  });

  // tri par nom
  filtered.sort((a,b)=>noDia(a.nom).localeCompare(noDia(b.nom),'fr',{sensitivity:'base'}));

  el.list.innerHTML = filtered.map(r=>{
    const gLabel = r.groupeSigle || r.groupeLibelle || r.groupe || "";
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";

    return `
      <article class="depute-card">
        <div class="depute-photo-wrap">
          <img class="depute-photo" id="img-${esc(r.id)}" alt="Photo ${esc(r.nom)}">
        </div>
        <div class="depute-body">
          <h3 class="depute-name">${esc(r.nom || "--")}</h3>
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
      </article>
    `;
  }).join("");

  // charger les photos avec fallback + referrerpolicy=no-referrer
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (!img) return;
    // l'Assemblée attend l'ID NUMÉRIQUE uniquement (PA605694 -> 605694)
    const idNum = String(r.id).replace(/\D/g,"");
    setNoReferrer(img);     // <-- important AVANT de poser le src
    chainOnError(img, idNum);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

// === Listeners
el.q     && el.q.addEventListener("input", render);
el.groupe&& el.groupe.addEventListener("change", render);
el.dept  && el.dept.addEventListener("change", render);

// === Init
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    rows = (rows||[]).filter(d => d && d.nom);
    const seen = new Set();
    rows = rows.filter(d => {
      const k = d.id || d.nom;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    hydrateFilters();
    renderLegend();
    render();
  } catch(e){
    showError("Impossible de charger deputes.json.", e);
    el.count && (el.count.textContent = "Erreur de chargement");
  }
})();