// Caminhos relativos (a partir de pages/store/)
const JSON_URL = "../../json-db/items.json";
const ASSETS_BASE = "../../assets/items/";
const COIN_IMG = '<img src="../../assets/items/pokecoin.png" alt="pokecoin" class="coin-icon" />';

// Estado atual do item no modal
let currentItem = null;
let buyModalInstance = null;

// Utilidades de exibição
const currencyCoin = (n) => `${n} ${COIN_IMG}`;

// ========= Helpers: LocalStorage =========
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Erro ao salvar no localStorage:", key, e);
  }
}

// Garante a estrutura de current_cash
function getCurrentCash() {
  const def = { pokecoins: 0, "closed-tickets": 0 };
  const cash = readJSON("current_cash", def);
  if (typeof cash.pokecoins !== "number") cash.pokecoins = 0;
  if (typeof cash["closed-tickets"] !== "number") cash["closed-tickets"] = 0;
  return cash;
}

function setCurrentCash(cash) {
  writeJSON("current_cash", cash);
}

// Garante a estrutura de bag_info (objeto com chaves: pokeball, potion, etc.)
function getBagInfo() {
  const bag = readJSON("bag_info", {});
  return bag && typeof bag === "object" ? bag : {};
}

function setBagInfo(bag) {
  writeJSON("bag_info", bag);
}

// Normaliza o nome do item para chave do bag (ex.: "Poké Ball" -> "pokeball")
function itemNameToBagKey(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "");
}

// ========= HUD =========
function ensureDefaults() {
  // Se não existir, cria com valores típicos para facilitar testes
  const cash = getCurrentCash();
  const bag = getBagInfo();

  // Garante chaves mínimas na bag
  if (typeof bag.pokeball !== "number") bag.pokeball = 0;
  if (typeof bag.potion !== "number") bag.potion = 0;

  setCurrentCash(cash);
  setBagInfo(bag);
}

function renderHUD() {
  const { pokecoins, "closed-tickets": closedTickets } = getCurrentCash();
  const bag = getBagInfo();
  const pokeball = typeof bag.pokeball === "number" ? bag.pokeball : 0;
  const potion = typeof bag.potion === "number" ? bag.potion : 0;

  $("#hudPokecoins").text(pokecoins);
  $("#hudClosedTickets").text(closedTickets);
  $("#hudPokeball").text(pokeball);
  $("#hudPotion").text(potion);
}

// ========= Renderização dos cards =========

// Fallback de imagem: usa "image" do JSON, senão tenta por nome
function resolveImageSrc(item) {
  if (item.image && item.image.trim().length > 0) {
    return ASSETS_BASE + item.image.trim();
  }
  const guess = item.name ? item.name.toLowerCase().replace(/\s+/g, "") + ".png" : "";
  return ASSETS_BASE + guess;
}

