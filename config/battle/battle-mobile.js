$(function(){
  // (opcional) limpar battleData como você comentou:
  // localStorage.removeItem('battleData');

  // ----- Storage -----
  const closedData = safeParse(localStorage.getItem('closed_challenge_account')) || {};
  const battleData = safeParse(localStorage.getItem('battleData')) || {};
  const bagInfo = getBagInfo(); // { pokeball: number, potion: number }

  // ----- Regras -----
  const MAX_HP = 500;
  const BASE_ATK = 100;
  const BASE_DEF = 100;
  const MSG_DELAY_MS = 200; // tempo para mensagens de dano

  // ----- Estado -----
  let pokemons = [], items = [], moves = [];
  let player = null, opponent = null;

  // ----- Carregar JSONs -----
  Promise.all([
    $.getJSON('../../json-db/pokemon.json'),
    $.getJSON('../../json-db/starter-items.json'),
    $.getJSON('../../json-db/moves.json')
  ]).then(([pokemonsList, itemsList, movesList])=>{
    pokemons = pokemonsList || [];
    items = itemsList || [];
    moves = movesList || [];

    player = buildPlayerFromClosed(closedData, pokemons, items, moves);
    opponent = buildOpponentFromBattleData(battleData, pokemons, moves, player);

    if(!player || !player.base){
      $('#battle-text').text('Não foi possível montar seu Pokémon. Cheque closed_challenge_account e pokemon.json.');
      return;
    }
    if(!opponent || !opponent.base){
      $('#battle-text').text('Não foi possível montar o oponente. Cheque battleData/pokemon.json.');
      return;
    }

    renderHUDs();
    renderSprites();
    bindMenus();
    updateBagMenuCounts(); // mostra as quantidades no menu da mochila
  }).catch(()=>{
    $('#battle-text').text('Erro ao carregar dados.');
  });

  /* ============== Builders ============== */

  function buildPlayerFromClosed(closed, pokes, itemsList, movesList){
    const slot = closed && closed['pokemon-1'];
    const base = pokes.find(p => p.id === Number(slot?.idpoke)) || pokes[0] || null;
    if(!base) return null;

    const level = Number(slot?.currentLevel) || 5;

    // Moves do player
    let myMoves = [];
    const idsFromClosed = Array.isArray(slot?.moves) ? slot.moves.map(Number) : [];
    if(idsFromClosed.length){
      myMoves = idsFromClosed.map(id => movesList.find(m => m.id === id)).filter(Boolean);
    }else{
      myMoves = (base.moves || []).map(m => movesList.find(x => x.id === Number(m.id))).filter(Boolean);
    }
    if(myMoves.length === 0 && movesList.length) myMoves = [movesList[0]];

    const item = itemsList.find(i => i.id === Number(closed?.iditem)) || null;

    return makeCombatant(base, level, myMoves, item);
  }

  function buildOpponentFromBattleData(battle, pokes, movesList, playerRef){
    let base = pokes.find(p => p.id === Number(battle?.pokeId));
    if(!base){
      base = pokes.find(p => !playerRef || p.id !== playerRef.base.id) || pokes[0] || null;
    }
    if(!base) return null;

    let itsMoves = (base.moves || []).map(m => movesList.find(x => x.id === Number(m.id))).filter(Boolean);
    if(itsMoves.length === 0 && movesList.length) itsMoves = [movesList[0]];

    const level = Number(battle?.opponentLevel) || 5;

    return makeCombatant(base, level, itsMoves, null);
  }

  function makeCombatant(base, level, moveset, item){
    return {
      base,
      level,
      maxHp: MAX_HP,
      currentHp: MAX_HP,
      atk: BASE_ATK,
      def: BASE_DEF,
      moveset: moveset.slice(0, 4),
      item
    };
  }

  /* ============== UI / Menus ============== */

  function renderHUDs(){
    $('#player-name').text(player.base.name || 'Você');
    $('#player-level').text('Lv ' + (player.level ?? '—'));
    setHp($('#player-hp'), toPct(player.currentHp, player.maxHp));

    $('#opponent-name').text(opponent.base.name || '???');
    $('#opponent-level').text('Lv ' + (opponent.level ?? '—'));
    setHp($('#opponent-hp'), toPct(opponent.currentHp, opponent.maxHp));
  }

  function renderSprites(){
    $('#player-sprite')
      .attr('src', player.base.image || '')
      .on('load', function(){ $(this).removeClass('d-none').addClass('show'); });

    $('#opponent-sprite')
      .attr('src', opponent.base.image || '')
      .on('load', function(){ $(this).removeClass('d-none').addClass('show'); });
  }

  function bindMenus(){
    // Lutar → submenu de moves
    $('[data-action="attack"]').off('click').on('click', openMovesMenu);

    // Mochila → submenu de itens
    $('[data-action="bag"]').off('click').on('click', openBagMenu);

    // Pokémon (placeholder)
    $('[data-action="pokemon"]').off('click').on('click', ()=> $('#battle-text').text('Trocar de Pokémon (placeholder).'));

    // Fugir → rota
    $('[data-action="run"]').off('click').on('click', ()=>{
      window.location.href = '../map/route/route-view.html';
    });

    // Voltar dos submenus
    $('#btn-back').off('click').on('click', backToActions);
    $('#btn-back-bag').off('click').on('click', backToActions);

    // Ações de clique na mochila
    $('#btn-pokeball').off('click').on('click', ()=>{
      console.log(`Usar Poké Ball (x${bagInfo.pokeball}) — sem efeito por enquanto`);
      $('#battle-text').text(`Poké Ball (x${bagInfo.pokeball}) — ainda sem efeito.`);
    });
    $('#btn-potion').off('click').on('click', ()=>{
      usePotion();
    });

    // Pós-batalha
    $('#btn-exit').off('click').on('click', ()=>{
      window.location.href = '../map/route/route-view.html';
    });
    $('#btn-catch').off('click').on('click', ()=>{
      // Por enquanto capturar sempre usa Poké Ball (1x)
      attemptCapture('pokeball');
    });
  }

  function openMovesMenu(){
    const $container = $('#moves-container').empty();
    if(!player.moveset || player.moveset.length === 0){
      $('<div class="col-12"></div>')
        .append('<div class="text-center small">Sem movimentos disponíveis.</div>')
        .appendTo($container);
    }else{
      player.moveset.forEach((mv, idx)=>{
        const label = `${mv.name} (${mv.power || 0})`;
        const $btn = $('<button/>', {
          class: 'btn btn-action w-100',
          text: label,
          'data-move-index': idx
        }).on('click', ()=> playerUseMove(idx));
        $('<div class="col-6"></div>').append($btn).appendTo($container);
      });
    }
    toggleMenus('moves');
    $('#battle-text').text('Escolha um movimento.');
  }

  function openBagMenu(){
    updateBagMenuCounts();
    toggleMenus('bag');
    $('#battle-text').text('Mochila aberta.');
  }

  function updateBagMenuCounts(){
    $('#btn-pokeball').text(`Poké Ball (x${bagInfo.pokeball})`);
    $('#btn-potion').text(`Potion (x${bagInfo.potion})`);
  }

  function backToActions(){
    toggleMenus('actions');
    $('#battle-text').text('Escolha sua ação.');
  }

  function toggleMenus(which){
    // esconde todos
    $('#action-menu').addClass('d-none');
    $('#moves-menu').addClass('d-none');
    $('#bag-menu').addClass('d-none');
    $('#post-battle-menu').addClass('d-none');

    if(which === 'moves') $('#moves-menu').removeClass('d-none');
    else if(which === 'bag') $('#bag-menu').removeClass('d-none');
    else if(which === 'post') $('#post-battle-menu').removeClass('d-none');
    else $('#action-menu').removeClass('d-none');
  }

  /* ============== Turnos / Combate ============== */

  function playerUseMove(index){
    const move = player.moveset[index];
    if(!move) return;

    // Player ataca primeiro
    performAttack(player, opponent, move, '#opponent-hp', ()=>{
      if(isFainted(opponent)){
        handleOpponentFainted();
        return;
      }
      // Oponente responde
      const oMv = pickRandomMove(opponent.moveset);
      performAttack(opponent, player, oMv, '#player-hp', ()=>{
        if(isFainted(player)){
          $('#battle-text').text(`${player.base.name} desmaiou!`);
        }
        backToActionsSoon();
      });
    });
  }

  function performAttack(attacker, defender, move, hpSelector, done){
    checkItem(attacker, defender);
    const dmg = Math.max(0, calcDamage(attacker, defender, move));
    defender.currentHp = Math.max(0, defender.currentHp - dmg);
    setHp($(hpSelector), toPct(defender.currentHp, defender.maxHp));
    $('#battle-text').text(`${attacker.base.name} usou ${move?.name || 'ataque'}! Dano: ${dmg}`);

    setTimeout(()=> done && done(), MSG_DELAY_MS);
  }

  function pickRandomMove(moveset){
    if(!moveset || moveset.length === 0) return { name:'ataque', power:0 };
    const i = Math.floor(Math.random() * moveset.length);
    return moveset[i];
  }

  function backToActionsSoon(){
    setTimeout(()=>{
      toggleMenus('actions');
    }, 200);
  }

  /* ============== Pós-batalha / EXP ============== */

  function handleOpponentFainted(){
    // calcula EXP do oponente (se não houver no json, usa 100)
    const expGain = getOpponentExp(opponent.base);
    const result = awardExperience(expGain); // persiste e atualiza player.level/exp
    renderHUDs(); // atualiza HUD de nível, se mudou

    // mensagem de ganho de exp e possíveis level ups
    if(result.leveledUp > 0){
      $('#battle-text').text(
        `${opponent.base.name} desmaiou! +${expGain} EXP. Level up x${result.leveledUp} → Lv ${result.newLevel} (EXP atual: ${result.currentExp}).`
      );
    }else{
      $('#battle-text').text(
        `${opponent.base.name} desmaiou! +${expGain} EXP. EXP atual: ${result.currentExp}/${player.level*100}.`
      );
    }

    // mostra menu pós-batalha (Capturar / Sair)
    toggleMenus('post');
  }

  function getOpponentExp(poke){
    const raw = poke && poke.exp;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function awardExperience(expGain){
    const closed = safeParse(localStorage.getItem('closed_challenge_account')) || {};
    const slot = closed['pokemon-1'] || {};
    slot.currentLevel = Number(slot.currentLevel) || player.level || 1;
    slot.currentExp = Number(slot.currentExp) || 0;

    slot.currentExp += Number(expGain) || 0;

    // aplica level-up enquanto houver EXP suficiente
    let leveledUp = 0;
    while(slot.currentExp >= (slot.currentLevel * 100)){
      slot.currentExp -= (slot.currentLevel * 100);
      slot.currentLevel += 1;
      leveledUp += 1;
    }

    // reflete no estado do player e persiste
    player.level = slot.currentLevel;
    closed['pokemon-1'] = {
      ...closed['pokemon-1'],
      currentLevel: slot.currentLevel,
      currentExp: slot.currentExp
    };
    localStorage.setItem('closed_challenge_account', JSON.stringify(closed));

    return { newLevel: slot.currentLevel, currentExp: slot.currentExp, leveledUp };
  }

  /* ============== Captura ============== */

  // ballType: 'pokeball' | 'greatball' | 'superball' | 'ultraball'
  function attemptCapture(ballType = 'pokeball'){
    const multipliers = {
      pokeball: 1,
      greatball: 2,
      superball: 3,
      ultraball: 4
    };

    const mult = multipliers[ballType] || 1;

    // verificar estoque da ball (por enquanto só Poké Ball conta)
    if(ballType === 'pokeball' && bagInfo.pokeball <= 0){
      $('#battle-text').text('Você não tem Poké Balls!');
      return; // permanece no menu pós-batalha
    }

    // consumir 1 ball
    if(ballType === 'pokeball'){
      bagInfo.pokeball = Math.max(0, (bagInfo.pokeball || 0) - 1);
      localStorage.setItem('bag_info', JSON.stringify(bagInfo));
      updateBagMenuCounts(); // caso o jogador abra a mochila depois
    }

    // calcula chance
    const baseCatch = Number(opponent.base.catchRate) || 90; // 1 ~ 100, default 20
    const chance = Math.min(100, baseCatch * mult);
    const roll = Math.random() * 100;

    const success = roll < chance;

    if(success){
      // mensagem
      $('#battle-text').text(`Incrível! ${opponent.base.name} foi capturado!`);

      // salvar no closed_challenge_account como pokemon-N
      addCapturedPokemon(opponent.base, opponent.level);

      // vai para a rota
      setTimeout(()=> goToRoute(), 900);
    }else{
      $('#battle-text').text(`Que pena! ${opponent.base.name} fugiu!`);
      // sem mensagem extra, apenas sair para rota
      setTimeout(()=> goToRoute(), 900);
    }
  }

  function addCapturedPokemon(pokeBase, level){
    const closed = safeParse(localStorage.getItem('closed_challenge_account')) || {};
    // descobrir próximo índice N
    let maxN = 0;
    Object.keys(closed).forEach(k=>{
      const m = /^pokemon-(\d+)$/.exec(k);
      if(m) maxN = Math.max(maxN, Number(m[1]));
    });
    const nextKey = `pokemon-${maxN + 1}`;

    // pegar um move básico do próprio pokemon.json (se existir)
    let moveIds = [];
    if(Array.isArray(pokeBase.moves) && pokeBase.moves.length){
      moveIds = [ Number(pokeBase.moves[0].id) ];
    }

    closed[nextKey] = {
      idpoke: pokeBase.id,
      currentLevel: Number(level) || 5,
      moves: moveIds,
      currentExp: 0
    };

    localStorage.setItem('closed_challenge_account', JSON.stringify(closed));
  }

  function goToRoute(){
    window.location.href = '../map/route/route-view.html';
  }

  /* ============== Funções pedidas ============== */

  function usePotion(){
    // vida cheia → não usa, volta pro menu principal imediatamente
    if(player.currentHp >= player.maxHp){
      $('#battle-text').text('vida já está cheia');
      toggleMenus('actions');
      return;
    }

    // sem potions → só avisa (permanece na mochila)
    if(bagInfo.potion <= 0){
      $('#battle-text').text('Você não tem Potions!');
      return;
    }

    // consome 1 potion e cura 20
    const before = player.currentHp;
    player.currentHp = Math.min(player.maxHp, player.currentHp + 20);
    const healed = player.currentHp - before;

    bagInfo.potion -= 1;
    localStorage.setItem('bag_info', JSON.stringify(bagInfo));
    updateBagMenuCounts();

    setHp($('#player-hp'), toPct(player.currentHp, player.maxHp));
    $('#battle-text').text(`${player.base.name} usou uma Potion! +${healed} HP.`);

    // consumir turno: esconde menus enquanto o oponente age
    toggleMenus(); // esconde todos

    // depois do delay, oponente ataca (se ainda estiver vivo)
    setTimeout(()=>{
      if(isFainted(opponent)){
        handleOpponentFainted();
        return;
      }
      const oMv = pickRandomMove(opponent.moveset);
      performAttack(opponent, player, oMv, '#player-hp', ()=>{
        if(isFainted(player)){
          $('#battle-text').text(`${player.base.name} desmaiou!`);
        }
        backToActionsSoon();
      });
    }, MSG_DELAY_MS);
  }

  function checkItem(attacker, defender){
    console.log(`poke ${attacker.base.name} tem item ${attacker.item ? attacker.item.name : 'Nenhum'}; ` +
                `poke ${defender.base.name} tem item ${defender.item ? defender.item.name : 'Nenhum'}`);
  }

  function calcDamage(attacker, defender, move){
    const atk = Number(attacker.atk) || 0;
    const def = Number(defender.def) || 0;
    const power = Number(move?.power) || 0;
    return (atk + power) - def;
  }

  /* ============== Utils ============== */

  function getBagInfo(){
    // Esperado algo como: { "pokeball": 3, "potion": 2 }
    const raw = safeParse(localStorage.getItem('bag_info')) || {};
    const pokeball = Number(raw.pokeball ?? raw.pokeballs ?? 0);
    const potion   = Number(raw.potion ?? 0);
    return { pokeball: isNaN(pokeball)?0:pokeball, potion: isNaN(potion)?0:potion };
  }

  function setHp($bar, pct){
    const val = clamp(Math.round(pct), 0, 100);
    $bar.css('width', val + '%');
    $bar.removeClass('hp-mid hp-low');
    if(val <= 30) $bar.addClass('hp-low');
    else if(val <= 60) $bar.addClass('hp-mid');
  }

  function toPct(current, max){ return max > 0 ? (current / max) * 100 : 0; }
  function isFainted(c){ return !c || c.currentHp <= 0; }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function safeParse(str){ try{ return JSON.parse(str); }catch(_){ return null; } }
});
