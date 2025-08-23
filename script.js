/*************************************************
 * Lois -- rendu dans #lois + auteur lisible
 * (page: /index.html avec #search et #lois)
 *************************************************/

const URL_LOIS    = "./lois/lois.json";
const URL_DEPUTES = "./deputes/deputes.json";

const $ = s => document.querySelector(s);
const el = {
  search: $('#search'),
  list:   $('#lois'),
};

const noDia = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const esc   = s => (s||"").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '--';

async function jget(url){
  const r = await fetch(url + "?v=" + Date.now(), { cache: "no-cache" });
  if(!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
  return r.json();
}

let LOIS = [];
let MAP_DEP = new Map();   // "PAxxxx" -> "Nom Prénom"

function card(l){
  const titre = l.titre || "";
  const titreShort = titre.length > 120 ? titre.slice(0,120) + "…" : titre;
  return `
    <article class="card-link" style="display:block">
      <h2>${esc(titreShort)}</h2>
      <p><strong>Type :</strong> ${esc(l.type || "--")}</p>
      <p><strong>Auteur :</strong> ${esc(l.auteurNom || l.auteur || "--")}</p>
      <p><strong>Date :</strong> ${esc(fmtDate(l.date))} &nbsp; • &nbsp; <strong>État :</strong> ${esc(l.etat || "--")}</p>
      ${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">Voir le dossier</a>` : ""}
    </article>
  `;
}

function render(){
  const q = noDia(el.search?.value || "");
  const data = q
    ? LOIS.filter(l => noDia(
        [l.titre, l.type, l.etat, l.auteurNom].filter(Boolean).join(" ")
      ).includes(q))
    : LOIS;

  el.list.innerHTML = data.map(card).join('') || `<p>Aucune loi trouvée.</p>`;
}

(async function init(){
  try{
    // 1) charger députés -> construire PAxxxx => Nom
    const deputes = await jget(URL_DEPUTES);
    deputes.forEach(d => { if(d?.id && d?.nom) MAP_DEP.set(String(d.id), String(d.nom)); });

    // 2) charger lois + mapper l’auteur
    const lois = await jget(URL_LOIS);
    LOIS = (Array.isArray(lois) ? lois : []).map(x => ({
      ...x,
      auteurNom: MAP_DEP.get(String(x.auteur || "")) || (x.auteur || "")
    }));

    render();
    el.search && el.search.addEventListener('input', render);
  } catch(e){
    console.error(e);
    el.list.innerHTML = `<p style="color:#b00">Erreur de chargement des données. ${esc(e.message||e)}</p>`;
  }
})();