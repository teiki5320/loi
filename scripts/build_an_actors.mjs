// scripts/build_an_actors.mjs
// Fusionne les acteurs (PA...) et les organes (PO...) de l'archive AN v16
// -> écrit data/an_actors.json {code, nom, type, roles[]}

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- Répertoires d'entrée/sortie
const ROOT        = path.resolve(__dirname, '..');             // .../scripts/..
const DATA_DIR    = path.resolve(ROOT, 'data');                // .../data
const ACTEUR_DIR  = path.resolve(DATA_DIR, 'an16/json/acteur');
const ORGANE_DIR  = path.resolve(DATA_DIR, 'an16/json/organe');
const OUT_PATH    = path.resolve(DATA_DIR, 'an_actors.json');

// --- Utilitaires
async function listJsonFiles(dir) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    return files
      .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.json'))
      .map(d => path.join(dir, d.name));
  } catch {
    return [];
  }
}

async function readJsonSafely(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clean(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim();
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

// --- Mappings simples
const ORG_TYPE_LABEL = new Map([
  ['ASSEMBLEE', 'Assemblée'],
  ['POLEG', 'Pôle législatif'],
  ['GE', 'Groupe d’études'],
  ['GP', 'Groupe politique'],
  ['COMPER', 'Commission permanente'],
  ['CNPE', 'Commission d’enquête / mission'],
  ['PARPOL', 'Parti politique'],
  ['MINISTERE', 'Ministère'],
  ['ORGEXTPARL', 'Organe extra-parlementaire']
  // ... on pourra en ajouter si besoin
]);

function humanizeOrgType(o) {
  const t =
    o?.codeType ||
    o?.['xsi:type'] ||   // si l’attribut est stocké sans '@'
    o?.['@xsi:type'] ||  // si vraiment "@xsi:type"
    o?.type ||
    '';
  return ORG_TYPE_LABEL.get(t) || (t || 'Organe');
}

// --- Extraction Acteur (PA…)
function extractActor(obj) {
  const a = obj?.acteur;
  if (!a) return null;

  const code = clean(a?.uid?.['#text'] || a?.uid || '');
  if (!code) return null;

  const nom = clean(
    [
      a?.etatCivil?.ident?.prenom,
      a?.etatCivil?.ident?.nom
    ].filter(Boolean).join(' ')
  ) || clean(a?.etatCivil?.ident?.alpha) || '';

  // Rôles : on prend les types d’organes + libellés
  const roles = [];
  const mandats = a?.mandats?.mandat;
  const arr = Array.isArray(mandats) ? mandats : (mandats ? [mandats] : []);
  for (const m of arr) {
    const typeOrg = clean(m?.typeOrgane);
    if (!typeOrg) continue;
    const qual = clean(m?.infosQualite?.libQualite || m?.infosQualite?.codeQualite);
    const label = ORG_TYPE_LABEL.get(typeOrg) || typeOrg;
    roles.push(qual ? `${label} — ${qual}` : label);
  }

  return {
    code,                          // PAxxxx
    nom: nom || '(Acteur sans nom)',
    type: 'Acteur',
    roles: uniq(roles)
  };
}

// --- Extraction Organe (PO…)
function extractOrgane(obj) {
  const o = obj?.organe;
  if (!o) return null;

  const code = clean(o?.uid || '');
  if (!code) return null;

  const lib =
    clean(o?.libelleEdition) ||
    clean(o?.libelleAbrege) ||
    clean(o?.libelle) ||
    '';

  return {
    code,                          // POxxxxx
    nom: lib || '(Organe sans libellé)',
    type: humanizeOrgType(o),
    roles: []                      // pas de rôles ici
  };
}

async function main() {
  // Vérifie la présence des dossiers
  const actorFiles = await listJsonFiles(ACTEUR_DIR);
  const orgFiles   = await listJsonFiles(ORGANE_DIR);

  if (!actorFiles.length && !orgFiles.length) {
    console.error('⚠️ Aucun JSON trouvé dans data/an16/json/{acteur,organe}.');
  }

  const out = [];

  // Acteurs (PA…)
  for (const f of actorFiles) {
    const j = await readJsonSafely(f);
    const rec = extractActor(j);
    if (rec) out.push(rec);
  }

  // Organes (PO…)
  for (const f of orgFiles) {
    const j = await readJsonSafely(f);
    const rec = extractOrgane(j);
    if (rec) out.push(rec);
  }

  // Tri par code pour stabilité
  out.sort((a, b) => a.code.localeCompare(b.code));

  // Écrit la sortie
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

  console.log(`✅ ${out.length} entrées écrites dans ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(err => {
  console.error('❌ build_an_actors.mjs failed:', err);
  process.exit(1);
});
