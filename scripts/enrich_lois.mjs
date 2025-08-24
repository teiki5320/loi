import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "lois", "lois.json");
const OUT = path.join(ROOT, "lois", "lois_AI.json"); // <- nom final

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function idOf(l) {
  return String(l.ref || l.id || l.numero || l.code || l.reference || "").toUpperCase();
}
function baseFields(l) {
  return {
    id: idOf(l),
    titre: l.titre || l.intitule || "Sans titre",
    type: l.type || l.nature || "",
    auteur: l.auteur || "",
    date: l.date || l.dateEvenement || "",
    etat: l.etat || l.statut || "",
    url: l.legifranceUrl || l.url || l.lien || ""
  };
}
async function readJSON(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data : (data.lois || data.items || data);
  } catch { return null; }
}
async function writeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}
async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) return null;
  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: "Tu résumes des lois françaises en 4–6 phrases et fournis 3–6 impacts concrets, style clair et neutre." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || null;
}
function parseAI(text) {
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
  const impacts = lines.filter(l => /^[-•]/.test(l)).map(l => l.replace(/^[-•]\s*/, ""));
  const resume = lines.filter(l => !/^[-•]/.test(l)).join(" ");
  return { resume: resume || text, impacts };
}
function makePrompt(l) {
  return `Titre: ${l.titre}
Type: ${l.type}
Auteur: ${l.auteur}
État: ${l.etat}
Date: ${l.date}

Consigne:
1) Écris un résumé clair (4–6 phrases) en français accessible.
2) Liste ensuite 3–6 impacts concrets (chaque ligne commençant par "-").`;
}

async function main() {
  const lois = await readJSON(SRC);
  if (!Array.isArray(lois)) {
    console.error("lois.json introuvable ou invalide:", SRC);
    process.exit(1);
  }

  // on garde les anciens résumés si déjà présents (cache)
  const existing = await readJSON(OUT) || [];
  const mapExisting = new Map(existing.map(x => [x.id, x]));

  const enriched = [];
  for (const raw of lois) {
    const base = baseFields(raw);
    if (!base.id) continue;

    const cached = mapExisting.get(base.id);
    if (cached?.resume && Array.isArray(cached.impacts) && cached.impacts.length) {
      enriched.push({ ...base, resume: cached.resume, impacts: cached.impacts });
      continue;
    }

    const prompt = makePrompt(base);
    let text = null;
    try { text = await callOpenAI(prompt); }
    catch (e) { console.warn("OpenAI error for", base.id, e); }

    const ai = text ? parseAI(text) : { resume: null, impacts: [] };
    enriched.push({ ...base, ...ai });

    // petite pause anti rate-limit
    await new Promise(r => setTimeout(r, 300));
  }

  // tri stable (optionnel)
  enriched.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  await writeJSON(OUT, enriched);
  console.log(`✅ ${enriched.length} lois enrichies → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });