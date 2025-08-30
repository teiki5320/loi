/*************************************************
 * Détail de la loi
 * - Priorité à lois_AI.json (résumé/impacts) + fusion lois.json si infos manquantes
 * - Auteurs : mapping via data/an_actors.json (PA/PO), fallback députés/groupes
 * - Nettoyage libellés organes ("du … (5ème République)" → "…")
 * - En-tête : Titre + "Type · Date" (sans auteur ni ID)
 * - Timeline animée selon item.etat (si #timeline présent dans le HTML)
 *************************************************/

const URL_LOIS_AI   = "./lois/lois_AI.json";
const URL_LOIS      = "./lois/lois.json";
const URL_DEPUTES   = "./deputes/deputes.json";
const URL_GROUPES   = "./deputes/groupes.json";
const URL_ACTEURS   = "./data/an_actors.json"; // PA/PO fusionnés

/* ---------- Helpers DOM ---------- */
const $ = (s) => document.querySelector(s);
const setText = (sel, val, placeholder="--") => {
  const el = $(sel); if (!el) return;
  el.textContent = (val == null || val === "") ? placeholder : val;
  el.classList.remove("skeleton");
  el.style.removeProperty("height");
};

/* ---------- ID canonique ---------- */
function idOf(l){
  return String(
    l?.ref ||
    l?.cid ||
    l?.dossierLegislatifRef ||
    l?.reference ||
    l?.id ||
    l?.numero ||
    l?.code ||
    ""
  ).toUpperCase();
}

/* ---------- Maps auteurs ---------- */
let MAP_ACTEURS = {}; // { CODE -> Nom (PA…/PO…) }
let MAP_DEPUTES = {}; // { PAxxxxx -> "Nom" }
let MAP_GROUPES = {}; // { POxxxxx -> "SIGLE -- Libellé" }

