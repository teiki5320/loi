// ==============================
//  Config
// ==============================
const WORKER_BASE = "https://loi-api.teiki5320.workers.dev"; // ton worker
const qs = new URLSearchParams(location.search);
const workerBase = (qs.get("worker") || WORKER_BASE).replace(/\/$/, "");

// ==============================
//  Eléments DOM
// ==============================
const yearSelect = document.getElementById("yearSelect");
const loadBtn    = document.getElementById("loadBtn");
const cardsRoot  = document.getElementById("cards");

let allResults = []; // toutes les lois

// ==============================
//  Utils
// ==============================
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[m]));
const first = (a) => (Array.isArray(a) && a.length ? a[0] : null);

function normalizeItem(r){
  const t0 = first(r?.titles) || {};
  const titre = (t0.title || r.title || r.titre || "").replace(/<\/?mark>/g,"");
  const cid   = t0.cid || r.cid || r.cidTexte || "";
  const nature= String(r.nature||"").toUpperCase();
  const statut= String(r.statut || r.legalStatus || r.etat || "").toUpperCase();
  const date  = r.date || r.datePublication || r.dateSignature || "";
  const nor   = r.nor || "";
  return { titre, cid, nature, statut, date, nor, _raw:r };
}

// ==============================
//  Peupler années
// ==============================
(function fillYears(){
  if (!yearSelect) return;
  const now = new Date().getFullYear();
  let html = "";
  for (let y = now; y >= 2010; y--){
    html += `<option value="${y}" ${y===now ? "selected":""}>${y}</option>`;
  }
  yearSelect.innerHTML = html;
})();

// ==============================
//  Rendu (toutes les lois)
// ==============================
function renderAll(){
  cardsRoot.innerHTML = "";
  if (!allResults.length){
    cardsRoot.innerHTML = `<div class="info">Aucun résultat.</div>`;
    return;
  }

  for (const raw of allResults){
    const it = normalizeItem(raw);
    const dateShort = it.date ? String(it.date).slice(0,10) : "";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${esc(it.titre || "Sans titre")}</h3>
      <div class="meta">
        ${it.nature ? `<span class="badge">${esc(it.nature)}</span>` : ""}
        ${it.statut ? `<span class="badge">${esc(it.statut)}</span>` : ""}
        ${dateShort ? `<span class="badge">${esc(dateShort)}</span>` : ""}
      </div>
      <div class="meta small">NOR : ${esc(it.nor || "—")}</div>
      <a class="button" href="#">Voir les détails</a>
    `;
    card.querySelector("a.button").addEventListener("click", (e)=>{
      e.preventDefault();
      if (!it.cid){ alert("CID manquant"); return; }
      const url = `${workerBase}/lois/${encodeURIComponent(it.cid)}?title=${encodeURIComponent(it.titre||"")}`;
      window.open(url, "_blank", "noopener");
    });
    cardsRoot.appendChild(card);
  }
}

// ==============================
//  Chargement
// ==============================
async function loadYear(){
  const year = yearSelect ? yearSelect.value : new Date().getFullYear();
  const bust = Date.now();
  cardsRoot.innerHTML = `<div class="info">Chargement des textes ${esc(year)}…</div>`;

  const url = `${workerBase}/api/lois/fullyear?year=${encodeURIComponent(year)}&includeOrdonnances=1&_t=${bust}`;

  try{
    const r = await fetch(url, { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    allResults = Array.isArray(j.results) ? j.results : [];
    renderAll();
  }catch(e){
    console.error(e);
    cardsRoot.innerHTML = `<div class="info">Erreur : ${esc(e.message||e)}</div>`;
  }
}

if (loadBtn) loadBtn.addEventListener("click", loadYear);
loadYear();