// scripts/build_an_actors.mjs
// Construit data/an_actors.json (fusion PA + PO) à partir des dossiers AN.
// - Cherche prioritairement dans data/an16/json/{acteur,organe}
// - Sinon dans json/{acteur,organe}
// - Tolérant : fonctionne même si acteur/ ou organe/ est absent

import { promises as fs } from "node:fs";
import { join, basename } from "node:path";

const ROOTS = [
  "data/an16/json",  // priorité : ton extraction récente
  "json"             // fallback : ancien emplacement
];

const OUT_DIR  = "data";
const OUT_FILE = join(OUT_DIR, "an_actors.json");

// Libellés lisibles pour types d’organes
const ORG_TYPE_LABEL = {
  ASSEMBLEE: "Assemblée nationale",
  SENAT: "Sénat",
  GP: "Groupe politique",
  GA: "Groupe d’amitié",
  GE: "Groupe d’études",
  COMPER: "Commission permanente",
  COMMISSION: "Commission",
  ORGEXTPARL: "Organe extra-parlementaire",
  GOUVERNEMENT: "Gouvernement",
};

// ---------- helpers ----------
const safe = v => (v == null ? "" : String(v));
const trim = v => safe(v).trim();

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJSON(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function listJSON(dir, pattern = null) {
  if (!(await exists(dir))) return [];
  const names = await fs.readdir(dir);
  return names
    .filter(n => n.toLowerCase().endsWith(".json"))
    .filter(n => !pattern || pattern.test(n))
    .map(n => join(dir, n));
}

function getPA(a) {
  // uid peut être "#text" ou direct
  const uid = a?.uid?.["#text"] || a?.uid || "";
  return trim(uid);
}

function getNameFromActeur(a) {
  const prenom = a?.etatCivil?.ident?.prenom;
  const nom    = a?.etatCivil?.ident?.nom;
  const full = [prenom, nom].filter(Boolean).join(" ").trim();
  return full || trim(a?.nom) || "";
}

function getOrgLabel(o) {
  return trim(o?.libelleEdition || o?.libelle || o?.libelleAbrege || "");
}

function getOrgTypeLabel(o) {
  const codeType = trim(o?.codeType).toUpperCase();
  return ORG_TYPE_LABEL[codeType] || (codeType || "Organe");
}

function guessActorTypeFromMandats(mandats = []) {
  const types = new Set(mandats.map(m => trim(m?.typeOrgane).toUpperCase()).filter(Boolean));
  if (types.has("ASSEMBLEE"))     return "Député";
  if (types.has("SENAT"))         return "Sénateur";
  if (types.has("GOUVERNEMENT") ||
      types.has("MINISTRE") ||
      types.has("MINISTERE"))     return "Ministre";
  return "Acteur";
}

function buildRolesFromMandats(mandats = [], organesMap) {
  const roles = [];
  for (const m of mandats) {
    const qual = trim(m?.infosQualite?.libQualite) || trim(m?.infosQualite?.codeQualite);
    const ref  = trim(m?.organes?.organeRef || m?.organeRef);
    let cible = "";

    if (ref && organesMap.has(ref)) {
      const o = organesMap.get(ref);
      cible = getOrgLabel(o) || ref;
    } else if (ref) {
      cible = ref;
    }

    // On n’empile pas les rôles "techniques" sans libellé
    if (qual && cible) roles.push(`${qual} — ${cible}`);
    else if (qual)     roles.push(qual);
    else if (cible)    roles.push(cible);
  }
  // dédoublonnage + limite raisonnable
  return [...new Set(roles)].slice(0, 12);
}

// ---------- localisation des dossiers ----------
async function locateDirs() {
  for (const base of ROOTS) {
    const dA = join(base, "acteur");
    const dO = join(base, "organe");
    const hasA = await exists(dA);
    const hasO = await exists(dO);
    if (hasA || hasO) return { dirActeur: hasA ? dA : null, dirOrgane: hasO ? dO : null };
  }
  return { dirActeur: null, dirOrgane: null };
}

// ---------- collect PO ----------
async function collectOrganes(dirOrgane) {
  if (!dirOrgane) return { list: [], map: new Map() };

  const files = await listJSON(dirOrgane, /^PO\d+\.json$/i);
  const list = [];
  const map  = new Map(); // uid -> organe brut

  for (const fp of files) {
    try {
      const j = await readJSON(fp);
      const o = j.organe || j; // parfois déjà plat
      const uid = trim(o?.uid) || trim(basename(fp, ".json"));
      if (!uid) continue;

      const item = {
        code: uid,                     // PO…
        nom:  getOrgLabel(o),          // libellé
        type: getOrgTypeLabel(o),      // libellé lisible
        roles: []                      // un organe n’a pas de “rôles” propre
      };
      list.push(item);
      map.set(uid, o);
    } catch { /* ignore */ }
  }

  // tri
  list.sort((a, b) => a.code.localeCompare(b.code));
  return { list, map };
}

// ---------- collect PA ----------
async function collectActeurs(dirActeur, organesMap) {
  if (!dirActeur) return [];

  const files = await listJSON(dirActeur, /^PA\d+\.json$/i);
  const out = [];

  for (const fp of files) {
    try {
      const j = await readJSON(fp);
      const a = j.acteur || j;
      const code = getPA(a) || trim(basename(fp, ".json"));
      if (!code) continue;

      const nom = getNameFromActeur(a);

      // mandats → rôles + type
      let mandats = a?.mandats?.mandat;
      if (!mandats) mandats = [];
      if (!Array.isArray(mandats)) mandats = [mandats];

      const type  = guessActorTypeFromMandats(mandats);
      const roles = buildRolesFromMandats(mandats, organesMap);

      out.push({ code, nom, type, roles });
    } catch { /* ignore */ }
  }

  // tri
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

// ---------- main ----------
(async () => {
  // s’assurer que data/ existe
  await fs.mkdir(OUT_DIR, { recursive: true });

  const { dirActeur, dirOrgane } = await locateDirs();
  console.log("> Dossiers détectés:",
              "\n  - acteur :", dirActeur || "(absent)",
              "\n  - organe :", dirOrgane || "(absent)");

  // 1) charger les organes (sert aussi à libeller les rôles des acteurs)
  const { list: PO_LIST, map: PO_MAP } = await collectOrganes(dirOrgane);
  console.log(`> Organes chargés : ${PO_LIST.length}`);

  // 2) charger les acteurs (si présents)
  const PA_LIST = await collectActeurs(dirActeur, PO_MAP);
  console.log(`> Acteurs chargés : ${PA_LIST.length}`);

  // 3) fusion (PA + PO)
  const ALL = [...PA_LIST, ...PO_LIST].sort((a, b) => a.code.localeCompare(b.code));

  // 4) écrire
  await fs.writeFile(OUT_FILE, JSON.stringify(ALL, null, 2), "utf8");
  console.log(`✅ Écrit ${ALL.length} entrées dans ${OUT_FILE}`);
})();