/* Nettoyage libellés d’organes : */
function cleanOrgLabel(s){
  let out = String(s || "");
  out = out.replace(/^\s*(du|de la|de l’|de l'|des)\s+/i, ""); // début "du …"
  out = out.replace(/\s*\([^)]*\)\s*$/, "");                  // fin "(…)"
  return out.trim();
}

/* Auteur lisible */
function formatAuteur(code){
  if (!code) return "--";
  const key = String(code).toUpperCase();
  if (MAP_ACTEURS[key]) return MAP_ACTEURS[key];
  if (MAP_DEPUTES[key]) return MAP_DEPUTES[key];
  if (MAP_GROUPES[key]) return MAP_GROUPES[key];
  return key; // affiche le code brut si inconnu
}

function escapeHTML(s){
  return (s ?? "").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function fetchJSON(u){
  const r = await fetch(u + (u.includes("?") ? "&" : "?") + "v=" + Date.now(), {cache:"no-store"});
  if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`);
  return r.json();
}

/* ---------- Chargements ---------- */
async function loadActeurs(){
  try{
    const arr = await fetchJSON(URL_ACTEURS);
    (Array.isArray(arr) ? arr : (arr.items || arr.data || [])).forEach(a=>{
      const code = String(a?.code || "").toUpperCase();
      const nom  = cleanOrgLabel(a?.nom || "");
      if (code && nom) MAP_ACTEURS[code] = nom;
    });
  }catch(e){ console.warn("an_actors.json KO", e); }
}

async function loadMaps(){
  // Députés
  try{
    const dep = await fetchJSON(URL_DEPUTES);
    (Array.isArray(dep) ? dep : []).forEach(d=>{
      if (d.id && d.nom) MAP_DEPUTES[String(d.id).toUpperCase()] = d.nom;
    });
  }catch(e){ console.warn("deputes.json KO", e); }

  // Groupes (data.gouv.fr : { id, libelleAbrev, libelle })
  try{
    const grp = await fetchJSON(URL_GROUPES);
    (Array.isArray(grp) ? grp : []).forEach(g=>{
      const code = String(g.id || "").trim().toUpperCase();
      if (!code) return;
      const sigle   = (g.libelleAbrev || "").trim();
      const libelle = (g.libelle || "").trim();
      MAP_GROUPES[code] = cleanOrgLabel(sigle ? (libelle ? `${sigle} -- ${libelle}` : sigle)
                                              : (libelle || code));
    });
  }catch(e){ console.warn("groupes.json KO", e); }
}

/* Liste de codes -> puces auteur */
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

/* ---------- Merge util ---------- */
function mergeItems(primary, fallback){
  if (!fallback) return primary;
  const out = {...fallback, ...primary}; // primary (IA) prioritaire
  // si IA n’avait pas url/type/date etc., fallback comble
  return out;
}

/* ---------- Timeline (optionnelle si #timeline présent) ---------- */
const LAW_STEPS = [
  { key: "depot",        label: "Dépôt" },
  { key: "commission",   label: "Commission (AN/Sénat)" },
  { key: "lecture_an",   label: "1ʳᵉ lecture Assemblée" },
  { key: "lecture_senat",label: "1ʳᵉ lecture Sénat" },
  { key: "navette",      label: "Navette / lectures suiv." },
  { key: "adoption",     label: "Adoption définitive" },
  { key: "cc",           label: "Conseil constitutionnel" },
  { key: "promul",       label: "Promulgation" },
  { key: "jo",           label: "Publication au JO" }
];

function statusToStepIndex(etatRaw){
  const etat = String(etatRaw || "").toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu,"");

  if (!etat || etat === "--") return 0;

  if (/(renvoi|reunion|travaux|examen)\s+de?\s*commission/.test(etat)) return 1;
  if (/premiere?\s*lecture.*assemblee/.test(etat) || /(seance publique).*(assemblee)/.test(etat)) return 2;
  if (/premiere?\s*lecture.*senat/.test(etat) || /(seance publique).*(senat)/.test(etat)) return 3;
  if (/navette|deuxieme\s*lecture|nouvelle\s*lecture|lecture\s*definitive/.test(etat)) return 4;
  if (/adopte?e?/.test(etat)) return 5;
  if (/conseil\s+constitutionnel|saisi(e)?\s+du\s+conseil/.test(etat)) return 6;
  if (/promulguee?/.test(etat)) return 7;
  if (/publication\s+au?\s*jo|journal\s+officiel/.test(etat)) return 8;
  if (/rejete?e?/.test(etat)) return 4; // rejet : on place visuellement à la navette

  if (/commission/.test(etat)) return 1;
  if (/assemblee/.test(etat)) return 2;
  if (/senat/.test(etat)) return 3;

  return 0;
}

function renderTimeline(item){
  const root = $("#timeline"); if (!root) return;
  const idx = statusToStepIndex(item?.etat);
  const total = LAW_STEPS.length;
  const pct = Math.max(0, Math.min(100, Math.round((idx/(total-1))*100)));

  root.innerHTML = `
    <div class="law-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
    <div class="law-steps" role="list">
      ${LAW_STEPS.map((s,i)=>{
        const cls = (i<idx) ? "law-step done" : (i===idx) ? "law-step current" : "law-step";
        const hint = (i===idx && item?.etat) ? `État : ${escapeHTML(String(item.etat))}` : "";
        return `
          <div class="${cls}" role="listitem" aria-current="${i===idx?'step':'false'}">
            <span class="dot" aria-hidden="true"></span>
            <span class="label">${escapeHTML(s.label)}</span>
            ${hint ? `<small class="hint">${hint}</small>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ---------- Main ---------- */
const urlId = new URLSearchParams(location.search).get("id")?.toUpperCase();
if (!urlId) {
  setText("#title", "Loi introuvable");
  setText("#subtitle", "");
} else {
  (async function main(){
    try{
      await Promise.all([loadActeurs(), loadMaps()]);

      // 1) Cherche d’abord dans lois_AI.json
      let itemAI = null;
      try{
        const ai = await fetchJSON(URL_LOIS_AI);
        const arr = Array.isArray(ai) ? ai : [];
        itemAI = arr.find(x => idOf(x) === urlId) || null;
      }catch(_){ /* ignore */ }

      // 2) Puis la base
      let itemBase = null;
      try{
        const base = await fetchJSON(URL_LOIS);
        const list = Array.isArray(base) ? base : (base.lois || base.items || []);
        itemBase = list.find(x => idOf(x) === urlId) || null;
      }catch(_){ /* ignore */ }

      if (!itemAI && !itemBase) throw new Error(`Loi ${urlId} introuvable.`);

      // 3) Fusion IA + Base (IA prioritaire pour resume/impacts)
      let item = itemAI ? mergeItems(itemAI, itemBase) : itemBase;

      /* ===== Header (sans auteur / sans ID) ===== */
      setText("#title", item.titre || "Sans titre");
      const subtitle = [item.type, item.date].filter(Boolean).join(" · ");
      setText("#subtitle", subtitle, "");

      /* ===== Députés porteurs ===== */
      fillAuthors("#deputes", item);

      /* ===== Résumé / Impacts ===== */
      setText("#resume", item.resume || "Résumé non disponible.");
      const impactsEl = $("#impacts");
      if (Array.isArray(item.impacts) && item.impacts.length) {
        impactsEl.innerHTML = item.impacts.map(x => `<li>${escapeHTML(x)}</li>`).join("");
      } else {
        impactsEl.innerHTML = `<li class="muted">--</li>`;
      }

      /* ===== Badges ===== */
      setText("#statut", item.etat || item.statut || "--");
      setText("#nature", item.type || item.nature || "--");
      const datesEl = $("#dates");
      datesEl.innerHTML = item.date
        ? `<li>${escapeHTML(String(item.date))}</li>`
        : `<li class="muted">--</li>`;

      /* ===== Lien officiel ===== */
      const a = $("#legifrance");
      if (item.url) {
        a.href = item.url; a.target = "_blank"; a.rel = "noopener";
      } else {
        a.href = "#";
        a.textContent = "Lien indisponible";
        a.classList.add("muted");
        a.removeAttribute("target"); a.removeAttribute("rel");
      }

      /* ===== Timeline (optionnelle) ===== */
      renderTimeline(item);
    }catch(e){
      console.error(e);
      setText("#title", "Loi introuvable");
      setText("#subtitle", "");
      setText("#resume", "Impossible de charger les données.");
      $("#impacts").innerHTML = `<li class="muted">--</li>`;
    }
  })();
}