// Renderiza um card Bootstrap para um item
function renderItemCard(item) {
  const imgSrc = resolveImageSrc(item);
  const titleId = `item-title-${item.id}`;

  return `
    <div class="col-12 col-sm-6 col-lg-4" role="listitem">
      <div class="card h-100" data-item-id="${item.id}">
        <img src="${imgSrc}" class="card-img-top" alt="${item.name}" onerror="this.src='${ASSETS_BASE}pokeball.png'"/>
        <div class="card-body">
          <h3 id="${titleId}" class="card-title h5 mb-1">${item.name}</h3>
          <p class="text-secondary small mb-2">${item.description || "Sem descrição."}</p>
          <div class="d-flex justify-content-between align-items-center">
            <span class="price">${currencyCoin(item.price)}</span>
            <button class="btn btn-primary btn-sm buy-btn" aria-labelledby="${titleId}">Buy</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========= Modal de compra =========
function clearModalAlerts() {
  $("#buyModal .modal-body .alert").remove();
}

function showModalAlert(type, msg) {
  const html = `
    <div class="alert alert-${type} py-2 mb-2" role="alert">
      ${msg}
    </div>
  `;
  $("#buyModal .modal-body").prepend(html);
}

function openBuyModal(item) {
  currentItem = item;

  $("#buyModalLabel").text(`Comprar ${item.name}`);
  $("#modalItemDesc").text(item.description || "Sem descrição.");
  $("#modalItemImg").attr("src", resolveImageSrc(item)).attr("alt", item.name);

  clearModalAlerts();
  $("#qtyRange").val(1);
  $("#qtyBadge").text(1);
  $("#unitPrice").html(currencyCoin(item.price));
  $("#totalPrice").html(currencyCoin(item.price * 1));

  if (!buyModalInstance) {
    buyModalInstance = new bootstrap.Modal("#buyModal", { backdrop: "static" });
  }
  buyModalInstance.show();
}

// ========= Carregamento / Cache =========
const itemCache = new Map();

async function refreshItemsCache() {
  const resp = await fetch(JSON_URL);
  if (!resp.ok) throw new Error(`Falha ao carregar JSON (${resp.status})`);
  const data = await resp.json();
  const martItems = (data || []).filter((it) => it && it.mart === true);
  itemCache.clear();
  martItems.forEach((it) => itemCache.set(Number(it.id), it));
  return martItems;
}

// ========= Inicialização =========
(async function initWithCache() {
  try {
    ensureDefaults();
    renderHUD();

    const martItems = await refreshItemsCache();
    const html = martItems.map(renderItemCard).join("");
    $("#items-grid").html(html);
    $("#count-badge").text(martItems.length);
    if (martItems.length === 0) {
      $("#alert-area").html(`
        <div class="alert alert-warning" role="alert">
          Nenhum item disponível no Mart.
        </div>
      `);
    }
  } catch (err) {
    console.error(err);
    $("#alert-area").html(`
      <div class="alert alert-danger" role="alert">
        Não foi possível carregar os itens. Verifique o arquivo <code>items.json</code>.
      </div>
    `);
  }

  $("#items-grid").on("click", ".buy-btn", function () {
    const id = Number($(this).closest(".card").data("item-id"));
    const item = itemCache.get(id);
    if (item) openBuyModal(item);
  });
})();

// Atualização dinâmica ao mover a barrinha
$("#qtyRange").on("input change", function () {
  const qty = Number($(this).val());
  $("#qtyBadge").text(qty);
  if (currentItem) {
    $("#totalPrice").html(currencyCoin(currentItem.price * qty));
  }
});

// ========= Confirmação de compra =========
$("#confirmBuyBtn").on("click", function () {
  if (!currentItem) return;

  clearModalAlerts();

  const qty = Number($("#qtyRange").val());
  const total = currentItem.price * qty;

  // 1) Verifica saldo
  const cash = getCurrentCash();
  if (cash.pokecoins < total) {
    showModalAlert(
      "danger",
      `Saldo insuficiente. Você precisa de ${currencyCoin(total)} e possui ${currencyCoin(cash.pokecoins)}.`
    );
    return;
  }

  // 2) Desconta do current_cash e salva
  cash.pokecoins -= total;
  setCurrentCash(cash);

  // 3) Atualiza bag_info
  const bag = getBagInfo();
  const key = itemNameToBagKey(currentItem.name); // ex.: "Pokeball" -> "pokeball"
  const currentQty = typeof bag[key] === "number" ? bag[key] : 0;
  bag[key] = currentQty + qty;
  setBagInfo(bag);

  // 4) Feedback visual
  $("#alert-area").html(`
    <div class="alert alert-success alert-dismissible fade show mt-2" role="alert">
      Você comprou <strong>${qty}× ${currentItem.name}</strong> por ${currencyCoin(total)}.
      Saldo restante: <strong>${currencyCoin(cash.pokecoins)}</strong>.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>
  `);

  // 5) Atualiza HUD
  renderHUD();

  // Fecha modal e limpa estado
  if (buyModalInstance) buyModalInstance.hide();
  currentItem = null;
});
