$(document).ready(function () {
  $('.menu-btn').on('click', function () {
    const page = $(this).data('page');
    const modal = $(this).data('modal');

    if (page) {
      // Redireciona para pages/<page>/<page>.html
      if(page == "begin-journey") {
        
      } else {
        
      }

      switch (page) {
        case 'begin-journey':
          if(checkIfHaveAccount()) {
            window.location.href = `pages/${page}/${page}.html`;
          } else {
            window.location.href = `pages/choose-starter/choose-starter.html`;
          }
        break;
        case 'ranked-battle':
          window.location.href = `config/ranked-battle/ranked-battle.html`;
        break;
        default:
          window.location.href = `pages/${page}/${page}.html`;
        break
      }

    } else if (modal) {
      openModal(modal);
    }
  });
});

function openModal(type) {
  let title = '';
  let content = '';

  if (type === 'tutorial') {
    title = 'Tutorial';
    content = 'Aqui vai o conteúdo do tutorial.';
  } else if (type === 'credits') {
    title = 'Credits';
    content = 'Desenvolvido por você.';
  }

  $('#infoModalLabel').text(title);
  $('#infoModalBody').html(`<p>${content}</p>`);
  const modal = new bootstrap.Modal(document.getElementById('infoModal'));
  modal.show();
}

function checkIfHaveAccount() {
  const haveAccount = localStorage.getItem('closed_challenge_account');

  if (haveAccount !== null) {
    // Item existe
    console.log('Item "closed_challenge_account" encontrado:', haveAccount);
    return true;
  } else {
    // Item não existe
    console.log('Item "closed_challenge_account" não encontrado.');
    return false;
  }
}

(function (global) {

  // Salva o número atual de defeats no localStorage
  global.saveWildDefeats = function(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 0) n = 0;
    localStorage.setItem('wildDefeats', n);
  };

  // Lê o número do localStorage e atualiza a HUD
  global.updateWildDefeatsHUD = function() {
    var countEl = document.getElementById('defeats-count');
    if (!countEl) return; // HUD não existe nesta página

    var n = global.getWildDefeats();
    countEl.textContent = n;

    // Procura um contêiner bom para anexar o botão
    var hud = document.getElementById('battle-hud');
    var parent = countEl.closest('.hud-card') || hud || countEl.parentElement;
    if (!parent) return;

    var btn = document.getElementById('ranked-btn');

    if (n >= 10) {
      // Cria o botão se ainda não existir
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'ranked-btn';
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm ms-3'; // usa Bootstrap se disponível
        btn.textContent = 'Ranked Battle';
        btn.setAttribute('aria-label', 'Ranked Battle');
        btn.addEventListener('click', function () {
          // Chama a função global
          if (typeof global.goToRankedBattle === 'function') {
            global.goToRankedBattle();
          }
        });
        parent.appendChild(btn);
      } else {
        // Garante que esteja visível caso já exista
        btn.style.display = '';
      }
    } else {
      // Se não atingiu 10, esconde/remove o botão
      if (btn) {
        // pode remover ou apenas esconder — aqui vamos remover para evitar duplicatas
        btn.remove();
      }
    }
  };

  // Incrementa o número de defeats em +1 e atualiza HUD
  global.incrementWildDefeats = function() {
    var n = parseInt(localStorage.getItem('wildDefeats') || '0', 10);
    if (isNaN(n) || n < 0) n = 0;
    n++;
    localStorage.setItem('wildDefeats', n);
    global.updateWildDefeatsHUD();
  };

  // Retorna o valor atual de wildDefeats
  global.getWildDefeats = function() {
    var n = parseInt(localStorage.getItem('wildDefeats') || '0', 10);
    if (isNaN(n) || n < 0) n = 0;
    return n;
  };

  global.goToRankedBattle = function() {
    console.log('Ir para Ranked Battle');
  };


})(window);



