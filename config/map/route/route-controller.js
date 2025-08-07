(function($){

  /* ========= PARÂMETROS DO MAPA ========= */
  const COLS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cols'));
  const ROWS = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--rows'));
  const TILE = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile'));
  const SPEED = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--speed-ms'));

  // Configurações de geração
  const TREE_COUNT = Math.max(4, Math.floor((COLS*ROWS) / 90)); // árvores (4x4)
  const PATHS = 2;             // quantas trilhas (random walks) gerar
  const PATH_STEPS = COLS * 1.5; // passos por trilha

  // grade de colisão: false = livre (mato/caminho), true = bloqueado (árvore)
  const solid = Array.from({length: ROWS}, ()=> Array(COLS).fill(false));
  // mapa para marcar caminho
  const pathMap = Array.from({length: ROWS}, ()=> Array(COLS).fill(false));

  const $ground = $('#ground');
  const $trees = $('#trees');
  const $player = $('#player');

  /* ========= FUNÇÕES DE GERAÇÃO ========= */

  // Gera trilhas (caminho marrom) por random walk
  function genPaths(){
    for(let p=0; p<PATHS; p++){
      // começa em uma borda aleatória
      let side = Math.floor(Math.random()*4);
      let r = (side === 0) ? 0 : (side === 1) ? ROWS-1 : Math.floor(Math.random()*ROWS);
      let c = (side === 2) ? 0 : (side === 3) ? COLS-1 : Math.floor(Math.random()*COLS);

      for(let s=0; s<PATH_STEPS; s++){
        pathMap[r][c] = true;

        // direção tendenciosa para "avançar" no mapa
        let dirs = [
          [1,0],[-1,0],[0,1],[0,-1]
        ];
        let [dr, dc] = dirs[Math.floor(Math.random()*dirs.length)];
        // pequena chance de "alargar" o caminho
        if(Math.random()<0.2){
          let dirs2 = dirs[Math.floor(Math.random()*dirs.length)];
          let rr = clamp(r+dirs2[0], 0, ROWS-1);
          let cc = clamp(c+dirs2[1], 0, COLS-1);
          pathMap[rr][cc] = true;
        }
        r = clamp(r+dr, 0, ROWS-1);
        c = clamp(c+dc, 0, COLS-1);
      }
    }
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // Piso (grass ou path)
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

  // Árvores (4x4, sólidas)
  function canPlaceTree(row, col){
    if(row+3 >= ROWS || col+3 >= COLS) return false;
    // Evita colocar árvore sobre caminho (fica mais bonito)
    for(let r=row; r<row+4; r++){
      for(let c=col; c<col+4; c++){
        if(solid[r][c]) return false;
        if(pathMap[r][c]) return false;
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
  let player = {
    row: Math.floor(ROWS/2),
    col: Math.floor(COLS/2),
    moving: false
  };

  function setPlayerPos(){
    $player.css('transform', `translate3d(${player.col*TILE}px, ${player.row*TILE}px, 0)`);
  }

  function canWalk(newRow, newCol){
    if(newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) return false; // borda
    if(solid[newRow][newCol]) return false; // árvore
    return true; // mato e caminho são livres
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

  /* ========= INICIALIZAÇÃO ========= */
  function init(){
    genPaths();   // gera caminho marrom (sem colisão)
    genGround();  // pinta grass ou path
    genTrees();   // adiciona árvores (com colisão)

    // garantir que o spawn não caia dentro de árvore
    if(solid[player.row][player.col]){
      outer: for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          if(!solid[r][c]){ player.row=r; player.col=c; break outer; }
        }
      }
    }
    setPlayerPos();
  }

  init();

})(jQuery);
