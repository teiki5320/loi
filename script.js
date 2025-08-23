/*************************************************
 * Députés -- cartes + filtres (JSON enrichi)
 * JSON attendu: /loi/deputes/deputes.json
 * Champs utilisés: id, nom, email, circo, dept, groupe, sigle, groupeNom
 *************************************************/

const URL_DEPUTES = "./deputes.json";   // depuis /loi/deputes/index_depute.html

/* Couleurs par SIGLE (modifiable à souhait) */
const GROUP_COLORS = {
  RE:   "#ffd700",
  RN:   "#1e90ff",
  LFI:  "#ff1493",
  SOC:  "#dc143c",
  LR:   "#4169e1",
  EELV: "#228b22",
  HOR:  "#8a2be2",
  UDI:  "#6495ed",
  LIOT: "#8b4513",
  DEM:  "#20b2aa",
  GDR:  "#b22222",
  NUP:  "#ff4500"
};

const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend")
};

let rows = [];
let sortK = "nom";
let sortAsc = true;

/* Utils */
const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const showError = (msg,e) => { el.err && (el.err.textContent = msg + (e? "\n"+(e.message||e):"")); console.error(msg,e); };

/* Photos */
function buildPhoto(id) {
  if (!id) {
    return "data:image/svg+xml;utf8," +
      "<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'>" +
      "<rect width='100%' height='100%' fill='%23f0f0f0'/>" +
      "<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' " +
      "font-family='sans-serif' font-size='12' fill='%23999'>photo</text></svg>";
  }
  return `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`;
}
function chainOnError(img, id) {
  const order = [
    `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/16/photos/${id}.jpg`,
    `https://www2.assemblee-nationale.fr/static/tribun/15/photos/${id}.jpg`
  ];
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < order.length) img.src = order[i];
    else { img.onerror = null; img.src = buildPhoto(""); }
  };
}

/* Filtres (menu groupe = libellé long + sigle) */
function hydrateFilters() {
  if (!el.groupe || !el.dept) return;

  const uniq = a => [...new Set(a.filter(Boolean))];

  // options groupes visibles (présents dans les données)
  const gs = uniq(rows.map(r => `${r.groupeNom || r.sigle || r.groupe || "Autre"}|||${r.sigle || ""}`));
  gs.sort((a,b) => {
    const an = a.split("|||")[0], bn = b.split("|||")[0];
    return an.localeCompare(bn, "fr", {sensitivity:"base"});
  });

  el.groupe.innerHTML =
    `<option value="">Tous groupes</option>` +
    gs.map(s => {
      const [nom, sig] = s.split("|||");
      const label = sig ? `${esc(nom)} (${esc(sig)})` : esc(nom);
      // on filtre par sigle si dispo, sinon par nom long
      const value = sig || nom;
      return `<option value="${esc(value)}">${label}</option>`;
    }).join("");

  const depts = uniq(rows.map(r => r.dept)).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
  el.dept.innerHTML =
    `<option value="">Tous départements</option>` +
    depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

/* Légende (optionnelle) */
function renderLegend() {
  if (!el.legend) return;
  const seen = new Set();
  const items = [];
  rows.forEach(r => {
    const sig = r.sigle || "";
    if (!sig || seen.has(sig)) return;
    seen.add(sig);
    const col = GROUP_COLORS[sig] || "#999";
    const nom = r.groupeNom || sig;
    items.push(`<span class="legend-item"><span class="legend-dot" style="background:${col}"></span>${esc(nom)} (${esc(sig)})</span>`);
  });
  el.legend.innerHTML = items.join(" ");
}

/* Rendu */
function render() {
  if (!el.list) return;

  const q = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");
  const dsel = (el.dept?.value || "");

  let filtered = rows.filter(r => {
    const sig = r.sigle || "";
    const nomLong = r.groupeNom || "";
    const matchGroup = !gsel || sig === gsel || nomLong === gsel;
    const matchDept  = !dsel || r.dept === dsel;
    const hay = [r.nom, r.circo, r.dept, sig, nomLong, r.email].join(" ").toLowerCase();
    const matchQ = !q || hay.includes(q);
    return matchGroup && matchDept && matchQ;
  });

  // tri alphabétique par défaut (nom)
  filtered.sort((a,b)=>{
    const va = noDia((a[sortK]||"")+"").toLowerCase();
    const vb = noDia((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.list.innerHTML = filtered.map(r => {
    const sig = r.sigle || r.groupe || "";
    const col = GROUP_COLORS[sig] || "#999";
    const nomG = r.groupeNom || sig || "--";
    const mail = r.email ? `<a href="mailto:${encodeURI(r.email)}">${esc(r.email)}</a>` : "--";
    const photo = buildPhoto(r.id);
    return `
      <div class="depute-card">
        <div>
          <img class="depute-photo" src="${photo}" alt="Photo ${esc(r.nom)}" id="img-${esc(r.id)}">
        </div>
        <div>
          <div class="depute-header">${esc(r.nom)}</div>
          <div class="depute-meta">
            <span class="chip">Circo ${esc(r.circo || "--")}</span>
            <span class="chip">${esc(r.dept || "--")}</span>
          </div>
          <div class="depute-meta">
            Groupe :
            <span class="depute-groupe" title="${esc(nomG)}" style="color:${col}">${esc(sig || "--")}</span>
            <span class="muted" style="margin-left:.35rem">${esc(nomG)}</span>
          </div>
          <div class="depute-meta">
            ${mail}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // fallback photo
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (img) chainOnError(img, r.id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

/* Listeners */
el.q     && el.q.addEventListener("input", render);
el.groupe&& el.groupe.addEventListener("change", render);
el.dept  && el.dept.addEventListener("change", render);

/* Init */
(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // garde-fous
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
    showError("Impossible de charger deputes.json.", e);
    if (el.count) el.count.textContent = "Erreur de chargement";
  }
})();