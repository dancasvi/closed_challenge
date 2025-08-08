$(document).ready(function () {
  // Recupera do localStorage
  const battleData = JSON.parse(localStorage.getItem('battleData') || '{}');
  if (!battleData.pokeId) {
    alert('Nenhum Pokémon para batalha!');
    return;
  }

  // Busca o JSON de Pokémon
  $.getJSON('../json-db/pokemon.json', function (data) {
    const pokemon = data.find(p => p.id === battleData.pokeId);
    if (!pokemon) {
      alert('Pokémon não encontrado!');
      return;
    }

    // Atualiza HUD
    $('#pokemon-name').text(pokemon.name);

    // Atualiza sprite
    $('#pokemon-sprite').attr('src', pokemon.image);

  }).fail(function () {
    console.error('Erro ao carregar pokemon.json');
  });
});
