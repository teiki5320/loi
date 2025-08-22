/*************************************************
 * Députés -- lecture d'un JSON local
 * Fichier attendu : /deputes/deputes.json
 * Format : [{ id, nom, circo, dept, groupe, email }, ...]
 *************************************************/

const LOCAL_JSON = "./deputes.json"; // chemin depuis /deputes/index_depute.html

// --- DOM
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

// --- Utils
const noDia = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s || "").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
function showError(msg, e){
  el.err.textContent = msg + (e ? "\n" + (e.message || e) : "");
  console.error(msg, e);
}

// --- Filtres + rendu
function hydrateFilters(){
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));
  const groupes = uniq(rows.map(r=>r.groupe));
  const depts   = uniq(rows.map(r=>r.dept));
  el.groupe.innerHTML = `<option value="">Tous groupes</option>` + groupes.map(g=>`<option>${esc(g)}</option>`).join("");
  el.dept.innerHTML   = `<option value="">Tous départements</option>` + depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

function render(){
  const q = el.q.value.trim().toLowerCase();
  const g = el.groupe.value, d = el.dept.value;

  let filtered = rows.filter(r =>
    (!g || r.groupe === g) &&
    (!d || r.dept === d) &&
    (!q || [r.nom, r.circo, r.dept, r.groupe, r.email].some(x => (x||"").toLowerCase().includes(q)))
  );

  filtered.sort((a,b)=>{
    const va = noDia((a[sortK]||"")+"").toLowerCase();
    const vb = noDia((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.tbody.innerHTML = filtered.map(r=>`
    <tr>
      <td>${esc(r.nom)}</td>
      <td>${esc(r.circo || "")}</td>
      <td><span class="chip">${esc(r.dept || "")}</span></td>
      <td><span class="chip">${esc(r.groupe || "")}</span></td>
      <td>${r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : ""}</td>
    </tr>
  `).join("");

  el.count.textContent = `${filtered.length} député·e·s affiché·e·s (sur ${rows.length})`;
}

// --- Listeners
el.q.addEventListener("input", render);
el.groupe.addEventListener("change", render);
el.dept.addEventListener("change", render);
el.ths.forEach(th => th.addEventListener("click", ()=>{
  const k = th.dataset.k;
  if (sortK === k) sortAsc = !sortAsc; else { sortK = k; sortAsc = true; }
  render();
}));

// --- Init
(async function init(){
  try{
    // cache-busting pour forcer le navigateur à recharger le JSON après un nouveau run d’Actions
    const url = `${LOCAL_JSON}?v=${Date.now()}`;
    const r = await fetch(url, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // dédoublonnage
    const seen = new Set();
    rows = rows.filter(r=>{
      const key = r.id || `${r.nom}|${r.circo||""}|${r.dept||""}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });

    if (!rows.length) showError("Aucune donnée locale (deputes.json). Lance/relance le workflow ‘Update deputes.json’.");    
    hydrateFilters();
    render();
  }catch(e){
    showError("Impossible de charger le fichier local deputes.json.", e);
    el.count.textContent = "Erreur de chargement";
  }finally{
    const s = document.querySelector(".spinner"); if (s) s.remove();
  }
})();