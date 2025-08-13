$(document).ready(function () {
    $.getJSON("../../json-db/starters.json", function (data) {
        let container = $("#starters-container");

        data.forEach(pokemon => {
            if(pokemon.active) {
                let card = `
                    <div class="col-12 col-sm-6 col-md-4">
                        <div class="card text-center p-3 h-100" data-id="${pokemon.id}">
                            <img src="${pokemon.image}" class="card-img-top mx-auto" alt="${pokemon.name}">
                            <div class="card-body d-flex flex-column justify-content-between">
                                <h5 class="card-title">${pokemon.name}</h5>
                                <button class="btn btn-primary btn-sm mt-2 view-details" data-id="${pokemon.id}">
                                    Details
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.append(card);
            }
        });

        // Evento para abrir modal com detalhes
        $(document).on("click", ".view-details", function () {
            let id = $(this).data("id");
            let pokemon = data.find(p => p.id === id);

            $("#starterName").text(pokemon.name);
            $("#starterImage").attr("src", pokemon.image);
            $("#starterDescription").text(pokemon.description);
            $("#starterType").text(pokemon.type);
            $("#starterLevel").text(pokemon.level);
            $("#starterEvolveLevel").text(pokemon.evolveLevel);
            $("#starterRegion").text(pokemon.region);

            $("#chooseBtn").data("id", pokemon.id);

            new bootstrap.Modal(document.getElementById('starterModal')).show();
        });

        // Evento de escolher
        // Evento de escolher
        let chosenPokemon = null;

        $("#chooseBtn").on("click", function () {
            const chosenId = $(this).data("id");
            chosenPokemon = data.find(p => p.id === chosenId);

            if (!chosenPokemon) return;

            // Fecha o modal de detalhes
            const starterModal = bootstrap.Modal.getInstance(document.getElementById('starterModal'));
            if (starterModal) starterModal.hide();

            // Abre o modal de item após selecionar o Pokémon
            openItemSelectionModal();
        });

        function openItemSelectionModal() {
            $.getJSON("../../json-db/starter-items.json", function(items) {
                const form = $("#itemSelectionForm");
                form.empty();

                items.forEach(item => {
                    const radio = `
                        <div class="form-check d-flex align-items-center">
                            <input class="form-check-input me-2" type="radio" name="starterItem" id="item-${item.id}" value="${item.id}">
                            <label class="form-check-label d-flex align-items-center" for="item-${item.id}">
                                <img src="${item['url-img']}" alt="${item.name}" class="me-2" style="width: 40px; height: 40px;">
                                <span>${item.name}</span>
                            </label>
                        </div>
                    `;
                    form.append(radio);
                });

                new bootstrap.Modal(document.getElementById('itemModal')).show();
            });
        }

        $("#confirmItemBtn").on("click", function () {
            const selectedItemId = $("input[name='starterItem']:checked").val();

            if (!selectedItemId) {
                alert("Por favor, selecione um item.");
                return;
            }

            // Montar o objeto final
            const accountData = {
                "pokemon-1": {
                    idpoke: chosenPokemon.id,
                    currentLevel: chosenPokemon.level,
                    moves: chosenPokemon.startingMoves,
                    currentExp: 0
                },
                iditem: parseInt(selectedItemId)
            };

            localStorage.setItem('closed_challenge_account', JSON.stringify(accountData));
            localStorage.setItem('current_rank', 1);

            const currentCash = {
                "pokecoins": 1000,
                "closed-tickets": 100
            };
            localStorage.setItem('current_cash', JSON.stringify(currentCash));

            // Fecha modal de item
            const itemModal = bootstrap.Modal.getInstance(document.getElementById('itemModal'));
            if (itemModal) itemModal.hide();

            // Mostra modal final de sucesso
            $("#successMessage").text(`Congratulations! You received ${chosenPokemon.name} (Lv ${chosenPokemon.level})`);
            const successModal = new bootstrap.Modal(document.getElementById('successModal'));
            successModal.show();
        });


        // Botão "Ir para Início"
        $("#goHomeBtn").on("click", function () {
            window.location.href = "../../index.html"; // ajuste o caminho se necessário
        });


    });
});
