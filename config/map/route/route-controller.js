(function($){

  /* ========= PARÂMETROS DO MAPA ========= */
  const COLS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cols'));
  const ROWS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--rows'));
  const TILE = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile'));
  const SPEED = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--speed-ms'));

  // ==== NOVO: Rota atual (ajuste conforme seu jogo) ====
  const CURRENT_ROUTE_ID = 1;

  // Configurações de geração visual
  const TREE_COUNT = Math.max(4, Math.floor((COLS*ROWS) / 90)); // árvores (4x4)
  const PATHS = 2;              // quantas trilhas gerar
  const PATH_STEPS = COLS * 1.5;

  // grade de colisão: false = livre (mato/caminho), true = bloqueado (árvore)
  const solid = Array.from({length: ROWS}, ()=> Array(COLS).fill(false));
  // mapa para marcar caminho (true = path, false = grass)
  const pathMap = Array.from({length: ROWS}, ()=> Array(COLS).fill(false));

  const $ground = $('#ground');
  const $trees = $('#trees');
  const $player = $('#player');

  // ==== NOVO: dados carregados ====
  let routesData = [];
  let pokemonData = [];

  /* ========= FUNÇÕES DE GERAÇÃO ========= */

  function genPaths(){
    for(let p=0; p<PATHS; p++){
      let side = Math.floor(Math.random()*4);
      let r = (side === 0) ? 0 : (side === 1) ? ROWS-1 : Math.floor(Math.random()*ROWS);
      let c = (side === 2) ? 0 : (side === 3) ? COLS-1 : Math.floor(Math.random()*COLS);

      for(let s=0; s<PATH_STEPS; s++){
        pathMap[r][c] = true;

        let dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        let [dr, dc] = dirs[Math.floor(Math.random()*dirs.length)];

        if(Math.random()<0.2){
          let [dr2, dc2] = dirs[Math.floor(Math.random()*dirs.length)];
          let rr = clamp(r+dr2, 0, ROWS-1);
          let cc = clamp(c+dc2, 0, COLS-1);
          pathMap[rr][cc] = true;
        }
        r = clamp(r+dr, 0, ROWS-1);
        c = clamp(c+dc, 0, COLS-1);
      }
    }
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function genGround(){
    let frag = document.createDocumentFragment();
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const tile = document.createElement('div');
        tile.className = 'tile ' + (pathMap[r][c] ? 'path' : 'grass');
        frag.appendChild(tile);
      }
    }
    $ground.append(frag);
  }

  function canPlaceTree(row, col){
    if(row+3 >= ROWS || col+3 >= COLS) return false;
    for(let r=row; r<row+4; r++){
      for(let c=col; c<col+4; c++){
        if(solid[r][c]) return false;
        if(pathMap[r][c]) return false; // não colocar árvore sobre caminho
      }
    }
    return true;
  }

  function placeTree(row, col){
    for(let r=row; r<row+4; r++){
      for(let c=col; c<col+4; c++){
        solid[r][c] = true;
      }
    }
    const t = document.createElement('div');
    t.className = 'tree';
    t.style.left = (col * TILE) + 'px';
    t.style.top  = (row * TILE) + 'px';
    $trees.append(t);
  }

  function genTrees(){
    let tries = 0, placed = 0, maxTries = 1000;
    while(placed < TREE_COUNT && tries < maxTries){
      const r = Math.floor(Math.random() * (ROWS-3));
      const c = Math.floor(Math.random() * (COLS-3));
      if(canPlaceTree(r,c)){
        placeTree(r,c);
        placed++;
      }
      tries++;
    }
  }

  /* ========= JOGADOR ========= */
  let player = { row: Math.floor(ROWS/2), col: Math.floor(COLS/2), moving: false };

  function setPlayerPos(){
    $player.css('transform', `translate3d(${player.col*TILE}px, ${player.row*TILE}px, 0)`);
  }

  function canWalk(newRow, newCol){
    if(newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) return false; // borda
    if(solid[newRow][newCol]) return false; // árvore
    return true; // mato e caminho são livres
  }

  // ==== NOVO: utilitários de encontro ====
  function isGrass(row, col){
    // grass = não é árvore e não é path
    if(row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if(solid[row][col]) return false;       // área sólida (árvore)
    return !pathMap[row][col];              // se não é caminho, é grama
  }

  function getRouteById(id){
    return routesData.find(r => r.id === id);
  }

  function getPokemonById(id){
    return pokemonData.find(p => p.id === id);
  }

  // 10% de chance; escolhe um pokémon da rota e loga no console
  function maybeEncounter(row, col){
    if(!isGrass(row, col)) return;                // só no mato
    if(!routesData.length || !pokemonData.length) return; // ainda não carregado
    if(Math.random() >= 0.10) return;             // 10% de chance

    const route = getRouteById(CURRENT_ROUTE_ID);
    if(!route || !Array.isArray(route.pokeEnemies) || route.pokeEnemies.length === 0) return;

    // filtra inimigos que existem no pokemon.json
    const validIds = route.pokeEnemies.filter(id => !!getPokemonById(id));
    if(validIds.length === 0) return;

    const chosenId = validIds[Math.floor(Math.random() * validIds.length)];
    const poke = getPokemonById(chosenId);

    // Resultado: loga no console
    console.log('[ENCONTRO] Pokémon encontrado:', poke);
    localStorage.setItem('battleData', JSON.stringify({ "pokeId": chosenId }));

    playTransition(1500);

    setTimeout(() => {
      window.location.href = '../../battle/battle-mobile.html';
    }, 1550);
  }

  function step(dx, dy){
    if(player.moving) return;
    const targetRow = player.row + dy;
    const targetCol = player.col + dx;
    if(!canWalk(targetRow, targetCol)) return;

    player.row = targetRow;
    player.col = targetCol;
    player.moving = true;
    setPlayerPos();

    // ==== NOVO: checar encontro após mover ====
    maybeEncounter(player.row, player.col);

    setTimeout(()=>{ player.moving = false; }, SPEED);
  }

  /* ========= INPUT ========= */
  const keyMap = {
    'ArrowUp':'up','KeyW':'up',
    'ArrowDown':'down','KeyS':'down',
    'ArrowLeft':'left','KeyA':'left',
    'ArrowRight':'right','KeyD':'right'
  };

  $(document).on('keydown', (e)=>{
    const dir = keyMap[e.code];
    if(!dir) return;
    e.preventDefault();
    moveDir(dir);
  });

  function moveDir(dir){
    switch(dir){
      case 'up': step(0,-1); break;
      case 'down': step(0, 1); break;
      case 'left': step(-1,0); break;
      case 'right': step(1,0); break;
    }
  }

  // D-pad: toque/clique contínuo
  let holdTimer = null, holdInterval = null;

  function startHold(dir){
    moveDir(dir);
    holdTimer = setTimeout(()=>{
      holdInterval = setInterval(()=> moveDir(dir), SPEED);
    }, 200);
  }
  function endHold(){
    clearTimeout(holdTimer); holdTimer=null;
    clearInterval(holdInterval); holdInterval=null;
  }

  $('.dir')
    .on('mousedown touchstart', function(e){
      e.preventDefault();
      startHold($(this).data('dir'));
    })
    .on('mouseup mouseleave touchend touchcancel', function(e){
      e.preventDefault();
      endHold();
    });

    function playTransition(durationMs = 1000) {
      const $t = $('#transition');

      if ($t.length === 0) return;

      // mostra
      $('body').addClass('transition-lock');
      $t.removeClass('d-none transition-fade-out')
        .addClass('transition-fade-in');

      // espera o "in", mantém por um tempo e esmaece
      const hold = Math.max(0, durationMs - 340); // compensa animações

      // Depois do hold, faz fade-out e esconde
      setTimeout(() => {
        $t.removeClass('transition-fade-in').addClass('transition-fade-out');

        // quando terminar o fade-out, esconde a div
        setTimeout(() => {
          $t.addClass('d-none').removeClass('transition-fade-out');
          $('body').removeClass('transition-lock');
        }, 240);
      }, hold);
    }

  /* ========= CARREGAR DADOS (NOVO) ========= */
  function loadData(){
    const p1 = $.getJSON('../../../json-db/routes.json').then(data => { routesData = data || []; });
    const p2 = $.getJSON('../../../json-db/pokemon.json').then(data => { pokemonData = data || []; });
    return Promise.all([p1, p2]);
  }

  /* ========= INICIALIZAÇÃO ========= */
  function init(){
    genPaths();
    genGround();
    genTrees();

    // garantir spawn em tile livre
    if(solid[player.row][player.col]){
      outer: for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          if(!solid[r][c]){ player.row=r; player.col=c; break outer; }
        }
      }
    }
    setPlayerPos();

    // carrega JSONs (encontros só acontecem após carregar)
    loadData().catch(err => {
      console.error('Erro ao carregar JSONs:', err);
    });
  }

  init();

})(jQuery);
