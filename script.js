document.addEventListener('DOMContentLoaded', () => {
    // --- Referências DOM ---
    const generationSelect = document.getElementById('generation-select');
    const pokemonCarousel = document.getElementById('pokemon-carousel');
    const carouselLoader = document.getElementById('carousel-loader');

    const displayArea = document.querySelector('.pokemon-display-area');
    const displayLoader = document.getElementById('display-loader');
    const displayPrompt = document.getElementById('display-prompt');
    const displayError = document.getElementById('display-error');
    const pokemonInfoDiv = document.getElementById('pokemon-info');

    const pokemonNameH2 = document.getElementById('pokemon-name');
    const pokemonIdDiv = document.getElementById('pokemon-id');
    const pokemonImage = document.getElementById('pokemon-image');
    const pokemonTypesDiv = document.getElementById('pokemon-types');
    const pokemonDescriptionP = document.getElementById('pokemon-description');
    const pokemonStatsGrid = document.getElementById('pokemon-stats');

    // --- Constantes e Variáveis ---
    const API_BASE_URL = 'https://pokeapi.co/api/v2/';
    const POKEMON_LIMIT = 1025; // Ajustar conforme a última geração conhecida na API

    // Mapeamento de Gerações (IDs Inclusivos) - Pode precisar de ajuste futuro
    const GENERATIONS = {
        1: { limit: 151, offset: 0 },
        2: { limit: 100, offset: 151 },
        3: { limit: 135, offset: 251 },
        4: { limit: 107, offset: 386 },
        5: { limit: 156, offset: 493 },
        6: { limit: 72, offset: 649 },
        7: { limit: 88, offset: 721 },
        8: { limit: 96, offset: 809 }, // Inclui formas de Hisui/Galar se estiverem na sequência
        9: { limit: 120, offset: 905 }, // Ajustar limite da Gen 9
        // Adicionar futuras gerações aqui
    };

    let allPokemonBaseData = []; // Armazena { name, url, id, spriteUrl }
    let pokemonDetailsCache = {}; // Cache para detalhes { url: { details, species } }
    let currentGenerationFilter = 'all';

    // --- Funções ---

    // Mostra/Esconde estados do Display Central
    const showDisplayState = (state) => { // 'prompt', 'loading', 'info', 'error'
        displayPrompt.classList.add('hidden');
        displayLoader.classList.add('hidden');
        pokemonInfoDiv.classList.add('hidden');
        pokemonInfoDiv.style.opacity = '0'; // Reset para animação
        pokemonInfoDiv.style.transform = 'translateY(20px)'; // Reset para animação
        displayError.classList.add('hidden');

        switch (state) {
            case 'prompt': displayPrompt.classList.remove('hidden'); break;
            case 'loading': displayLoader.classList.remove('hidden'); break;
            case 'info':
                pokemonInfoDiv.classList.remove('hidden');
                // Força reflow para garantir que a transição ocorra
                void pokemonInfoDiv.offsetWidth;
                pokemonInfoDiv.style.opacity = '1';
                pokemonInfoDiv.style.transform = 'translateY(0)';
                break;
            case 'error': displayError.classList.remove('hidden'); break;
        }
    };

    // Popula o Dropdown de Gerações
    const populateGenerationSelect = () => {
        for (const gen in GENERATIONS) {
            const option = document.createElement('option');
            option.value = gen;
            option.textContent = `Geração ${gen}`;
            generationSelect.appendChild(option);
        }
    };

    // Busca TODOS os dados base (Nome, URL, ID, Sprite Padrão)
    const fetchAllPokemonBaseData = async () => {
        carouselLoader.classList.remove('hidden');
        pokemonCarousel.innerHTML = ''; // Limpa carrossel
        showDisplayState('prompt'); // Mostra prompt inicial enquanto carrega

        try {
            // Usar Promise.all para buscar todos os Pokémon (pode ser pesado!)
            // Uma alternativa seria buscar apenas a lista de nomes/urls primeiro
            // e depois buscar os sprites conforme necessário ou em lotes.
            // Por simplicidade (e para o visual do carrossel), buscamos tudo.

            // 1. Buscar a lista de nomes/URLs
            const listResponse = await fetch(`${API_BASE_URL}pokemon?limit=${POKEMON_LIMIT}&offset=0`);
            if (!listResponse.ok) throw new Error(`List fetch failed: ${listResponse.status}`);
            const listData = await listResponse.json();

            // 2. Para cada Pokémon, buscar seu dado básico incluindo sprite (isso gera muitas requisições!)
            // Otimização: Poderia buscar apenas os dados base sem sprite e carregar sprites no carrossel sob demanda (lazy load)
            // Mas para o pedido atual, vamos buscar os sprites padrão.
            const pokemonPromises = listData.results.map(async (pokemon) => {
                 try {
                    const basicDataResponse = await fetch(pokemon.url);
                    if (!basicDataResponse.ok) {
                         console.warn(`Failed to fetch basic data for ${pokemon.name}`);
                         return null; // Retorna null se falhar para este Pokémon
                    }
                    const basicData = await basicDataResponse.json();
                    return {
                        name: pokemon.name,
                        url: pokemon.url,
                        id: basicData.id,
                        spriteUrl: basicData.sprites.front_default || 'img/pokeball.png' // Fallback sprite
                    };
                 } catch (fetchError) {
                     console.warn(`Error fetching basic data for ${pokemon.name}:`, fetchError);
                    return null; // Retorna null em caso de erro de fetch
                 }
            });

            const results = await Promise.all(pokemonPromises);
            allPokemonBaseData = results.filter(p => p !== null); // Filtra os que falharam

            applyFilterAndDisplayCarousel(); // Exibe o carrossel inicial

        } catch (error) {
            console.error("Erro Crítico ao buscar dados base dos Pokémon:", error);
            pokemonCarousel.innerHTML = '<p class="error-message">Falha ao carregar Pokémon. Recarregue a página.</p>';
             showDisplayState('error');
        } finally {
             carouselLoader.classList.add('hidden');
        }
    };


    // Aplica filtro e atualiza o carrossel
    const applyFilterAndDisplayCarousel = () => {
         pokemonCarousel.innerHTML = ''; // Limpa antes de filtrar
         carouselLoader.classList.remove('hidden'); // Mostra loader rápido

         let filteredData = [];

         if (currentGenerationFilter === 'all') {
             filteredData = allPokemonBaseData;
         } else {
             const gen = parseInt(currentGenerationFilter, 10);
             if (GENERATIONS[gen]) {
                 const genInfo = GENERATIONS[gen];
                 const startId = genInfo.offset + 1;
                 const endId = genInfo.offset + genInfo.limit;
                 filteredData = allPokemonBaseData.filter(p => p.id >= startId && p.id <= endId);
             } else {
                 filteredData = allPokemonBaseData; // Fallback para todos se gen for inválida
             }
         }

         displayPokemonCarousel(filteredData);
         carouselLoader.classList.add('hidden');

         // Limpa display central se nenhum Pokémon estiver ativo ou visível
         const activeItem = pokemonCarousel.querySelector('.carousel-item.active');
         if (!activeItem) {
            showDisplayState('prompt');
         }
    };


    // Exibe os Pokémon no Carrossel
    const displayPokemonCarousel = (pokemonArray) => {
        pokemonCarousel.innerHTML = ''; // Limpa carrossel
        if (pokemonArray.length === 0) {
             pokemonCarousel.innerHTML = '<p class="info-message">Nenhum Pokémon nesta geração.</p>';
             return;
        }

        pokemonArray.forEach(pokemon => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.dataset.url = pokemon.url; // Guarda URL principal para detalhes

            const img = document.createElement('img');
            img.src = pokemon.spriteUrl;
            img.alt = pokemon.name;
            img.loading = 'lazy'; // Lazy loading para imagens do carrossel

            item.appendChild(img);
            item.addEventListener('click', handleCarouselItemClick);
            pokemonCarousel.appendChild(item);
        });
    };

     // Handler para clique no item do carrossel
    const handleCarouselItemClick = (event) => {
        const item = event.currentTarget;
        const url = item.dataset.url;

        // Remove active class de todos, adiciona ao clicado
        document.querySelectorAll('.carousel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // Scroll para o item ativo (opcional, mas bom UX)
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        fetchPokemonDetailsAndSpecies(url);
    };


    // Busca detalhes completos (Pokémon + Species)
    const fetchPokemonDetailsAndSpecies = async (url) => {
        showDisplayState('loading');

        if (pokemonDetailsCache[url]) {
            displayPokemonDetails(pokemonDetailsCache[url].details, pokemonDetailsCache[url].species);
            return;
        }

        try {
            const speciesUrl = url.replace('/pokemon/', '/pokemon-species/');
            const [detailsResponse, speciesResponse] = await Promise.all([
                fetch(url),
                fetch(speciesUrl)
            ]);

            if (!detailsResponse.ok) throw new Error(`Details fetch failed: ${detailsResponse.status}`);
            if (!speciesResponse.ok) throw new Error(`Species fetch failed: ${speciesResponse.status}`);

            const detailsData = await detailsResponse.json();
            const speciesData = await speciesResponse.json();

            // Guarda no cache
            pokemonDetailsCache[url] = { details: detailsData, species: speciesData };

            displayPokemonDetails(detailsData, speciesData);

        } catch (error) {
            console.error(`Erro ao buscar detalhes completos (${url}):`, error);
            showDisplayState('error');
        }
    };

    // Exibe os detalhes completos no Display Central
    const displayPokemonDetails = (details, species) => {
        // Nome e ID
        pokemonNameH2.textContent = details.name;
        pokemonIdDiv.textContent = `#${String(details.id).padStart(3, '0')}`;

        // Imagem (Animada com Fallback)
        const animatedSprite = details.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        pokemonImage.src = animatedSprite || details.sprites.front_default || 'img/pokeball.png'; // Usar sprite padrão se animado não existir
        pokemonImage.alt = details.name;

        // Tipos
        pokemonTypesDiv.innerHTML = '';
        details.types.forEach(typeInfo => {
            const typeBadge = document.createElement('span');
            typeBadge.textContent = typeInfo.type.name;
            typeBadge.className = `type-badge type-${typeInfo.type.name}`;
            pokemonTypesDiv.appendChild(typeBadge);
        });

        // Descrição (Procura uma em Inglês)
        const englishEntry = species.flavor_text_entries.find(
            entry => entry.language.name === 'en'
        );
        // Limpa caracteres estranhos que podem vir da API
         const cleanedDescription = englishEntry
            ? englishEntry.flavor_text.replace(/[\n\f\r]/g, ' ')
            : 'No description available.';
        pokemonDescriptionP.textContent = cleanedDescription;


        // Stats
        pokemonStatsGrid.innerHTML = '';
        const maxStatValue = 255; // Valor máximo para cálculo da barra

        details.stats.forEach(statInfo => {
            const statValue = statInfo.base_stat;
            const statName = statInfo.stat.name.replace('-', ' ');

            const nameElement = document.createElement('div');
            nameElement.className = 'stat-name';
            nameElement.textContent = statName;

            const barContainer = document.createElement('div');
            barContainer.className = 'stat-bar-container';
            const barElement = document.createElement('div');
            barElement.className = 'stat-bar';
            const percentage = Math.min(100, (statValue / maxStatValue) * 100); // Garante max 100%

            // Atraso para animação da barra após o display ficar visível
            setTimeout(() => {
                 barElement.style.width = `${percentage}%`;
            }, 100); // Pequeno delay

            barContainer.appendChild(barElement);

            const valueElement = document.createElement('div');
            valueElement.className = 'stat-value';
            valueElement.textContent = statValue;

            pokemonStatsGrid.appendChild(nameElement);
            pokemonStatsGrid.appendChild(barContainer);
            pokemonStatsGrid.appendChild(valueElement);
        });

        showDisplayState('info');
    };


    // --- Event Listeners ---
    generationSelect.addEventListener('change', (event) => {
        currentGenerationFilter = event.target.value;
        applyFilterAndDisplayCarousel();
        // Limpa display se mudar a geração e houver seleção ativa
         const activeItem = pokemonCarousel.querySelector('.carousel-item.active');
         if(activeItem) {
             activeItem.classList.remove('active');
             showDisplayState('prompt');
         }
    });

    // --- Inicialização ---
    populateGenerationSelect();
    fetchAllPokemonBaseData(); // Inicia o carregamento pesado!
    showDisplayState('prompt');

});