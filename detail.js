/*************************************************
 * Détail de la loi -- lecture lois_AI.json (+ fallback lois.json)
 * - En-tête : Titre + "Type · Date" (sans auteur ni ID)
 * - "Députés porteurs" : depuis `auteur`/`auteurs` avec mapping
 * - Résumé & impacts : depuis lois_AI.json si dispo
 * - Groupes : format officiel (id/libelleAbrev/libelle)
 *************************************************/

const URL_LOIS_AI  = "./lois/lois_AI.json";
const URL_LOIS     = "./lois/lois.json";
const URL_DEPUTES  = "./deputes/deputes.json";
const URL_GROUPES  = "./deputes/groupes.json";

const $ = (s) => document.querySelector(s);
const setText = (sel, val, placeholder="--") => {
  const el = $(sel); if (!el) return;
  el.textContent = (val == null || val === "") ? placeholder : val;
  el.classList.remove("skeleton");
  el.style.removeProperty("height");
};

const urlId = new URLSearchParams(location.search).get("id")?.toUpperCase();
if (!urlId) {
  setText("#title", "Loi introuvable");
  setText("#subtitle", "");
  // on s’arrête ici
}

/* ---------- ID canonique (doit matcher l’AI) ---------- */
function idOf(l){
  return String(
    l?.ref ||
    l?.cid ||
    l?.dossierLegislatifRef ||
    l?.reference ||
    l?.id ||
    l?.numero ||
    l?.code
  ).toUpperCase();
}

/* ---------- Auteurs : maps & format ---------- */
let MAP_DEPUTES = {}; // { PAxxxxx -> "Nom" }
let MAP_GROUPES = {}; // { POxxxxx -> "SIGLE -- Libellé" }

function formatAuteur(code){
  if (!code) return "--";
  if (MAP_DEPUTES[code]) return MAP_DEPUTES[code];
  if (MAP_GROUPES[code]) return MAP_GROUPES[code];
  if (/^PO\d{3,}$/.test(code)) return "Gouvernement";
  return code;
}

function escapeHTML(s){
  return (s ?? "").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function fetchJSON(u){
  const r = await fetch(u, {cache:"no-store"});
  if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`);
  return r.json();
}

async function loadMaps(){
  // Députés
  try{
    const dep = await fetchJSON(URL_DEPUTES + "?v=" + Date.now());
    (Array.isArray(dep) ? dep : []).forEach(d=>{
      if (d.id && d.nom) MAP_DEPUTES[String(d.id)] = d.nom;
    });
  }catch(e){ console.warn("deputes.json KO", e); }

  // Groupes (data.gouv.fr : { id, libelleAbrev, libelle })
  try{
    const grp = await fetchJSON(URL_GROUPES + "?v=" + Date.now());
    (Array.isArray(grp) ? grp : []).forEach(g=>{
      const code = String(g.id || "").trim();
      if (!code) return;
      const sigle   = (g.libelleAbrev || "").trim();
      const libelle = (g.libelle || "").trim();
      MAP_GROUPES[code] = sigle ? (libelle ? `${sigle} -- ${libelle}` : sigle)
                                : (libelle || code);
    });
  }catch(e){ console.warn("groupes.json KO", e); }
}

function fillAuthors(containerSel, obj){
  const el = $(containerSel); if (!el) return;
  let auteurs = [];
  if (Array.isArray(obj.auteurs) && obj.auteurs.length) auteurs = obj.auteurs;
  else if (obj.auteur) auteurs = [obj.auteur];

  if (!auteurs.length) { el.textContent = "--"; el.classList.add("muted"); return; }
  el.classList.remove("muted");
  el.innerHTML = auteurs
    .map(code => `<span class="chip">${escapeHTML(formatAuteur(String(code)))}</span>`)
    .join(" ");
}

(async function main(){
  if (!urlId) return;

  try{
    await loadMaps();

    // 1) lois_AI.json (prioritaire pour résumé/impacts)
    let item = null;
    try{
      const ai = await fetchJSON(URL_LOIS_AI + "?v=" + Date.now());
      const arr = Array.isArray(ai) ? ai : [];
      item = arr.find(x => idOf(x) === urlId);
    }catch(_){ /* pas grave */ }

    // 2) fallback lois.json
    if (!item) {
      const base = await fetchJSON(URL_LOIS + "?v=" + Date.now());
      const list = Array.isArray(base) ? base : (base.lois || base.items || []);
      item = list.find(x => idOf(x) === urlId);
    }

    if (!item) throw new Error(`Loi ${urlId} introuvable.`);

    // ===== Header (sans auteur / sans ID) =====
    setText("#title", item.titre || "Sans titre");
    const subtitle = [item.type, item.date].filter(Boolean).join(" · ");
    setText("#subtitle", subtitle, "");

    // ===== Députés porteurs =====
    fillAuthors("#deputes", item);

    // ===== Résumé =====
    setText("#resume", item.resume || "Résumé non disponible.");

    // ===== Impacts =====
    const impactsEl = $("#impacts");
    if (Array.isArray(item.impacts) && item.impacts.length) {
      impactsEl.innerHTML = item.impacts.map(x => `<li>${escapeHTML(x)}</li>`).join("");
    } else {
      impactsEl.innerHTML = `<li class="muted">--</li>`;
    }

    // ===== Badges =====
    setText("#statut", item.etat || item.statut || "--");
    setText("#nature", item.type || item.nature || "--");

    const datesEl = $("#dates");
    datesEl.innerHTML = item.date
      ? `<li>${escapeHTML(String(item.date))}</li>`
      : `<li class="muted">--</li>`;

    // ===== Lien officiel =====
    const a = $("#legifrance");
    if (item.url) {
      a.href = item.url; a.target = "_blank"; a.rel = "noopener";
    } else {
      a.href = "#";
      a.textContent = "Lien indisponible";
      a.classList.add("muted");
      a.removeAttribute("target"); a.removeAttribute("rel");
    }
  }catch(e){
    console.error(e);
    setText("#title", "Loi introuvable");
    setText("#subtitle", "");
    setText("#resume", "Impossible de charger les données.");
    $("#impacts").innerHTML = `<li class="muted">--</li>`;
  }
})();