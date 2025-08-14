/* eslint-disable no-console */
(() => {
  // ===== Caminhos =====
  const PATH_POKEMON  = "../../../json-db/pokemon.json";
  const PATH_TRAINERS = "../../../json-db/trainers.json";
  const PATH_MOVES    = "../../../json-db/moves.json";
  const TRAINER_SPRITE = (id) => `../../../assets/trainers/${id}/battle-sprite.png`;

  // ===== Estado =====
  let pokedex = [];
  let pokedexIndex = new Map();
  let trainers = [];
  let moves = [];

  // ===== UI refs =====
  const $trainerName   = () => $("#trainerName");
  const $trainerSprite = () => $("#trainerSprite");
  const $chat          = () => $("#chatArea");
  const $btnStart      = () => $("#btnStart");

  // HUD refs
  const $oppName   = () => $("#oppName");
  const $oppLv     = () => $("#oppLv");
  const $oppBalls  = () => $("#oppBalls");
  const $oppHpFill = () => $("#oppHpFill");
  const $oppSprite = () => $("#oppSprite");

  const $plyName   = () => $("#plyName");
  const $plyLv     = () => $("#plyLv");
  const $plyBalls  = () => $("#plyBalls");
  const $plyHpFill = () => $("#plyHpFill");
  const $plySprite = () => $("#plySprite");

  // ===== LocalStorage =====
  function readLocalStorageSafely(key, expectJson = false) {
    const raw = localStorage.getItem(key);
    if (raw == null) return { ok: false, value: null, error: `localStorage["${key}"] ausente` };
    if (!expectJson) return { ok: true, value: raw };
    try { return { ok: true, value: JSON.parse(raw) }; }
    catch { return { ok: false, value: null, error: `localStorage["${key}"] não é JSON válido` }; }
  }

  function validateEnv() {
    const rank = readLocalStorageSafely("current_rank", false);
    const account = readLocalStorageSafely("closed_challenge_account", true);
    const bag = readLocalStorageSafely("bag_info", true);

    const errors = [];
    if (!rank.ok) errors.push(rank.error);
    if (!account.ok) errors.push(account.error);
    if (!bag.ok) errors.push(bag.error);
    if (errors.length) {
      errors.forEach(e => console.warn(e));
      return null;
    }

    const rankNum = Number(rank.value);
    if (Number.isNaN(rankNum)) {
      console.warn('current_rank precisa ser número. Valor:', rank.value);
      return null;
    }
    return { rank: rankNum, account: account.value, bag: bag.value };
  }

  // ===== Carregamento =====
  async function loadJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao carregar ${url} (${res.status})`);
    return res.json();
  }

  async function preloadData() {
    [pokedex, trainers, moves] = await Promise.all([
      loadJson(PATH_POKEMON),
      loadJson(PATH_TRAINERS),
      loadJson(PATH_MOVES),
    ]);
    pokedexIndex = new Map(pokedex.map(p => [p.id, p]));
  }

  // ===== Utilidades =====
  function firstPlayerPokemon(accountObj) {
    const keys = Object.keys(accountObj)
      .filter(k => /^pokemon-\d+$/.test(k))
      .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
    if (!keys.length) return null;
    return accountObj[keys[0]];
  }

  function countPlayerTeam(accountObj) {
    return Object.keys(accountObj).filter(k => /^pokemon-\d+$/.test(k)).length || 0;
  }

  function trainerByRank(rank) {
    const pool = trainers.filter(t => Number(t.rank) === Number(rank));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pokemonById(id) { return pokedexIndex.get(Number(id)); }
  function pokemonNameById(id) {
    const p = pokemonById(id);
    return p ? p.name : `#${id}`;
  }

  // HP simplificado (placeholder): 35 + (level * 3)
  function calcMaxHp(level) { return 35 + (Number(level) || 1) * 3; }

  function setHp($fill, current, max) {
    const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
    $fill.css("width", pct + "%");
    $fill.toggleClass("low", pct <= 25);
  }

  function renderBalls($container, count, max = count) {
    const balls = [];
    for (let i = 0; i < max; i++) {
      balls.push(`<span class="ball${i < count ? "" : " empty"}" title="Poké ${i+1}"></span>`);
    }
    $container.html(balls.join(""));
  }

  // --- Safe area do rodapé dinâmico ---
  function setCssVar(name, value) {
    document.documentElement.style.setProperty(name, value);
  }
  function measureFooter() {
    const $footer = $(".chat-footer");
    if (!$footer.length) return;
    const h = $footer.outerHeight(true) || 0;
    setCssVar("--chat-footer-height", `${h}px`);
  }
  function installFooterAutoMeasure() {
    $(window).on("resize orientationchange", () => {
      clearTimeout(window.__footerRaf);
      window.__footerRaf = setTimeout(measureFooter, 50);
    });
    const chatEl = document.getElementById("chatArea");
    if (chatEl && "MutationObserver" in window) {
      const mo = new MutationObserver(() => requestAnimationFrame(measureFooter));
      mo.observe(chatEl, { childList: true, subtree: true });
    }
    const footerEl = document.querySelector(".chat-footer");
    if (footerEl && "ResizeObserver" in window) {
      const ro = new ResizeObserver(() => measureFooter());
      ro.observe(footerEl);
    }
    measureFooter();
  }

  function renderChatMessage(htmlText) {
    $chat().html(`
      <div class="d-flex align-items-start gap-2">
        <div class="flex-grow-1">
          <div class="small">${htmlText}</div>
        </div>
      </div>
    `);
  }

  // Modal GiveUp
  function showGiveUpModal() {
    const modalEl = document.getElementById("giveUpModal");
    const modal = new bootstrap.Modal(modalEl);
    // Botões
    $("#btnGiveUpYes").off("click").on("click", () => {
      // redireciona para a tela principal de ranked
      window.location.href = "../ranked-battle.html";
    });
    // btnGiveUpNo já tem data-bs-dismiss="modal" no HTML
    modal.show();
  }

  function renderMenu(onAction) {
    $chat().html(`
      <div class="d-flex align-items-center justify-content-between gap-2 chat-actions">
        <button class="btn btn-outline-primary w-100" data-act="attack">Attack</button>
        <button class="btn btn-outline-secondary w-100" data-act="item">Item</button>
        <button class="btn btn-outline-danger w-100" data-act="giveup">GiveUp</button>
      </div>
    `);
    $chat().find("button").on("click", function () {
      const action = $(this).data("act");
      onAction?.(action);
    });
    requestAnimationFrame(measureFooter);
  }

  // ===== Batalha (setup) =====
  function startBattle(env) {
    const playerMon = firstPlayerPokemon(env.account);
    if (!playerMon) return;

    const opponentTrainer = trainerByRank(env.rank);
    if (!opponentTrainer) return;

    // Topo: nome + sprite
    $trainerName().text(opponentTrainer.name || "Trainer");
    const spritePath = TRAINER_SPRITE(opponentTrainer.id);
    const fallback = opponentTrainer.image || "";
    $trainerSprite().attr("src", spritePath).on("error", function () {
      if (fallback) $(this).attr("src", fallback);
    });

    const opponentFirst = opponentTrainer.pokemon?.[0];
    if (!opponentFirst) return;

    // Dados de exibição
    const playerPokeData = pokemonById(playerMon.idpoke) || { name: `#${playerMon.idpoke}`, image: "" };
    const oppPokeData    = pokemonById(opponentFirst.id) || { name: `#${opponentFirst.id}`, image: "" };

    // HUD Opponent
    $("#oppName").text(oppPokeData.name);
    $("#oppLv").text(opponentFirst.level ?? "—");
    renderBalls($("#oppBalls"), (opponentTrainer.pokemon || []).length);
    $("#oppSprite").attr("src", oppPokeData.image || "").attr("alt", oppPokeData.name);

    // HUD Player
    $("#plyName").text(playerPokeData.name);
    $("#plyLv").text(playerMon.currentLevel ?? "—");
    renderBalls($("#plyBalls"), countPlayerTeam(env.account));
    $("#plySprite").attr("src", playerPokeData.image || "").attr("alt", playerPokeData.name);

    // HP inicial (cheio)
    const oppMaxHp = calcMaxHp(opponentFirst.level);
    const plyMaxHp = calcMaxHp(playerMon.currentLevel);
    setHp($("#oppHpFill"), oppMaxHp, oppMaxHp);
    setHp($("#plyHpFill"), plyMaxHp, plyMaxHp);

    // Logs exigidos
    console.log(`player usou pokemon ${pokemonNameById(playerMon.idpoke)};`);
    console.log(`adversario usou pokemon ${pokemonNameById(opponentFirst.id)}.`);

    // Rodapé: 1) mensagem -> 2) menu (delay 3000ms)
    renderChatMessage(`Trainer <strong>${opponentTrainer.name}</strong> accepts your challenge!`);
    setTimeout(() => renderMenu((action) => {
      if (action === "attack") {
        console.log("Menu: Attack");
        renderChatMessage("You chose <strong>Attack</strong>.");
      } else if (action === "item") {
        console.log("Menu: Item");
        renderChatMessage("You opened your <strong>Bag</strong>.");
      } else if (action === "giveup") {
        console.log("Menu: GiveUp");
        showGiveUpModal();
      }
    }), 3000);
  }

  // ===== Inicialização =====
  async function main() {
    installFooterAutoMeasure();

    try { await preloadData(); }
    catch (err) { console.error(err); }

    $btnStart().on("click", () => {
      const env = validateEnv();
      if (!env) return;
      startBattle(env);
      requestAnimationFrame(measureFooter);
    });

    renderChatMessage("Ready to battle.");
    requestAnimationFrame(measureFooter);
  }

  $(main);
})();
