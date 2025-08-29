import { promises as fs } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR_ACTEUR = join(ROOT, "data/an16/json/acteur");
const DIR_ORGANE = join(ROOT, "data/an16/json/organe");
const OUT = join(ROOT, "data/an_actors.json");

// Utilitaires
const readJSON = async (file) => JSON.parse(await fs.readFile(file, "utf8")).acteur || JSON.parse(await fs.readFile(file, "utf8")).organe;
const listFiles = async (dir) => (await fs.readdir(dir)).filter(f => f.endsWith(".json")).map(f => join(dir, f));

// Map codeType organe -> libelle humain
const TYPE_ORGANE_LABEL = {
  "ASSEMBLEE": "Assemblée nationale",
  "SENAT": "Sénat",
  "GOUVERNEMENT": "Gouvernement",
  "GP": "Groupe politique",
  "GE": "Groupe d’études",
  "GA": "Groupe d’amitié",
  "COMPER": "Commission permanente",
  "COMNL": "Commission non législative",
  "CNPE": "Commission d’enquête",
  "DELEGBUREAU": "Délégation du Bureau",
  "PARPOL": "Parti politique / Association",
  "ORGEXTPARL": "Organisme extra-parlementaire",
  // … autres codes possibles dans l’archive
};

function libTypeOrgane(codeType) {
  return TYPE_ORGANE_LABEL[codeType] || codeType || "--";
}

(async () => {
  // 1) Charger tous les organes PO -> pour libellés & types
  const organes = {};
  const poFiles = await listFiles(DIR_ORGANE);
  for (const f of poFiles) {
    const o = await readJSON(f); // { organe: {...} } -> déjà géré par readJSON
    const uid = o?.uid; // ex: "PO59182"
    if (!uid) continue;
    organes[uid] = {
      code: uid,
      libelle: o?.libelleEdition || o?.libelle || o?.libelleAbrege || o?.libelleAbrev || "--",
      typeCode: o?.codeType || "",
      type: libTypeOrgane(o?.codeType || "")
    };
  }

  // 2) Entrées PO (organes) dans la sortie finale
  const out = [];
  for (const uid of Object.keys(organes)) {
    const g = organes[uid];
    out.push({
      code: g.code,         // "POxxxxx"
      nom: g.libelle,       // libellé d’organe
      type: g.type,         // libellé humain du type
      roles: []             // pas de rôles pour l’organe lui-même
    });
  }

  // 3) Charger chaque acteur PA + extraire rôles
  const paFiles = await listFiles(DIR_ACTEUR);
  for (const f of paFiles) {
    const a = await readJSON(f); // { acteur: {...} } -> géré par readJSON
    const uid = a?.uid?.#text || a?.uid || a?.etatCivil?.uid || a?.etatCivil?.ident?.uid;
    // uid attendu "PAxxxxx", dans l’archive le code est dans a.uid.#text
    const code = (typeof a?.uid === "object" && a?.uid["#text"]) ? a.uid["#text"]
                : (typeof a?.uid === "string" ? a.uid : null);
    if (!code) continue;

    const nom = [
      a?.etatCivil?.ident?.prenom,
      a?.etatCivil?.ident?.nom
    ].filter(Boolean).join(" ") || a?.etatCivil?.ident?.alpha || "";

    // Rôles lisibles = libellés de chaque organe référencé dans ses mandats
    const roles = [];
    const mandats = Array.isArray(a?.mandats?.mandat) ? a.mandats.mandat : (a?.mandats?.mandat ? [a.mandats.mandat] : []);
    for (const m of mandats) {
      const orgRef = m?.organes?.organeRef;
      if (!orgRef || !organes[orgRef]) continue;
      const og = organes[orgRef];
      // On forme un libellé compact “<type>: <libelle organe>”
      roles.push(`${og.type}: ${og.libelle}`);
    }

    out.push({
      code,             // "PAxxxxx"
      nom: nom || "",   // "Prénom Nom"
      type: "Acteur",   // personne
      roles: Array.from(new Set(roles)).slice(0, 12) // dédoublonnage + limite raisonnable
    });
  }

  // 4) Tri final par code
  out.sort((a,b)=> String(a.code).localeCompare(String(b.code)));

  // 5) Écrire data/an_actors.json
  await fs.writeFile(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`OK -> ${OUT} (${out.length} entrées)`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
