// Page d'accueil = Lois
const JSON_URL = "./lois/lois.json?v=" + Date.now(); // généré par le workflow

const $ = s => document.querySelector(s);
const el = { search: $('#search'), list: $('#lois') };

function card(l) {
  const url = l.url ? `<a href="${l.url}" target="_blank" rel="noopener">Voir le dossier</a>` : "";
  return `
    <div class="card-link" style="display:block">
      <h2>${(l.titre||"").trim()}</h2>
      <p><strong>Type :</strong> ${l.type || "--"}</p>
      <p><strong>Auteur :</strong> ${l.auteur || "--"}</p>
      <p><strong>Date :</strong> ${l.date || "--"} &nbsp; • &nbsp; <strong>État :</strong> ${l.etat || "--"}</p>
      ${url}
    </div>
  `;
}

function render(lois, q="") {
  const Q = q.toLowerCase();
  const data = lois.filter(l =>
    (l.titre||"").toLowerCase().includes(Q) ||
    (l.type||"").toLowerCase().includes(Q) ||
    (l.auteur||"").toLowerCase().includes(Q) ||
    (l.etat||"").toLowerCase().includes(Q)
  );
  el.list.innerHTML = data.map(card).join('') || `<p>Aucun résultat.</p>`;
}

(async function init() {
  try {
    const r = await fetch(JSON_URL, { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const lois = await r.json();
    render(lois);

    el.search.addEventListener('input', () => render(lois, el.search.value));
  } catch (e) {
    el.list.innerHTML = `<p style="color:#c00">Erreur de chargement des lois. ${e.message || e}</p>`;
    console.error(e);
  }
})();