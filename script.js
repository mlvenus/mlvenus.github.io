document.addEventListener('DOMContentLoaded', () => {
    // Referências DOM
    const pokemonListUl = document.getElementById('pokemon-list');
    const listLoaderDiv = document.getElementById('list-loader');
    const searchInput = document.getElementById('search-input');

    const pokemonInfoDiv = document.getElementById('pokemon-info');
    const pokemonNameH2 = document.getElementById('pokemon-name');
    const pokemonImageImg = document.getElementById('pokemon-image');
    const pokemonIdDiv = document.getElementById('pokemon-id');
    const pokemonTypesDiv = document.getElementById('pokemon-types');
    const pokemonStatsGrid = document.querySelector('#pokemon-stats .stats-grid'); // Seleciona a grid

    const displayPromptDiv = document.getElementById('display-prompt');
    const displayLoaderDiv = document.getElementById('display-loader');
    const displayErrorDiv = document.getElementById('display-error');

    // Constantes e Variáveis
    const API_URL = 'https://pokeapi.co/api/v2/pokemon/';
    const POKEMON_LIMIT = 1500; // Um limite alto para pegar (quase) todos os Pokémon atuais + futuras adições
    let allPokemonData = []; // Armazenará {name, url} de todos os Pokémon
    let pokemonDetailsCache = {}; // Cache para detalhes {url: data}

    // --- Funções ---

    // Mostra/Esconde elementos do Display
    const showDisplayState = (state) => { // state: 'prompt', 'loading', 'info', 'error'
        displayPromptDiv.classList.add('hidden');
        displayLoaderDiv.classList.add('hidden');
        pokemonInfoDiv.classList.add('hidden');
        displayErrorDiv.classList.add('hidden');

        switch (state) {
            case 'prompt':
                displayPromptDiv.classList.remove('hidden');
                break;
            case 'loading':
                displayLoaderDiv.classList.remove('hidden');
                break;
            case 'info':
                pokemonInfoDiv.classList.remove('hidden');
                break;
            case 'error':
                displayErrorDiv.classList.remove('hidden');
                break;
        }
    };

    // Busca a lista inicial de nomes/URLs
    const fetchPokemonList = async () => {
        listLoaderDiv.classList.remove('hidden'); // Mostra loader da lista
        pokemonListUl.innerHTML = ''; // Limpa lista (caso haja retry)

        try {
            const response = await fetch(`${API_URL}?limit=${POKEMON_LIMIT}&offset=0`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            allPokemonData = data.results; // Armazena os dados crus
            displayPokemonList(allPokemonData); // Exibe a lista inicial completa

        } catch (error) {
            console.error("Erro ao buscar lista de Pokémon:", error);
            pokemonListUl.innerHTML = '<li class="error-message">Erro ao carregar a lista. Tente recarregar a página.</li>'; // Mensagem de erro na lista
        } finally {
            listLoaderDiv.classList.add('hidden'); // Esconde loader da lista
        }
    };

    // Exibe a lista (ou filtra a existente)
    const displayPokemonList = (pokemonArray) => {
        pokemonListUl.innerHTML = ''; // Limpa a lista atual para re-renderizar filtrada ou completa
        if (pokemonArray.length === 0 && searchInput.value !== '') {
             pokemonListUl.innerHTML = '<li class="info-message">Nenhum Pokémon encontrado.</li>';
        } else {
            pokemonArray.forEach(pokemon => {
                const listItem = document.createElement('li');
                listItem.textContent = pokemon.name;
                listItem.dataset.url = pokemon.url;
                listItem.addEventListener('click', handlePokemonSelection);
                pokemonListUl.appendChild(listItem);
            });
        }
    };

    // Manipula o clique na lista
    const handlePokemonSelection = (event) => {
        const listItem = event.currentTarget;
        const url = listItem.dataset.url;

        // Remove classe 'active' de todos e adiciona ao clicado
        document.querySelectorAll('#pokemon-list li').forEach(li => li.classList.remove('active'));
        listItem.classList.add('active');

        fetchPokemonDetails(url);
    };

    // Busca detalhes do Pokémon (com cache)
    const fetchPokemonDetails = async (url) => {
        showDisplayState('loading'); // Mostra loader no display

        // Verifica cache
        if (pokemonDetailsCache[url]) {
            displayPokemonDetails(pokemonDetailsCache[url]);
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const pokemonData = await response.json();
            pokemonDetailsCache[url] = pokemonData; // Adiciona ao cache
            displayPokemonDetails(pokemonData);

        } catch (error) {
            console.error(`Erro ao buscar detalhes do Pokémon (${url}):`, error);
            showDisplayState('error'); // Mostra mensagem de erro no display
        }
    };

    // Exibe os detalhes do Pokémon
    const displayPokemonDetails = (data) => {
        // Nome e ID
        pokemonNameH2.textContent = data.name;
        pokemonIdDiv.textContent = `#${String(data.id).padStart(3, '0')}`; // Formata ID (ex: #001)

        // Imagem (Sprite Animado com Fallback)
        const animatedSprite = data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        pokemonImageImg.src = animatedSprite || data.sprites.front_default || 'placeholder.png'; // Adicione uma imagem placeholder se desejar
        pokemonImageImg.alt = `Imagem de ${data.name}`;

        // Tipos
        pokemonTypesDiv.innerHTML = ''; // Limpa tipos anteriores
        data.types.forEach(typeInfo => {
            const typeBadge = document.createElement('span');
            typeBadge.textContent = typeInfo.type.name;
            typeBadge.className = `type-badge type-${typeInfo.type.name}`; // Classe para cor
            pokemonTypesDiv.appendChild(typeBadge);
        });

        // Stats com Barras
        pokemonStatsGrid.innerHTML = ''; // Limpa stats anteriores
        const maxStatValue = 255; // Valor máximo teórico para % da barra

        data.stats.forEach(statInfo => {
            const statValue = statInfo.base_stat;
            const statName = statInfo.stat.name.replace('-', ' '); // Remove hífens (ex: special-attack)

            // Cria elementos da grid
            const nameElement = document.createElement('div');
            nameElement.className = 'stat-name';
            nameElement.textContent = statName;

            const barContainer = document.createElement('div');
            barContainer.className = 'stat-bar-container';

            const barElement = document.createElement('div');
            barElement.className = 'stat-bar';
            const percentage = (statValue / maxStatValue) * 100;
            barElement.style.width = `${percentage}%`; // Define largura da barra dinamicamente

            // Adiciona classe para cor baseada no valor (opcional)
             if (statValue < 60) barElement.dataset.value = "low";
             else if (statValue < 100) barElement.dataset.value = "medium";
             else barElement.dataset.value = "high";

            barContainer.appendChild(barElement);

            const valueElement = document.createElement('div');
            valueElement.className = 'stat-value';
            valueElement.textContent = statValue;

            // Adiciona à grid
            pokemonStatsGrid.appendChild(nameElement);
            pokemonStatsGrid.appendChild(barContainer);
            pokemonStatsGrid.appendChild(valueElement);
        });


        showDisplayState('info'); // Mostra a área de informações preenchida
    };

    // Filtra a lista baseado no input de pesquisa
    const filterPokemon = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredPokemon = allPokemonData.filter(pokemon =>
            pokemon.name.toLowerCase().includes(searchTerm)
        );
        displayPokemonList(filteredPokemon);

         // Se o Pokémon selecionado atualmente não estiver mais visível, limpa o display
        const activeLi = pokemonListUl.querySelector('li.active');
        if (activeLi && activeLi.style.display === 'none') {
           activeLi.classList.remove('active');
           showDisplayState('prompt'); // Volta ao prompt inicial
           // Limpa também os dados no display para evitar mostrar info errada se re-selecionar
           pokemonNameH2.textContent = '';
           pokemonImageImg.src = '';
           pokemonIdDiv.textContent = '';
           pokemonTypesDiv.innerHTML = '';
           pokemonStatsGrid.innerHTML = '';
        } else if (!activeLi) {
            // Se não há seleção ativa (ex: após limpar a pesquisa), mostra prompt
            showDisplayState('prompt');
        }

    };

    // --- Event Listeners ---
    searchInput.addEventListener('input', filterPokemon);

    // --- Inicialização ---
    fetchPokemonList(); // Começa buscando a lista completa
    showDisplayState('prompt'); // Garante que o estado inicial do display é o prompt

});