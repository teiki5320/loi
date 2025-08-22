/*************************************************
 * Députés -- cartes + filtres + photos + groupes
 * Source locale : ./deputes.json (généré par GitHub Actions)
 *************************************************/

/* =========================
   1) Configuration / Const
   ========================= */

const URL_DEPUTES = "./deputes.json"; // depuis /deputes/index_depute.html

// Groupes (ID AN -> sigle, nom complet, couleur)
const GROUPES = {
  "PO800490": { sigle: "RE",   nom: "Renaissance",                         couleur: "#ffd700" },
  "PO800491": { sigle: "RN",   nom: "Rassemblement national",              couleur: "#1e90ff" },
  "PO800492": { sigle: "LFI",  nom: "La France insoumise - NUPES",         couleur: "#ff1493" },
  "PO800493": { sigle: "SOC",  nom: "Socialistes et apparentés - NUPES",   couleur: "#dc143c" },
  "PO800494": { sigle: "LR",   nom: "Les Républicains",                    couleur: "#4169e1" },
  "PO800495": { sigle: "EELV", nom: "Écologistes - NUPES",                 couleur: "#228b22" },
  "PO800496": { sigle: "DEM",  nom: "Démocrates (MoDem et Indépendants)",  couleur: "#20b2aa" },
  "PO845485": { sigle: "HOR",  nom: "Horizons et apparentés",              couleur: "#8a2be2" },
  "PO845454": { sigle: "UDI",  nom: "UDI et Indépendants",                 couleur: "#6495ed" },
  "PO845429": { sigle: "LIOT", nom: "Libertés, Indépendants, Outre-mer et Territoires", couleur: "#8b4513" },
  "PO845452": { sigle: "GDR",  nom: "Gauche démocrate et républicaine - NUPES",          couleur: "#b22222" },
  "PO845470": { sigle: "NUP",  nom: "Non‑inscrits proches NUPES / divers NUPES",         couleur: "#ff4500" },
};

/* =============
   2) Sélecteurs
   ============= */

const el = {
  q:       document.getElementById("q"),
  groupe:  document.getElementById("groupe"),
  dept:    document.getElementById("dept"),
  count:   document.getElementById("count"),
  err:     document.getElementById("err"),
  list:    document.getElementById("deputes-list"),
  legend:  document.getElementById("groupes-legend"),
};

/* ===========
   3) État
   =========== */

let rows = [];             // [{id, nom, circo, dept, groupe, email}]
let sortK = "nom";         // tri alpha par défaut
let sortAsc = true;

/* ==================
   4) Petites utilités
   ================== */

const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[m]));
const showError = (msg,e) => { if (el.err) el.err.textContent = msg + (e? "\n"+(e.message||e):""); console.error(msg,e); };

/* ============================
   5) Gestion des photos députés
   ============================ */

// SVG fallback
function fallbackPhoto() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='92' height='92'>" +
    "<rect width='100%' height='100%' fill='#f0f0f0'/>" +
    "<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' " +
    "font-family='sans-serif' font-size='12' fill='#999'>photo</text></svg>"
  );
}

// Génère une liste d'URLs candidates à tester
function candidatePhotoUrls(id) {
  if (!id) return [];
  const plain  = id.replace(/^PA/i, "");        // supprime "PA"
  const digits = (id.match(/\d+/)||[""])[0];    // ne garde que les chiffres, si dispo

  const bases = [
    "https://www2.assemblee-nationale.fr/static/tribun/17/photos/",
    "https://www2.assemblee-nationale.fr/static/tribun/16/photos/",
    "https://www2.assemblee-nationale.fr/static/tribun/15/photos/",
  ];
  const names = [
    id + ".jpg", id + ".JPG",
    plain + ".jpg", plain + ".JPG",
    digits + ".jpg", digits + ".JPG",
  ];

  const urls = [];
  for (const b of bases) for (const n of names) urls.push(b + n);
  return urls;
}

