<!-- index.html garde #search et #lois -->
<script>
const URL_LOIS      = "/loi/lois/lois.json";
const URL_DEPUTES   = "/loi/deputes/deputes.json"; // pour résoudre les codes auteur (PAxxxx)

const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

const state={ lois:[], mapAuteur:new Map() };

async function loadJSON(url){
  const r=await fetch(url,{cache:"no-cache"});
  if(!r.ok) throw new Error(url+" → HTTP "+r.status);
  return r.json();
}

function buildAuteurMap(deputes){
  // deputes: [{id:"PA1008", nom:"…", …}]
  const m=new Map();
  (deputes||[]).forEach(d=>{
    if(d?.id && d?.nom) m.set(String(d.id), d.nom);
  });
  return m;
}

function card(loi){
  const titre = esc(loi.titre || "--");
  const type  = esc(loi.type  || "--");
  const url   = esc(loi.url   || "#");
  const date  = esc(loi.date  || "--");
  const etat  = esc(loi.etat  || "--");

  // auteur peut valoir "PA410", "PO78718", "--", etc.
  let auteurAff = loi.auteur || "--";
  // Si c’est un PAxxxx, on résout via la map
  const m = state.mapAuteur;
  if (/^PA\d+$/.test(auteurAff) && m.has(auteurAff)) {
    auteurAff = m.get(auteurAff);
  }

  return `
  <article class="card">
    <h3 class="card-title">${titre}</h3>
    <div class="card-meta">
      <div><b>Type :</b> ${type}</div>
      <div><b>Auteur :</b> ${esc(auteurAff)}</div>
      <div><b>Date :</b> ${date}</div>
      <div><b>État :</b> ${etat}</div>
    </div>
    <a class="card-link" href="${url}" target="_blank" rel="noopener">Voir le dossier</a>
  </article>`;
}

function render(){
  const q = document.getElementById("search")?.value || "";
  const nq = norm(q);
  const list = document.getElementById("lois");
  if(!list) return;

  const data = nq
    ? state.lois.filter(l =>
        [l.titre,l.type,l.auteur,l.etat].some(v=>norm(v).includes(nq))
      )
    : state.lois;

  list.innerHTML = data.map(card).join("") || "<p>Aucune loi.</p>";
}

(async function init(){
  try{
    const [lois, deputes] = await Promise.all([
      loadJSON(URL_LOIS),
      loadJSON(URL_DEPUTES).catch(()=>[]) // si indispo, on continue
    ]);
    state.lois = Array.isArray(lois) ? lois : [];
    state.mapAuteur = buildAuteurMap(deputes);

    // Filtre rapide
    const s = document.getElementById("search");
    s && s.addEventListener("input", render);

    render();
  }catch(e){
    console.error(e);
    const list = document.getElementById("lois");
    if(list) list.innerHTML = "<p>Erreur de chargement des lois.</p>";
  }
})();
</script>