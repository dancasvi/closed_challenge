$(function(){
  // ----- Storage -----
  const closedData = safeParse(localStorage.getItem('closed_challenge_account')) || {};
  const battleData = safeParse(localStorage.getItem('battleData')) || {};

  // ----- Regras -----
  const MAX_HP = 500;
  const BASE_ATK = 100;
  const BASE_DEF = 100;
  const MSG_DELAY_MS = 1500; // tempo para mensagens de dano antes do próximo passo

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
    // Player
    $('#player-name').text(player.base.name || 'Você');
    $('#player-level').text('Lv ' + (player.level ?? '—'));
    setHp($('#player-hp'), toPct(player.currentHp, player.maxHp));

    // Opponent
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
    // Abrir submenu de moves
    $('[data-action="attack"]').off('click').on('click', openMovesMenu);

    // Placeholder
    $('[data-action="bag"]').off('click').on('click', ()=> $('#battle-text').text('Abra a mochila (itens ainda não fazem nada).'));
    $('[data-action="pokemon"]').off('click').on('click', ()=> $('#battle-text').text('Trocar de Pokémon (placeholder).'));

    // Fugir -> rota
    $('[data-action="run"]').off('click').on('click', ()=>{
      // redireciona para config/map/route/route-view.html
      localStorage.removeItem('battleData');
      window.location.href = '../map/route/route-view.html';
    });

    // Voltar do submenu
    $('#btn-back').off('click').on('click', ()=> {
      $('#moves-menu').addClass('d-none');
      $('#action-menu').removeClass('d-none');
      $('#battle-text').text('Escolha sua ação.');
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

    $('#action-menu').addClass('d-none');
    $('#moves-menu').removeClass('d-none');
    $('#battle-text').text('Escolha um movimento.');
  }

  /* ============== Turnos / Combate ============== */

  function playerUseMove(index){
    const move = player.moveset[index];
    if(!move) return;

    // Player ataca primeiro
    performAttack(player, opponent, move, '#opponent-hp', ()=>{
      if(isFainted(opponent)){
        $('#battle-text').text(`${opponent.base.name} desmaiou!`);
        backToActionsSoon();
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

    // espera para a mensagem de dano
    setTimeout(()=> done && done(), MSG_DELAY_MS);
  }

  function pickRandomMove(moveset){
    if(!moveset || moveset.length === 0) return { name:'ataque', power:0 };
    const i = Math.floor(Math.random() * moveset.length);
    return moveset[i];
  }

  function backToActionsSoon(){
    setTimeout(()=>{
      $('#moves-menu').addClass('d-none');
      $('#action-menu').removeClass('d-none');
    }, 200);
  }

  /* ============== Funções pedidas ============== */

  // checkItem: loga itens dos dois pokes em campo a cada ataque
  function checkItem(attacker, defender){
    console.log(`poke ${attacker.base.name} tem item ${attacker.item ? attacker.item.name : 'Nenhum'}; ` +
                `poke ${defender.base.name} tem item ${defender.item ? defender.item.name : 'Nenhum'}`);
  }

  // calcDamage: (atk do atacante + move.power) - def do defensor
  function calcDamage(attacker, defender, move){
    const atk = Number(attacker.atk) || 0;
    const def = Number(defender.def) || 0;
    const power = Number(move?.power) || 0;
    return (atk + power) - def;
  }

  /* ============== Utils ============== */

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