// URL initiale (première candidate)
function buildPhoto(id) {
  const urls = candidatePhotoUrls(id);
  return urls[0] || fallbackPhoto();
}

// Si 404, on passe à la candidate suivante
function chainOnError(img, id) {
  const urls = candidatePhotoUrls(id);
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < urls.length) img.src = urls[i];
    else { img.onerror = null; img.src = fallbackPhoto(); }
  };
}

/* ==========================
   6) Filtres & légende groupes
   ========================== */

function hydrateFilters() {
  if (!el.groupe || !el.dept) return;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,"fr",{sensitivity:"base"}));

  // Groupes présents (par ID)
  const groupeIds = uniq(rows.map(r => r.groupe));
  el.groupe.innerHTML =
    `<option value="">Tous groupes</option>` +
    groupeIds.map(id => {
      const g = GROUPES[id];
      const label = g ? `${g.nom} (${g.sigle})` : id;  // nom complet + sigle
      return `<option value="${id}">${esc(label)}</option>`;
    }).join("");

  // Départements
  const depts = uniq(rows.map(r => r.dept));
  el.dept.innerHTML =
    `<option value="">Tous départements</option>` +
    depts.map(d=>`<option>${esc(d)}</option>`).join("");
}

function renderLegend() {
  if (!el.legend) return;
  const idsPresents = new Set(rows.map(r => r.groupe).filter(Boolean));
  const items = [];
  idsPresents.forEach(id => {
    const g = GROUPES[id];
    if (!g) return;
    items.push(
      `<span class="legend-item"><span class="legend-dot" style="background:${g.couleur}"></span>${esc(g.sigle)}</span>`
    );
  });
  el.legend.innerHTML = items.join("") || "";
}

/* ===============
   7) Rendu principal
   =============== */

function render() {
  if (!el.list) return;

  const q    = (el.q?.value || "").trim().toLowerCase();
  const gsel = (el.groupe?.value || "");   // ID du groupe
  const dsel = (el.dept?.value || "");

  let filtered = rows.filter(r =>
    (!gsel || r.groupe === gsel) &&
    (!dsel || r.dept === dsel) &&
    (!q || [r.nom, r.circo, r.dept, (GROUPES[r.groupe]?.sigle || r.groupe), r.email]
      .some(x => (x||"").toLowerCase().includes(q)))
  );

  // tri simple alpha
  filtered.sort((a,b)=>{
    const va = noDia((a[sortK]||"")+"").toLowerCase();
    const vb = noDia((b[sortK]||"")+"").toLowerCase();
    return sortAsc ? (va>vb?1:va<vb?-1:0) : (va<vb?1:va>vb?-1:0);
  });

  el.list.innerHTML = filtered.map(r => {
    const g = GROUPES[r.groupe] || { sigle: r.groupe, nom: r.groupe, couleur: "#999" };
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
            Groupe :
            <span class="depute-groupe"
                  style="color:${g.couleur}"
                  title="${esc(g.nom)}">${esc(g.sigle)}</span>
          </div>
          <div class="depute-meta">
            ${mail}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // cascade de fallback pour les photos
  filtered.forEach(r => {
    const img = document.getElementById(`img-${r.id}`);
    if (img) chainOnError(img, r.id);
  });

  if (el.count) el.count.textContent = `${filtered.length} député·e·s affiché·e·s`;
}

/* =================
   8) Écouteurs UI
   ================= */

el.q      && el.q.addEventListener("input", render);
el.groupe && el.groupe.addEventListener("change", render);
el.dept   && el.dept.addEventListener("change", render);

/* =============
   9) Initialisation
   ============= */

(async function init(){
  try{
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`, { cache:"no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows = await r.json();

    // sécurité : ne garder que les entrées avec un nom
    rows = (rows || []).filter(d => d && (d.nom || "").trim().length);

    // dédoublonnage léger
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