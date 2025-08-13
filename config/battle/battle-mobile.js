$(function(){
  // ----- Storage -----
  const closedData = safeParse(localStorage.getItem('closed_challenge_account')) || {};
  const battleData = safeParse(localStorage.getItem('battleData')) || {};
  const bagInfo = getBagInfo(); // { pokeball: number, potion: number }

  // ----- Regras -----
  const MAX_HP = 500;
  const BASE_ATK = 100;
  const BASE_DEF = 100;
  const MSG_DELAY_MS = 200; // tempo para mensagens de dano/ação

  // ----- Estado -----
  let pokemons = [], items = [], moves = [];
  let party = [];           // equipe do treinador (combatentes)
  let activeIndex = 0;      // índice do pokémon ativo
  let player = null;        // referência ao combatente ativo
  let opponent = null;

  // ----- Carregar JSONs -----
  Promise.all([
    $.getJSON('../../json-db/pokemon.json'),
    $.getJSON('../../json-db/starter-items.json'),
    $.getJSON('../../json-db/moves.json')
  ]).then(([pokemonsList, itemsList, movesList])=>{
    pokemons = pokemonsList || [];
    items = itemsList || [];
    moves = movesList || [];

    // Monta equipe do treinador a partir do closed_challenge_account
    party = buildPartyFromClosed(closedData, pokemons, items, moves);
    // ativo padrão = pokemon-1; se não houver, primeiro disponível
    activeIndex = Math.max(0, party.findIndex(p => p.slotKey === 'pokemon-1'));
    if(activeIndex === -1) activeIndex = 0;
    player = party[activeIndex] || null;

    // Monta oponente
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
    updateBagMenuCounts();
  }).catch(()=>{
    $('#battle-text').text('Erro ao carregar dados.');
  });

  /* ============== Builders ============== */

  function buildPartyFromClosed(closed, pokes, itemsList, movesList){
    const keys = Object.keys(closed || {}).filter(k => /^pokemon-\d+$/.test(k)).sort((a,b)=>{
      const na = Number(a.split('-')[1]); const nb = Number(b.split('-')[1]);
      return na - nb;
    });
    if(keys.length === 0 && closed && closed['pokemon-1']) keys.push('pokemon-1');

    const itemGlobal = itemsList.find(i => i.id === Number(closed?.iditem)) || null;

    const team = keys.map(k=>{
      const slot = closed[k];
      const base = pokes.find(p => p.id === Number(slot?.idpoke)) || pokes[0] || null;
      if(!base) return null;

      const level = Number(slot?.currentLevel) || 5;

      let moveset = [];
      const idsFromClosed = Array.isArray(slot?.moves) ? slot.moves.map(Number) : [];
      if(idsFromClosed.length){
        moveset = idsFromClosed.map(id => moves.find(m => m.id === id)).filter(Boolean);
      }else{
        moveset = (base.moves || []).map(m => moves.find(x => x.id === Number(m.id))).filter(Boolean);
      }
      if(moveset.length === 0 && moves.length) moveset = [moves[0]];

      const c = makeCombatant(base, level, moveset, itemGlobal);
      c.slotKey = k;
      c.currentHp = MAX_HP; // HP começa cheio na batalha (persistir entre batalhas: salvar no storage)
      return c;
    }).filter(Boolean);

    if(team.length === 0 && pokes.length){
      const dummy = makeCombatant(pokes[0], 5,
        (pokes[0].moves || []).map(m => moves.find(x=>x.id===Number(m.id))).filter(Boolean).slice(0,1),
        null
      );
      dummy.slotKey = 'pokemon-1';
      team.push(dummy);
    }
    return team;
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
      item,
      slotKey: null
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

    // Pokémon → modal de troca
    $('[data-action="pokemon"]').off('click').on('click', openPartyModal);

    // Fugir → rota
    $('[data-action="run"]').off('click').on('click', ()=> goToRoute() );

    // Voltar dos submenus
    $('#btn-back').off('click').on('click', backToActions);
    $('#btn-back-bag').off('click').on('click', backToActions);

    // Mochila
    $('#btn-pokeball').off('click').on('click', ()=>{
      console.log(`Usar Poké Ball (x${bagInfo.pokeball}) — sem efeito por enquanto`);
      $('#battle-text').text(`Poké Ball (x${bagInfo.pokeball}) — ainda sem efeito.`);
    });
    $('#btn-potion').off('click').on('click', ()=> usePotion() );

    // Pós-batalha
    $('#btn-exit').off('click').on('click', ()=> goToRoute() );
    $('#btn-catch').off('click').on('click', ()=> attemptCapture('pokeball') );
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
    $('#action-menu, #moves-menu, #bag-menu, #post-battle-menu').addClass('d-none');
    if(which === 'moves') $('#moves-menu').removeClass('d-none');
    else if(which === 'bag') $('#bag-menu').removeClass('d-none');
    else if(which === 'post') $('#post-battle-menu').removeClass('d-none');
    else $('#action-menu').removeClass('d-none');
  }

  /* ============== Modal de Troca ============== */

  function openPartyModal(){
    renderPartyList();
    const modal = new bootstrap.Modal(document.getElementById('partyModal'));
    modal.show();
  }

  function renderPartyList(){
    const $list = $('#party-list').empty();

    party.forEach((c, idx)=>{
      const isActive = idx === activeIndex;
      const fainted = c.currentHp <= 0;

      const hpPct = Math.round(toPct(c.currentHp, c.maxHp));
      const item = $(`
        <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2">
          <img src="${c.base.image}" alt="${c.base.name}" width="48" height="48" style="image-rendering:pixelated"/>
          <div class="flex-grow-1 text-start">
            <div class="d-flex justify-content-between"><span>${c.base.name}</span><span>Lv ${c.level}</span></div>
            <small>HP: ${c.currentHp}/${c.maxHp} (${hpPct}%)</small>
          </div>
        </button>
      `);

      if(isActive){
        item.addClass('active').append('<span class="badge bg-dark ms-2">Ativo</span>');
      }
      if(fainted){
        item.addClass('disabled').append('<span class="badge bg-danger ms-2">Desmaiado</span>');
      }

      item.on('click', ()=>{
        if(isActive || fainted) return; // não troca
        changePokemon(idx); // troca consome turno (oponente pode bater)
        const modalEl = document.getElementById('partyModal');
        const mdl = bootstrap.Modal.getInstance(modalEl);
        mdl?.hide();
      });

      $list.append(item);
    });
  }

  // Troca o pokémon ativo, preservando o HP do que sai
  function changePokemon(newIndex){
    activeIndex = newIndex;
    player = party[activeIndex];

    // Atualiza HUD/sprite
    renderHUDs();
    $('#player-sprite')
      .removeClass('show')
      .one('transitionend', ()=>{
        $('#player-sprite').attr('src', player.base.image || '').addClass('show');
      });

    // Mensagem e consumo do turno
    $('#battle-text').text(`Vai, ${player.base.name}!`);
    toggleMenus(); // esconde menus durante a ação

    // Oponente ataca após a troca (se estiver vivo)
    setTimeout(()=>{
      if(isFainted(opponent)){
        handleOpponentFainted();
        return;
      }
      const oMv = pickRandomMove(opponent.moveset);
      performAttack(opponent, player, oMv, '#player-hp', ()=>{
        if(isFainted(player)){
          handlePlayerFainted();
          return;
        }
        backToActionsSoon();
      });
    }, MSG_DELAY_MS);
  }

  /* ============== Turnos / Combate ============== */

  function playerUseMove(index){
    const move = player.moveset[index];
    if(!move) return;

    performAttack(player, opponent, move, '#opponent-hp', ()=>{
      if(isFainted(opponent)){
        handleOpponentFainted();
        return;
      }
      const oMv = pickRandomMove(opponent.moveset);
      performAttack(opponent, player, oMv, '#player-hp', ()=>{
        if(isFainted(player)){
          handlePlayerFainted();
          return;
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
    setTimeout(()=>{ toggleMenus('actions'); }, 200);
  }

  /* ============== Pós-batalha / EXP ============== */

  function handleOpponentFainted(){
    const expGain = getOpponentExp(opponent.base);
    const result = awardExperienceToActive(expGain);
    renderHUDs();

    if(result.leveledUp > 0){
      $('#battle-text').text(
        `${opponent.base.name} desmaiou! +${expGain} EXP. Level up x${result.leveledUp} → Lv ${result.newLevel} (EXP atual: ${result.currentExp}).`
      );
    }else{
      $('#battle-text').text(
        `${opponent.base.name} desmaiou! +${expGain} EXP. EXP atual: ${result.currentExp}/${player.level*100}.`
      );
    }
    toggleMenus('post');
  }

  function getOpponentExp(poke){
    const n = Number(poke && poke.exp);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function awardExperienceToActive(expGain){
    const closed = safeParse(localStorage.getItem('closed_challenge_account')) || {};
    const key = player.slotKey || 'pokemon-1';
    const slot = closed[key] || {};

    slot.currentLevel = Number(slot.currentLevel) || player.level || 1;
    slot.currentExp   = Number(slot.currentExp)   || 0;

    slot.currentExp += Number(expGain) || 0;

    let leveledUp = 0;
    while(slot.currentExp >= (slot.currentLevel * 100)){
      slot.currentExp -= (slot.currentLevel * 100);
      slot.currentLevel += 1;
      leveledUp += 1;
    }

    player.level = slot.currentLevel;

    closed[key] = { ...closed[key], currentLevel: slot.currentLevel, currentExp: slot.currentExp };
    localStorage.setItem('closed_challenge_account', JSON.stringify(closed));

    return { newLevel: slot.currentLevel, currentExp: slot.currentExp, leveledUp };
  }

  /* ============== Captura ============== */

  function attemptCapture(ballType = 'pokeball'){
    const multipliers = { pokeball: 1, greatball: 2, superball: 3, ultraball: 4 };
    const mult = multipliers[ballType] || 1;

    if(ballType === 'pokeball' && bagInfo.pokeball <= 0){
      $('#battle-text').text('Você não tem Poké Balls!');
      return;
    }
    if(ballType === 'pokeball'){
      bagInfo.pokeball = Math.max(0, (bagInfo.pokeball || 0) - 1);
      localStorage.setItem('bag_info', JSON.stringify(bagInfo));
      updateBagMenuCounts();
    }

    const baseCatch = Number(opponent.base.catchRate) || 20;
    const chance = Math.min(100, baseCatch * mult);
    const roll = Math.random() * 100;
    const success = roll < chance;

    if(success){
      $('#battle-text').text(`Incrível! ${opponent.base.name} foi capturado!`);
      addCapturedPokemon(opponent.base, opponent.level);
      setTimeout(()=> goToRoute(), 900);
    }else{
      $('#battle-text').text(`Que pena! ${opponent.base.name} fugiu!`);
      setTimeout(()=> goToRoute(), 900);
    }
  }

  function addCapturedPokemon(pokeBase, level){
    const closed = safeParse(localStorage.getItem('closed_challenge_account')) || {};
    let maxN = 0;
    Object.keys(closed).forEach(k=>{
      const m = /^pokemon-(\d+)$/.exec(k);
      if(m) maxN = Math.max(maxN, Number(m[1]));
    });
    const nextKey = `pokemon-${maxN + 1}`;

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
    incrementWildDefeats();

    window.location.href = '../map/route/route-view.html';
  }

  /* ============== Funções pedidas (itens / dano / faint) ============== */

  function usePotion(){
    if(player.currentHp >= player.maxHp){
      $('#battle-text').text('vida já está cheia');
      toggleMenus('actions');
      return;
    }
    if(bagInfo.potion <= 0){
      $('#battle-text').text('Você não tem Potions!');
      return;
    }

    const before = player.currentHp;
    player.currentHp = Math.min(player.maxHp, player.currentHp + 20);
    const healed = player.currentHp - before;

    bagInfo.potion -= 1;
    localStorage.setItem('bag_info', JSON.stringify(bagInfo));
    updateBagMenuCounts();

    setHp($('#player-hp'), toPct(player.currentHp, player.maxHp));
    $('#battle-text').text(`${player.base.name} usou uma Potion! +${healed} HP.`);

    toggleMenus(); // esconde todos durante a ação

    setTimeout(()=>{
      if(isFainted(opponent)){
        handleOpponentFainted();
        return;
      }
      const oMv = pickRandomMove(opponent.moveset);
      performAttack(opponent, player, oMv, '#player-hp', ()=>{
        if(isFainted(player)){
          handlePlayerFainted();
          return;
        }
        backToActionsSoon();
      });
    }, MSG_DELAY_MS);
  }

  // Se o player desmaiar, tenta trocar; se ninguém disponível, vai para rota
  function handlePlayerFainted(){
    $('#battle-text').text(`${player.base.name} desmaiou!`);
    const nextIdx = findFirstAliveIndex();
    if(nextIdx === -1){
      // todos desmaiados
      setTimeout(()=> goToRoute(), 900);
      return;
    }
    // abre modal para escolher (focando na UX de seleção)
    setTimeout(()=> openPartyModal(), 600);
  }

  function findFirstAliveIndex(){
    for(let i=0;i<party.length;i++){
      if(party[i].currentHp > 0) return i;
    }
    return -1;
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
