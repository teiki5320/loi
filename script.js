/*************************************************
 * Lois -- affichage avec auteur lisible
 * Source : lois.json + deputes.json + groupes.json
 * Option 1B : toute la carte est cliquable (délégation)
 *************************************************/

const URL_LOIS    = "./lois/lois.json";
const URL_DEPUTES = "./deputes/deputes.json";
const URL_GROUPES = "./deputes/groupes.json";

const els = {
  search: document.getElementById("search"),
  grid:   document.getElementById("lois"),
  err:    document.getElementById("err"),
};

let LOIS = [];
let MAP_DEPUTES = {};  // { "PAxxxx": "Nom Député" }
let MAP_GROUPES = {};  // { "POxxxx": "Sigle -- Libellé" }

const esc = (s) =>
  (s ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ---- Traduction du code auteur ----
function formatAuteur(code) {
  if (!code) return "--";
  if (MAP_DEPUTES[code]) return MAP_DEPUTES[code];
  if (MAP_GROUPES[code]) return MAP_GROUPES[code];
  return code; // fallback : on laisse le code brut
}

// ---- Rendu des cartes ----
function render() {
  if (!els.grid) return;
  const q = (els.search?.value || "").trim().toLowerCase();

  const filtered = LOIS.filter((l) => {
    if (!q) return true;
    return [l.titre, l.type, l.etat, formatAuteur(l.auteur)]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  els.grid.innerHTML = filtered
    .map((l) => {
      const titre  = esc(l.titre || "Sans titre");
      const type   = esc(l.type  || "--");
      const etat   = esc(l.etat  || "--");
      const date   = esc(l.date  || "--");
      const auteur = esc(formatAuteur(l.auteur));

      // ID unique pour la page détail
      const id = l.ref || l.id || l.numero || l.code || l.reference || "";

      return `
        <article class="card" data-id="${esc(id)}" tabindex="0" aria-label="Voir le détail de ${titre}">
          <h3 class="card-title">${titre}</h3>
          <div class="infos">
            <p><strong class="k">Type</strong><span class="v">${type}</span></p>
            <p><strong class="k">Auteur</strong><span class="v">${auteur}</span></p>
            <p><strong class="k">Date</strong><span class="v">${date}</span></p>
            <p><strong class="k">État</strong><span class="v">${etat}</span></p>
          </div>
          <p style="margin-top:auto;text-align:center">
            <a class="btn-detail" href="detail.html?id=${encodeURIComponent(id)}">Voir le détail</a>
          </p>
        </article>
      `;
    })
    .join("");

  if (!filtered.length) {
    els.grid.innerHTML = `<p style="opacity:.7">Aucun résultat.</p>`;
  }
}

// ---- Délégation : rendre toute la carte cliquable ----
if (els.grid) {
  els.grid.addEventListener("click", (e) => {
    const linkClicked = e.target.closest("a");
    if (linkClicked) return; // clic direct sur un lien : on laisse faire

    const card = e.target.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    if (id) {
      location.href = `detail.html?id=${encodeURIComponent(id)}`;
    }
  });

  // Accessibilité : Enter/Space sur la carte
  els.grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    const id = card.dataset.id;
    if (id) {
      location.href = `detail.html?id=${encodeURIComponent(id)}`;
    }
  });
}

// ---- Chargements ----
async function loadMaps() {
  // Députés
  try {
    const r = await fetch(`${URL_DEPUTES}?v=${Date.now()}`);
    if (r.ok) {
      const arr = await r.json();
      arr.forEach((d) => {
        if (d.id && d.nom) MAP_DEPUTES[d.id] = d.nom;
      });
    }
  } catch (e) {
    console.warn("Pas de mapping députés", e);
  }

  // Groupes
  try {
    const r = await fetch(`${URL_GROUPES}?v=${Date.now()}`);
    if (r.ok) {
      const arr = await r.json();
      arr.forEach((g) => {
        if (g.code) MAP_GROUPES[g.code] = g.sigle || g.libelle || g.code;
      });
    }
  } catch (e) {
    console.warn("Pas de mapping groupes", e);
  }
}

async function loadLois() {
  const r = await fetch(`${URL_LOIS}?v=${Date.now()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  LOIS = await r.json();
}

// ---- Init ----
(async function init() {
  try {
    await Promise.all([loadMaps(), loadLois()]);
    render();
  } catch (e) {
    if (els.err) {
      els.err.textContent = `Erreur de chargement des lois.\n${e?.message || e}`;
    }
    console.error(e);
  }
})();

els.search && els.search.addEventListener("input", render);