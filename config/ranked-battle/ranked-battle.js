// ============================
//  RANKED BATTLE – SCRIPT
// ============================
// Caminhos relativos a partir de config/ranked-battle/ranked-battle.html
const TRAINERS_JSON_PATH = "../../json-db/trainers.json";
const POKEMON_JSON_PATH  = "../../json-db/pokemon.json";

// SVG simples de Pokébola para contar o time
const POKEBALL_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <!-- Círculo externo -->
  <circle cx="12" cy="12" r="11" fill="white" stroke="black" stroke-width="1.5"/>
  
  <!-- Metade superior vermelha -->
  <path d="M1 12a11 11 0 0 1 22 0" fill="red" stroke="black" stroke-width="1.5"/>
  
  <!-- Linha horizontal preta -->
  <line x1="1" y1="12" x2="23" y2="12" stroke="black" stroke-width="1.5"/>
  
  <!-- Botão central -->
  <circle cx="12" cy="12" r="2.5" fill="white" stroke="black" stroke-width="1.5"/>
</svg>
`.trim();

$(async function () {
  try {
    // 1) Current rank do localStorage (fallback: 1)
    let currentRank = parseInt(localStorage.getItem("current_rank"), 10);
    if (Number.isNaN(currentRank) || currentRank <= 0) {
      currentRank = 1;
      localStorage.setItem("current_rank", String(currentRank));
    }

    // 2) Carrega trainers e pokémons
    const [trainers, pokemons] = await Promise.all([
      $.getJSON(TRAINERS_JSON_PATH),
      $.getJSON(POKEMON_JSON_PATH)
    ]);

    // Ordena por rank ascendente
    trainers.sort((a, b) => (a.rank || 0) - (b.rank || 0));

    // Mapa por id de pokémon
    const pokeById = new Map(pokemons.map(p => [p.id, p]));

    // 3) Renderiza torre
    renderTower(trainers, currentRank);

    // 4) Header: apenas suspense do rank atual (sem total)
    $("#rankInfo").text(`Rank #${currentRank}`);

    // 5) Clique nos treinadores (modal condicional)
    $("#tower").off("click", ".trainer-step").on("click", ".trainer-step", function () {
      const trainerId = Number($(this).data("id"));
      const trainer = trainers.find(t => t.id === trainerId);
      if (!trainer) return;

      const state = getTrainerState(trainer.rank, currentRank); // "current" | "past" | "future"
      openTrainerModal(trainer, state, pokeById);
    });

  } catch (err) {
    console.error("Erro carregando torre:", err);
    $("#tower").html(
      `<div class="alert alert-danger">Não foi possível carregar os dados. Verifique os caminhos dos JSON.</div>`
    );
  }
});

/**
 * Renderiza a torre completa
 */
function renderTower(trainers, currentRank) {
  const $tower = $("#tower").empty();

  trainers.forEach(tr => {
    const state = getTrainerState(tr.rank, currentRank); // "current" | "past" | "future"
    const category = String(tr.category || "common").toLowerCase();

    // Classes: categoria + estado
    const classes = ["trainer-step", `cat-${category}`];
    if (state === "current") classes.push("current");
    if (state === "future")  classes.push("silhouette"); // só futuros em silhueta

    // Caminho da imagem local
    const imgPath = `../../assets/trainers/${tr.id}/battle-sprite.png`;
    const pokeCount = Array.isArray(tr.pokemon) ? tr.pokemon.length : 0;

    const $step = $(`
      <div class="${classes.join(" ")}" data-id="${tr.id}" role="button" tabindex="0" aria-label="${escapeHtml(tr.name)}">
        <div class="rank-badge" title="Rank ${tr.rank}">${tr.rank}</div>
        <div class="trainer-img-wrap">
          <img class="trainer-img" alt="${escapeHtml(tr.name)}" loading="lazy">
        </div>
        <div class="trainer-meta flex-grow-1">
          <div class="trainer-name truncate">${escapeHtml(tr.name)}</div>
          <div class="trainer-region">${escapeHtml(tr.region || "")}</div>
          <div class="pokeballs" aria-label="Pokémon count">${repeatSvg(POKEBALL_SVG, pokeCount)}</div>
        </div>
      </div>
    `);

    // Define imagem + fallback
    const $img = $step.find("img");
    $img.attr("src", imgPath);
    $img.on("error", function () {
      $(this).attr(
        "src",
        "data:image/svg+xml;utf8," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="100%" height="100%" fill="#e9ecef"/></svg>'
          )
      );
    });

    if (state === "current") $step.attr("title", "Seu oponente atual");

    $tower.append($step);
  });
}

