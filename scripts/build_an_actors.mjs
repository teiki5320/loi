// scripts/build_an_actors.mjs
// Fusionne acteurs (PA…) + organes (PO…) en data/an_actors.json

import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- Réglages I/O -----------------------------------------------------------
const OUT_FILE = path.resolve(__dirname, '..', 'data', 'an_actors.json');

// Emplacements possibles (on prend ceux qui existent)
const DIRS = {
  acteur: [
    path.resolve(__dirname, '..', 'data', 'an16', 'json', 'acteur'),
    path.resolve(__dirname, '..', 'json', 'acteur'),
  ],
  organe: [
    path.resolve(__dirname, '..', 'data', 'an16', 'json', 'organe'),
    path.resolve(__dirname, '..', 'json', 'organe'),
  ],
};

// --- Helpers FS -------------------------------------------------------------
async function dirExists(p) {
  try { return (await fs.stat(p)).isDirectory(); }
  catch { return false; }
}

async function listJsonFiles(dir) {
  if (!(await dirExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.json'))
    .map(d => path.join(dir, d.name))
    .sort();
}

async function chooseFirstExisting(dirs) {
  for (const d of dirs) if (await dirExists(d)) return d;
  return null;
}

async function readJSON(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('JSON invalide/illisible :', file, e.message);
    return null;
  }
}

// --- Normalisation lisible --------------------------------------------------
const ORG_TYPE_LABEL = new Map([
  // codeType -> libellé plus lisible
  ['ASSEMBLEE', 'Assemblée nationale'],
  ['GP',        'Groupe politique'],
  ['GA',        'Groupe d’amitié'],
  ['GE',        'Groupe d’études'],
  ['COMPER',    'Commission permanente'],
  ['CNPE',      'Commission / Délégation'],
  ['DELEG',     'Délégation'],
  ['POLE',      'Pôle'],
  ['ORGEXTPARL','Organe extra-parlementaire'],
  ['PARPOL',    'Parti / formation politique'],
]);

function humanizeOrgType(o) {
  const t = o?.codeType || o?.@xsi_type || o?.type || '';
  return ORG_TYPE_LABEL.get(t) || (t || 'Organe');
}

function safeText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  // uid peut être { "#text": "PA1234", ... }
  if (typeof v === 'object' && '#text' in v) return String(v['#text']);
  return String(v);
}

// --- Lecture ORGANE (PO...) -------------------------------------------------
async function loadOrganes() {
  const base = await chooseFirstExisting(DIRS.organe);
  if (!base) return new Map();

  const files = await listJsonFiles(base);
  const map = new Map();

  for (const f of files) {
    const j = await readJSON(f);
    if (!j) continue;

    // Plusieurs exports ont une racine { organe: {...} }
    const o = j.organe ?? j;
    const code = safeText(o?.uid);
    if (!code || !/^PO\d{3,}/.test(code)) continue;

    const libelle =
      o?.libelleEdition ||
      o?.libelleAbrege ||
      o?.libelle ||
      o?.name ||
      '';

    map.set(code, {
      code,
      type: humanizeOrgType(o),
      libelle: libelle || code,
    });
  }

  return map;
}

// --- Lecture ACTEUR (PA...) -------------------------------------------------
async function loadActeurs(organesMap) {
  const base = await chooseFirstExisting(DIRS.acteur);
  if (!base) return [];

  const files = await listJsonFiles(base);
  const out = [];

  for (const f of files) {
    const j = await readJSON(f);
    if (!j) continue;

    // Racine la plus fréquente : { acteur: {...} }
    const a = j.acteur ?? j;
    const code = safeText(a?.uid);
    if (!code || !/^PA\d{3,}/.test(code)) continue;

    // Nom lisible
    const nom =
      [a?.etatCivil?.ident?.prenom, a?.etatCivil?.ident?.nom]
        .filter(Boolean)
        .join(' ')
      || a?.etatCivil?.ident?.alpha
      || '';

    // Rôles : parcourir mandats -> organeRef -> libellé/orgType
    const roles = [];
    const mandatsRaw = a?.mandats?.mandat;
    const mandats = Array.isArray(mandatsRaw)
      ? mandatsRaw
      : (mandatsRaw ? [mandatsRaw] : []);

    for (const m of mandats) {
      const orgRef = m?.organes?.organeRef;
      if (!orgRef || !organesMap.has(orgRef)) continue;
      const og = organesMap.get(orgRef);
      const qual = m?.infosQualite?.libQualite || m?.infosQualite?.codeQualite;
      const label = qual ? `${og.type} — ${og.libelle} (${qual})` : `${og.type} — ${og.libelle}`;
      roles.push(label);
    }

    out.push({
      code,               // "PAxxxxx"
      nom: nom || code,   // "Prénom Nom"
      type: 'Acteur',
      roles: Array.from(new Set(roles)).slice(0, 20),
    });
  }

  return out;
}

// --- Entrée / fusion / sortie ----------------------------------------------
async function main() {
  console.log('→ Lecture organes (PO)…');
  const organesMap = await loadOrganes();
  console.log(`   ${organesMap.size} organes`);

  console.log('→ Lecture acteurs (PA)…');
  const acteurs = await loadActeurs(organesMap);
  console.log(`   ${acteurs.length} acteurs`);

  // Ajouter aussi les organes (PO) en tant qu’entrées consultables
  const organesArray = [...organesMap.values()].map(o => ({
    code: o.code,
    nom: o.libelle,
    type: 'Organe',
    roles: [], // pas de rôles pour les PO eux-mêmes
  }));

  const merged = [...acteurs, ...organesArray];

  // Sort par code (PA… puis PO… naturellement)
  merged.sort((a, b) => a.code.localeCompare(b.code, 'fr'));

  // Écriture
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  console.log(`✓ Écrit ${merged.length} entrées → ${path.relative(process.cwd(), OUT_FILE)}`);
}

// Lancer
main().catch(err => {
  console.error('Erreur build_an_actors:', err);
  process.exit(1);
});
