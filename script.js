async function chargerLois() {
  try {
    const response = await fetch("lois/lois.json");
    const lois = await response.json();

    const container = document.getElementById("lois");
    const searchInput = document.getElementById("search");

    function afficherLois(data) {
      container.innerHTML = "";
      data.forEach(l => {
        const card = document.createElement("div");
        card.className = "card loi-card";

        card.innerHTML = `
          <h3>${l.titre}</h3>
          <p><strong>Type :</strong> ${l.type}</p>
          <p><strong>Auteur :</strong> ${l.auteur}</p>
          <p><strong>Date :</strong> ${l.date}</p>
          <p><strong>État :</strong> ${l.etat}</p>
          <p><a href="${l.url}" target="_blank">Voir le dossier</a></p>
        `;
        container.appendChild(card);
      });
    }

    // Première affichage
    afficherLois(lois);

    // Recherche en direct
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      const filtres = lois.filter(l =>
        (l.titre || "").toLowerCase().includes(q) ||
        (l.type || "").toLowerCase().includes(q) ||
        (l.auteur || "").toLowerCase().includes(q) ||
        (l.etat || "").toLowerCase().includes(q)
      );
      afficherLois(filtres);
    });

  } catch (e) {
    document.getElementById("lois").innerHTML =
      `<p style="color:red">Erreur de chargement des lois : ${e}</p>`;
  }
}

chargerLois();