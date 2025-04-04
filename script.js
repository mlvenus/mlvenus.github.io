document.addEventListener('DOMContentLoaded', () => {
    const pokemonListUl = document.getElementById('pokemon-list');
    const pokemonInfoDiv = document.getElementById('pokemon-info');
    const pokemonNameH2 = document.getElementById('pokemon-name');
    const pokemonImageImg = document.getElementById('pokemon-image');
    const pokemonStatsDiv = document.getElementById('pokemon-stats');
    const selectPromptDiv = document.getElementById('select-prompt');
    const loadingLi = document.querySelector('#pokemon-list .loading');

    const POKEMON_COUNT = 50;
    const API_URL = 'https://pokeapi.co/api/v2/pokemon/';

    let pokemonCache = {}; // Cache simples para evitar fetches repetidos

    // Função para buscar a lista inicial de Pokémon
    const fetchPokemonList = async () => {
        try {
            const response = await fetch(`${API_URL}?limit=${POKEMON_COUNT}&offset=0`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            displayPokemonList(data.results);
        } catch (error) {
            console.error("Erro ao buscar lista de Pokémon:", error);
            pokemonListUl.innerHTML = '<li>Erro ao carregar a lista. Tente novamente mais tarde.</li>';
        }
    };

    // Função para exibir a lista de Pokémon
    const displayPokemonList = (pokemonArray) => {
        loadingLi.remove(); // Remove o item "A carregar..."
        pokemonListUl.innerHTML = ''; // Limpa a lista caso já exista algo (redundante com a linha acima, mas seguro)

        pokemonArray.forEach(pokemon => {
            const listItem = document.createElement('li');
            listItem.textContent = pokemon.name;
            listItem.dataset.url = pokemon.url; // Guarda a URL para buscar detalhes
            listItem.addEventListener('click', () => {
                // Remove a classe 'active' de todos os itens antes de adicionar ao clicado
                document.querySelectorAll('#pokemon-list li').forEach(li => li.classList.remove('active'));
                listItem.classList.add('active'); // Adiciona destaque ao item selecionado
                fetchPokemonDetails(pokemon.url);
            });
            pokemonListUl.appendChild(listItem);
        });
    };

    // Função para buscar detalhes de um Pokémon específico
    const fetchPokemonDetails = async (url) => {
        // Mostrar estado de carregamento no display
        selectPromptDiv.classList.add('hidden'); // Esconde o prompt inicial
        pokemonInfoDiv.classList.add('hidden'); // Esconde info anterior
        // Poderia adicionar um spinner/mensagem de loading aqui no display se quisesse

        // Verificar cache
        if (pokemonCache[url]) {
            displayPokemonDetails(pokemonCache[url]);
            return;
        }

        try {
            const response = await fetch(url);
             if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const pokemonData = await response.json();
            pokemonCache[url] = pokemonData; // Guarda no cache
            displayPokemonDetails(pokemonData);
        } catch (error) {
            console.error(`Erro ao buscar detalhes do Pokémon (${url}):`, error);
            pokemonNameH2.textContent = "Erro";
            pokemonImageImg.src = ""; // Limpa imagem
            pokemonImageImg.alt = "Erro ao carregar";
            pokemonStatsDiv.innerHTML = "<p>Não foi possível carregar os detalhes.</p>";
            pokemonInfoDiv.classList.remove('hidden'); // Mostra a área de info com a mensagem de erro
        }
    };

    // Função para exibir os detalhes do Pokémon selecionado
    const displayPokemonDetails = (pokemonData) => {
        pokemonNameH2.textContent = pokemonData.name;

        // Tenta obter o sprite animado (Geração 5), senão usa o default
        const animatedSprite = pokemonData.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        pokemonImageImg.src = animatedSprite || pokemonData.sprites.front_default || ''; // Usa animado, fallback para default, fallback para vazio
        pokemonImageImg.alt = `Imagem de ${pokemonData.name}`;

        // Limpa stats anteriores e adiciona os novos
        pokemonStatsDiv.innerHTML = '<h3>Stats Base:</h3>'; // Recria o título
        pokemonData.stats.forEach(statInfo => {
            const statElement = document.createElement('p');
            statElement.innerHTML = `${statInfo.stat.name}: <span>${statInfo.base_stat}</span>`;
            pokemonStatsDiv.appendChild(statElement);
        });

        // Mostra a área de informações
        selectPromptDiv.classList.add('hidden');
        pokemonInfoDiv.classList.remove('hidden');
    };

    // Inicia o processo buscando a lista
    fetchPokemonList();
});