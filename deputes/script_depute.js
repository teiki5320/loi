/***********************
 * Députés -- multi-endpoints avec proxys CORS
 ***********************/

const ENDPOINTS = [
  // Directs
  "https://data.assemblee-nationale.fr/api/records/1.0/search/?dataset=deputes-en-exercice&rows=500",
  "https://data.assemblee-nationale.fr/api/explore/v2.1/catalog/datasets/deputes-en-exercice/records?limit=500",
  // Proxys CORS
  "https://corsproxy.io/?https://data.assemblee-nationale.fr/api/records/1.0/search/?dataset=deputes-en-exercice&rows=500",
  "https://corsproxy.io/?https://data.assemblee-nationale.fr/api/explore/v2.1/catalog/datasets/deputes-en-exercice/records?limit=500",
  "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://data.assemblee-nationale.fr/api/records/1.0/search/?dataset=deputes-en-exercice&rows=500"),
];

// DOM
const el = {
  q: document.getElementById("q"),
  groupe: document.getElementById("groupe"),
  dept: document.getElementById("dept"),
  count: document.getElementById("count"),
  err: document.getElementById("err"),
  tbody: document.querySelector("#tab tbody"),
  ths: [...document.querySelectorAll("th[data-k]")]
};

let rows = [];
let sortK = "nom", sortAsc = true;

// Utils
function showError(msg, e){
  el.err.textContent = msg + (e ? "\n" + (e.stack || e.message || e) : "");
  console.error(msg, e);
}
const noDiacritics = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const escapeHTML = s => (s||"").replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

// Fetch avec essais successifs
async function fetchAny(){
  let lastErr;
  for (const url of ENDPOINTS){
    try{
      const r = await fetch(url, { mode:"cors", cache:"no-cache", headers: { "Accept":"application/json" }});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch(e){
      lastErr = e;
      console.warn("ESSAI KO →", url, e?.message || e);
    }
  }
  throw lastErr || new Error("Tous les endpoints ont échoué");
}

// Normalisation v1 (records[].fields) ou v2.1 (results[])
function mapODS(json){
  const v1 = Array.isArray(json.records);
  const recs = v1 ? json.records : (json.results || []);
  return recs.map(rec=>{
    const f = v1 ? (rec.fields || {}) : rec;

    const prenom = f.prenom_usuel || f.prenom || f.prenom_etat_civil || "";
    const nomFam = f.nom_civil || f.nom || f.nom_de_famille || f.nom_usuel || "";
    const nom = [prenom, nomFam].filter(Boolean).join(" ").trim();
    if (!nom) return null;

    const circo  = f.lib_circo || f.circonscription || "";
    const dept   = f.lib_dept || f.departement || f.libelle_departement || "";
    const groupe = f.groupe_sigle || f.groupe || f.groupe_libelle || "";
    const email  = f.mail || f.email || "";

    const id = (v1 ? rec.recordid : f.uid) || `${nom}|${circo}|${dept}`;
    return { id, nom, circo, dept, groupe, email };
  }).filter(Boolean);
}

function hydrateFilters(){
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
  const groupes = uniq(rows.map(r=>r.groupe));
  const depts   = uniq(rows.map(r=>r.dept));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupes.map(g=>`<option>${escapeHTML(g)}</option>`).join("");
  el.dept.innerHTML   = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${escapeHTML(d)}</option>`).join("");
}

function render(){
  const q = el.q.value.trim().toLowerCase();
  const g = el.groupe.value;
  const d = el.dept.value;

  let filtered = rows.filter(r =>
    (!g || r.groupe === g) &&
    (!d || r.dept === d) &&
    (!q || [r.nom, r.circo, r.dept, r.groupe, r.email].some(x => (x||"").toLowerCase().includes(q)))
  );

  filtered.sort((a,b)=>{
    const va = noDiacritics((a[sortK]||"")+"").toLowerCase();
    const vb = noDiacritics((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.tbody.innerHTML = filtered.map(r=>`
    <tr>
      <td>${escapeHTML(r.nom||"")}</td>
      <td>${escapeHTML(r.circo||"")}</td>
      <td><span class="chip">${escapeHTML(r.dept||"")}</span></td>
      <td><span class="chip">${escapeHTML(r.groupe||"")}</span></td>
      <td>${r.email ? `<a href="mailto:${encodeURI(r.email)}">${escapeHTML(r.email)}</a>` : ""}</td>
    </tr>
  `).join("");

  el.count.textContent = `${filtered.length} député·e·s affiché·e·s (sur ${rows.length})`;
}

// Listeners
el.q.addEventListener("input", render);
el.groupe.addEventListener("change", render);
el.dept.addEventListener("change", render);
el.ths.forEach(th => th.addEventListener("click", ()=>{
  const k = th.dataset.k;
  if (sortK === k) sortAsc = !sortAsc; else { sortK = k; sortAsc = true; }
  render();
}));

// Init
(async function init(){
  try{
    const json = await fetchAny();
    rows = mapODS(json);

    // dédoublonnage
    const seen = new Set();
    rows = rows.filter(r=>{
      const key = r.id || r.nom + "|" + (r.circo||"") + "|" + (r.dept||"");
      if (seen.has(key)) return false; seen.add(key); return true;
    });

    if (!rows.length) showError("Aucune donnée normalisée. Le dataset a peut‑être changé de schéma.");
    hydrateFilters();
    render();
  }catch(e){
    showError("Impossible de charger la liste (tous endpoints).", e);
  }finally{
    const s = document.querySelector(".spinner"); if (s) s.remove();
  }
})();