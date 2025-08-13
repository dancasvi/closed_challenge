$(document).ready(function () {
  $('.menu-btn').on('click', function () {
    const page = $(this).data('page');
    const modal = $(this).data('modal');

    if (page) {
      // Redireciona para pages/<page>/<page>.html
      debugger;
      if(page == "begin-journey") {
        if(checkIfHaveAccount()) {
          window.location.href = `pages/${page}/${page}.html`;
        } else {
          window.location.href = `pages/choose-starter/choose-starter.html`;
        }
      } else {
        window.location.href = `pages/${page}/${page}.html`;
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
    var el = document.getElementById('defeats-count');
    if (!el) return; // HUD não existe nesta página
    var n = parseInt(localStorage.getItem('wildDefeats') || '0', 10);
    if (isNaN(n) || n < 0) n = 0;
    el.textContent = n;
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

})(window);



