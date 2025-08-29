import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ACTEURS_DIR = path.join(ROOT, "json", "acteur");
const ORGANES_DIR = path.join(ROOT, "json", "organe");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "an_actors.json");

// ---------- helpers ----------
const readJSON = (p) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
};
const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")) : []);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// --- extraction très tolérante du nom ---
function extractNom(obj) {
  if (!obj) return "";

  // cas 1 : structure "acteur" avec état civil
  const a = obj.acteur ?? obj.Acteur ?? obj;
  const et = a.etatCivil ?? a.etat_civil ?? a["etat-civil"];
  const id = et?.ident ?? et?.identite ?? a.ident ?? a.identity;

  const prenoms = id?.prenom ?? id?.prenoms ?? a.prenom ?? a.prenoms;
  const nom = id?.nom ?? a.nom;

  if (nom || prenoms) return [prenoms, nom].filter(Boolean).join(" ").trim();

  // cas 2 : parfois un champ déjà composé
  const nomComplet = a.nomComplet ?? a.nom_usage ?? a.displayName ?? a.fullname;
  if (nomComplet) return String(nomComplet).trim();

  // cas 3 : dernier recours
  return (a.nom ?? "").trim();
}

// --- extraction UID (PAxxxx) ---
function extractCodeActeur(obj) {
  const a = obj.acteur ?? obj.Acteur ?? obj;
  return a.uid ?? a.id ?? a.code ?? a.identifiant ?? "";
}

// --- extraction des mandats (références d’organes) ---
function extractMandats(obj) {
  const a = obj.acteur ?? obj.Acteur ?? obj;
  // structure la plus courante : a.mandats.mandat[] avec .organeRef
  const mandatsBloc = a.mandats ?? obj.mandats ?? {};
  const mandatsArr =
    Array.isArray(mandatsBloc) ? mandatsBloc :
    Array.isArray(mandatsBloc.mandat) ? mandatsBloc.mandat :
    [];
  return mandatsArr.map(m => m?.organeRef ?? m?.organe?.ref ?? m?.organe ?? "").filter(Boolean);
}

// --- typage des rôles à partir de l’organe ---
function roleFromOrgane(org) {
  const ct = (org.codeType ?? org.type ?? "").toUpperCase();
  const lib = (org.libelle ?? org.libelleCourt ?? org.nom ?? "").toLowerCase();

  if (ct.includes("GVT") || ct.includes("MIN") || lib.includes("gouvernement") || lib.includes("ministre"))
    return "Ministre";

  if (ct.includes("ASSEMBL") || lib.includes("assemblée nationale") || lib.includes("déput"))
    return "Député";

  if (ct.includes("SENAT") || lib.includes("sénat") || lib.includes("sénateur"))
    return "Sénateur";

  return ""; // inconnu / autre organe (groupe, commission, etc.)
}

function main() {
  // 1) lire toutes les définitions d’organes POxxxx
  const organes = new Map(); // PO -> objet organe
  for (const f of listFiles(ORGANES_DIR)) {
    const j = readJSON(path.join(ORGANES_DIR, f));
    if (!j) continue;
    // les fichiers organe sont souvent de la forme { organe: {...} }
    const o = j.organe ?? j.Organe ?? j;
    const id = o.uid ?? o.id ?? o.code ?? f.replace(/\.json$/,"");
    organes.set(id, o);
  }

  // 2) parcourir les acteurs
  const out = [];
  for (const f of listFiles(ACTEURS_DIR)) {
    const j = readJSON(path.join(ACTEURS_DIR, f));
    if (!j) continue;

    const code = extractCodeActeur(j) || f.replace(/\.json$/,"");
    let nom = extractNom(j);

    // mandats -> organeRef -> rôles
    const refs = uniq(extractMandats(j));
    const roles = uniq(refs.map(ref => roleFromOrgane(organes.get(ref) ?? {})));

    // si nom vide, on tente quelques autres chemins
    if (!nom) {
      const a = j.acteur ?? j.Acteur ?? j;
      nom = a?.nom ?? a?.displayName ?? "";
    }

    out.push({ code, nom, roles });
  }

  // 3) écrire data/an_actors.json
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: ${out.length} entrées écrites dans ${OUT_FILE}`);
}

main();