/**
 * Determina o estado do treinador em relação ao rank atual
 * - current: mesmo rank
 * - past: rank menor que o atual
 * - future: rank maior que o atual
 */
function getTrainerState(trainerRank, currentRank) {
  if (trainerRank === currentRank) return "current";
  if (trainerRank < currentRank)  return "past";
  return "future";
}

/**
 * Abre o modal conforme estado do treinador
 */
function openTrainerModal(trainer, state, pokeById) {
  const modalEl   = document.getElementById("trainerModal");
  const $modal    = $(modalEl);
  const $title    = $modal.find(".modal-title");
  const $body     = $modal.find(".modal-body");
  const $footer   = $modal.find(".modal-footer");

  const trainerImg = `../../assets/trainers/${trainer.id}/battle-sprite.png`;
  const desc = trainer.description || "";

  $title.text(trainer.name);
  $body.empty();
  $footer.empty();

  if (state === "current") {
    // Nome, foto, descrição + Challenge/Leave
    $body.append(`
      <div class="d-flex align-items-center gap-3">
        <div class="trainer-img-wrap" style="width:96px;height:96px;">
          <img src="${trainerImg}" alt="${escapeHtml(trainer.name)}" style="max-width:96px;max-height:96px;">
        </div>
        <div class="small text-muted">${escapeHtml(desc)}</div>
      </div>
    `);
    $footer.append(`
      <button type="button" class="btn btn-primary" id="btnChallenge">Challenge</button>
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Leave</button>
    `);

    // Exemplo de ação Challenge (fechar modal por enquanto)
    $footer.off("click", "#btnChallenge").on("click", "#btnChallenge", function () {
      // Aqui você pode iniciar a batalha, navegar, etc.
      // e.g.: window.location.href = './battle.html';
      const bs = bootstrap.Modal.getOrCreateInstance(modalEl);
      bs.hide();
    });

  } else if (state === "past") {
    // Já vencido: mostrar nome, foto, descrição e thumbnails dos pokémon
    const gallery = buildPokemonGallery(trainer, pokeById);
    $body.append(`
      <div class="d-flex align-items-center gap-3 mb-2">
        <div class="trainer-img-wrap" style="width:96px;height:96px;">
          <img src="${trainerImg}" alt="${escapeHtml(trainer.name)}" style="max-width:96px;max-height:96px;">
        </div>
        <div class="small text-muted">${escapeHtml(desc)}</div>
      </div>
      ${gallery}
    `);
    $footer.append(`
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Leave</button>
    `);

  } else {
    // Futuro: bloqueado
    $body.append(`
      <p class="mb-0 text-center">Get stronger to fight this trainer!</p>
    `);
    $footer.append(`
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Leave</button>
    `);
  }

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/**
 * Monta a galeria com as imagens dos pokémon (para treinadores já vencidos)
 */
function buildPokemonGallery(trainer, pokeById) {
  const team = Array.isArray(trainer.pokemon) ? trainer.pokemon : [];
  if (!team.length) return `<div class="text-muted small">Este treinador não tem pokémon cadastrados.</div>`;

  const items = team.map(slot => {
    const p = pokeById.get(slot.id);
    const img = p?.image || "";
    const alt = p?.name ? escapeHtml(p.name) : `#${slot.id}`;
    const safeImg = img || ("data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54"><rect width="100%" height="100%" fill="#e9ecef"/></svg>'
    ));
    return `
      <div class="poke" title="${alt}">
        <img src="${safeImg}" alt="${alt}">
      </div>
    `;
  }).join("");

  return `<div class="pokemon-gallery">${items}</div>`;
}

/**
 * Repete um SVG n vezes (para desenhar as pokébolas)
 */
function repeatSvg(svg, times) {
  if (!times || times <= 0) return "";
  return new Array(times).fill(svg).join("");
}

/**
 * Escapa texto para evitar quebra de HTML
 */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
