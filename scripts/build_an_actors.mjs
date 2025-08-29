/* Build an_actors.json (codes + noms + type + rôles) à partir des PA/PO
   - Entrées attendues (au moins une des deux racines) :
       data/an16/json/acteur/*.json
       data/an16/json/organe/*.json
       json/acteur/*.json
       json/organe/*.json
   - Sortie : data/an_actors.json   (tableau trié par code)
*/

import fs from 'fs';
import path from 'path';

const ROOTS = [
  'data/an16/json',
  'json'
];

const OUT_DIR  = 'data';
const OUT_FILE = path.join(OUT_DIR, 'an_actors.json');

/* ------------------ utilitaires ------------------ */

const exists = p => {
  try { fs.accessSync(p); return true; } catch { return false; }
};

const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));

/** récupère tous les chemins *.json d’un dossier si présent */
function listJson(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.json'))
    .map(f => path.join(dir, f));
}

function safeText(x) {
  if (x == null) return '';
  return String(x).trim();
}

/* Détermine un “type” lisible pour l’acteur à partir de ses mandats
   - ASSEMBLEE  => Député
   - SENAT      => Sénateur (si présent dans les données)
   - GOUVERNEMENT / MINISTERE / MINISTRE => Ministre
   sinon        => Acteur
*/
function guessTypeFromMandats(mandats = []) {
  const types = new Set(
    mandats
      .map(m => (m.typeOrgane || '').toUpperCase())
      .filter(Boolean)
  );

  if (types.has('ASSEMBLEE')) return 'Député';
  if (types.has('SENAT'))     return 'Sénateur';
  if (
    types.has('GOUVERNEMENT') ||
    types.has('MINISTERE')    ||
    types.has('MINISTRE')
  ) return 'Ministre';

  return 'Acteur';
}

/* ------------------ localise les répertoires ------------------ */

function locateDirs() {
  for (const base of ROOTS) {
    const dAct = path.join(base, 'acteur');
    const dOrg = path.join(base, 'organe');
    if (exists(dAct) && exists(dOrg)) {
      return { dirActeur: dAct, dirOrgane: dOrg };
    }
  }
  throw new Error(
    'Impossible de trouver les dossiers "acteur" et "organe". ' +
    'Place les JSON AN dans data/an16/json/{acteur,organe} ou json/{acteur,organe}.'
  );
}

/* ------------------ chargement organes (PO…) ------------------ */

function buildOrganesMap(dirOrgane) {
  const map = new Map(); // uid -> { codeType, libelle, libelleAbrege }
  const files = listJson(dirOrgane);

  for (const fp of files) {
    try {
      const j = readJSON(fp);
      const org = j.organe || j; // certains dumps sont déjà “plats”
      const uid = safeText(org.uid);
      if (!uid) continue;
      map.set(uid, {
        codeType: safeText(org.codeType),
        libelle:  safeText(org.libelle || org.libelleEdition || org.libelleAbrege || ''),
        libelleAbrege: safeText(org.libelleAbrege || '')
      });
    } catch (e) {
      // on ignore les fichiers cassés
    }
  }
  return map;
}

/* Construit une liste de rôles lisibles à partir des mandats et de la map d’organes */
function buildRoles(mandats = [], organesMap) {
  const roles = [];
  for (const m of mandats) {
    const libQualite = safeText(m?.infosQualite?.libQualite);
    const orgRef     = safeText(m?.organes?.organeRef);
    if (!libQualite && !orgRef) continue;

    let cible = '';
    if (orgRef && organesMap.has(orgRef)) {
      const o = organesMap.get(orgRef);
      cible = o.libelle || o.libelleAbrege || orgRef;
    } else if (orgRef) {
      cible = orgRef;
    }

    if (libQualite && cible) roles.push(`${libQualite} — ${cible}`);
    else if (libQualite)     roles.push(libQualite);
    else if (cible)          roles.push(cible);
  }
  // dédoublonnage + limite raisonnable
  return Array.from(new Set(roles)).slice(0, 8);
}

/* ------------------ lecture acteurs (PA…) ------------------ */

function extractActorEntry(jActeur, organesMap) {
  // l’objet peut être enveloppé { acteur: { … } }
  const a = jActeur.acteur || jActeur;

  // code (uid)
  const code = safeText(a?.uid?.['#text'] || a?.uid || a?.etatCivil?.ident?.uid);
  if (!code) return null;

  // nom/prénom
  const nom   = safeText(a?.etatCivil?.ident?.nom);
  const prenom= safeText(a?.etatCivil?.ident?.prenom);
  const nomComplet = [prenom, nom].filter(Boolean).join(' ').trim() || safeText(a?.nom) || '';

  // mandats (table ou objet)
  let mandats = a?.mandats?.mandat;
  if (!mandats) mandats = [];
  if (!Array.isArray(mandats)) mandats = [mandats];

  const type  = guessTypeFromMandats(mandats);
  const roles = buildRoles(mandats, organesMap);

  return { code, nom: nomComplet, type, roles };
}

function buildActors(dirActeur, organesMap) {
  const out = [];
  const files = listJson(dirActeur);

  for (const fp of files) {
    try {
      const j = readJSON(fp);
      // uniquement les PA… ; si le répertoire contient autre chose, on filtre
      const base = path.basename(fp);
      if (!/^PA\d+\.json$/i.test(base)) continue;

      const entry = extractActorEntry(j, organesMap);
      if (entry) out.push(entry);
    } catch (e) {
      // on ignore les fichiers cassés
    }
  }

  // tri par code
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

/* ------------------ main ------------------ */

async function main() {
  try {
    const { dirActeur, dirOrgane } = locateDirs();

    console.log('> Dossiers utilisés :');
    console.log('  - acteurs :', dirActeur);
    console.log('  - organes :', dirOrgane);

    const organesMap = buildOrganesMap(dirOrgane);
    console.log(`> Organes chargés : ${organesMap.size}`);

    const actors = buildActors(dirActeur, organesMap);
    console.log(`> Acteurs extraits : ${actors.length}`);

    if (!exists(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(actors, null, 2), 'utf8');
    console.log('> Écrit :', OUT_FILE);
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exit(1);
  }
}

main();
