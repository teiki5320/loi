// scripts/build_an_actors.mjs
// Construit data/an_actors.json à partir de json/acteur/*.json et json/organe/*.json

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIR_ACTEUR = path.join(ROOT, "json", "acteur");
const DIR_ORGANE = path.join(ROOT, "json", "organe");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "an_actors.json");

// ---------- utilitaires ----------
const isFile = p => fs.existsSync(p) && fs.statSync(p).isFile();
const isDir  = p => fs.existsSync(p) && fs.statSync(p).isDirectory();

function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.warn("JSON invalide:", file);
    return null;
  }
}

function listFiles(dir, prefix) {
  if (!isDir(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json") && (!prefix || f.startsWith(prefix)))
    .map(f => path.join(dir, f));
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

// --------- extraction assez robuste des champs ---------
function getNameFromActeur(a) {
  // formats possibles dans l'AMO : etatCivil.ident.{nom,prenom|prenoms}
  const ec = a?.etatCivil ?? a?.civilite ?? a?.ident ?? {};
  const ident = ec?.ident ?? ec ?? {};
  const nom = ident?.nom ?? a?.nom ?? "";
  const prenom = ident?.prenom ?? ident?.prenoms ?? a?.prenom ?? "";
  const full = [prenom, nom].filter(Boolean).join(" ").trim();
  return full || (a?.nomUsuel ?? a?.nomDeNaissance ?? "");
}

function organeLabel(o) {
  // labels possibles côté organe
  return (
    o?.libelleAbrege ??
    o?.libelle ??
    o?.titre ??
    o?.intitule ??
    o?.nom ??
    ""
  );
}

function organeType(o) {
  // types/codes possibles côté organe
  return (
    o?.codeType ??
    o?.type ??
    o?.categorie ??
    o?.nature ??
    ""
  );
}

// Récupère des références d’organes d’un “mandat” (formats divers)
function refsFromMandat(m) {
  const refs = [];

  const add = v => {
    if (!v) return;
    const s = String(v).trim();
    if (/^PO\d+/i.test(s)) refs.push(s.toUpperCase());
  };

  add(m?.organeRef ?? m?.refOrgane ?? m?.organe);
  // parfois un tableau
  if (Array.isArray(m?.organes)) m.organes.forEach(add);
  if (Array.isArray(m?.organismes)) m.organismes.forEach(add);

  // quelques formats exotiques : { organisme: { code: "PO..." } }
  if (m?.organisme?.code) add(m.organisme.code);

  return refs;
}

// --------- pipeline principal ----------
function main() {
  if (!isDir(DIR_ACTEUR) || !isDir(DIR_ORGANE)) {
    console.error("Dossiers introuvables. Attendus:", DIR_ACTEUR, "et", DIR_ORGANE);
    process.exit(1);
  }

  // 1) Charger tous les organes en mémoire (map par code)
  const organes = {};
  for (const f of listFiles(DIR_ORGANE, "PO")) {
    const code = path.basename(f, ".json").toUpperCase(); // POxxxx
    const o = readJSON(f);
    if (!o) continue;
    organes[code] = {
      code,
      type: organeType(o),
      libelle: organeLabel(o)
    };
  }

  // 2) Parcourir tous les acteurs PAxxxx
  const actorsOut = [];
  for (const f of listFiles(DIR_ACTEUR, "PA")) {
    const code = path.basename(f, ".json").toUpperCase(); // PAxxxx
    const a = readJSON(f);
    if (!a) continue;

    const nom = getNameFromActeur(a);

    // Mandats/roles
    const mandats = Array.isArray(a?.mandats) ? a.mandats
                  : Array.isArray(a?.mandat)  ? a.mandat
                  : [];

    let roles = [];
    for (const m of mandats) {
      const orgRefs = refsFromMandat(m);
      for (const org of orgRefs) {
        const meta = organes[org] ?? { code: org, type: "", libelle: "" };
        roles.push({
          organe: meta.code,
          type: meta.type || (m?.typeOrgane ?? m?.type ?? ""),
          libelle: meta.libelle
        });
      }
    }

    roles = uniqBy(roles, r => `${r.organe}|${r.type}|${r.libelle}`);

    actorsOut.push({ code, nom, roles });
  }

  // 3) Sort + write
  actorsOut.sort((a, b) => a.code.localeCompare(b.code));
  if (!isDir(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(actorsOut, null, 2), "utf8");

  console.log(`OK: ${actorsOut.length} entrées -> ${OUT_FILE}`);
}

main();
