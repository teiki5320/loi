// scripts/build_an_actors.mjs
import { promises as fs } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR_ACTEUR = join(ROOT, "data/an16/json/acteur");
const DIR_ORGANE = join(ROOT, "data/an16/json/organe");
const OUT = join(ROOT, "data/an_actors.json");

// libellés lisibles pour quelques codes d’organes fréquents
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

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

async function readJSON(file) {
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt);
}

// ---- ACTEURS (PAxxxx) -------------------------------------------------------
async function collectActeurs() {
  let entries = [];
  try {
    const names = await fs.readdir(DIR_ACTEUR);
    for (const name of names) {
      if (!/^PA\d+\.json$/.test(name)) continue;
      const j = await readJSON(join(DIR_ACTEUR, name));
      const a = j.acteur;

      const code = a?.uid?.["#text"] || a?.uid || "";
      const prenom = a?.etatCivil?.ident?.prenom || "";
      const nom = a?.etatCivil?.ident?.nom || "";
      const lib = [prenom, nom].filter(Boolean).join(" ").trim();

      // déduire des rôles lisibles depuis les mandats
      const mandats = Array.isArray(a?.mandats?.mandat) ? a.mandats.mandat : (a?.mandats?.mandat ? [a.mandats.mandat] : []);
      const roles = [];
      for (const m of mandats) {
        const t = m?.typeOrgane;
        if (t === "ASSEMBLEE") roles.push("Député" + (m.legislature ? ` (${m.legislature}e)` : ""));
        else if (t === "SENAT") roles.push("Sénateur");
        else if (t === "GOUVERNEMENT") roles.push("Membre du gouvernement");
        // on ignore GP/GA/GE/COMPER ici (ce sont des appartenances d’organe)
      }

      entries.push({
        code,              // ex: PA1206
        nom: lib || "",    // "Prénom Nom"
        type: "Acteur",    // personne
        roles: uniq(roles) // ex: ["Député (16e)"]
      });
    }
  } catch (e) {
    // dossier absent → OK
  }
  return entries;
}

// ---- ORGANES (POxxxx) -------------------------------------------------------
async function collectOrganes() {
  let entries = [];
  try {
    const names = await fs.readdir(DIR_ORGANE);
    for (const name of names) {
      if (!/^PO\d+\.json$/.test(name)) continue;
      const j = await readJSON(join(DIR_ORGANE, name));
      const o = j.organe;

      const code = o?.uid || "";
      const lib = o?.libelleEdition || o?.libelle || o?.libelleAbrege || "";
      const codeType = o?.codeType || "";
      const type = ORG_TYPE_LABEL[codeType] || codeType || "Organe";

      entries.push({
        code,           // ex: PO59047
        nom: lib,       // libellé d’organe
        type,           // libellé lisible
        roles: []       // pas de rôles pour un organe lui-même
      });
    }
  } catch (e) {
    // dossier absent → OK
  }
  return entries;
}

(async () => {
  // sécurité : créer l’arbo si besoin
  await fs.mkdir(join(ROOT, "data"), { recursive: true });

  const acteurs = await collectActeurs();
  const organes = await collectOrganes();

  // fusion + tri par code (PA… puis PO… naturellement)
  const all = [...acteurs, ...organes].sort((a,b) => (a.code > b.code ? 1 : -1));

  await fs.writeFile(OUT, JSON.stringify(all, null, 2), "utf8");
  console.log(`✅ Écrit ${all.length} entrées dans ${OUT}`);
})();
