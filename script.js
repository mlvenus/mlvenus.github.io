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
    const pokemonStatsGrid = document.getElementById('pokemon-stats'); // Corrected ID reference

    // --- Constantes e Variáveis ---
    const API_BASE_URL = 'https://pokeapi.co/api/v2/';
    const POKEMON_LIMIT = 1025; // Ajustar conforme a última geração conhecida na API (Gen 9 total as of ~early 2024)

    // Mapeamento de Gerações (IDs Inclusivos) - Based on Bulbapedia as of Gen 9
    const GENERATIONS = {
        1: { limit: 151, offset: 0 },   // 1-151
        2: { limit: 100, offset: 151 }, // 152-251
        3: { limit: 135, offset: 251 }, // 252-386
        4: { limit: 107, offset: 386 }, // 387-493
        5: { limit: 156, offset: 493 }, // 494-649
        6: { limit: 72, offset: 649 },  // 650-721
        7: { limit: 88, offset: 721 },  // 722-809 (Includes Alola forms/UBs in sequence)
        8: { limit: 96, offset: 809 },  // 810-905 (Includes Galar/Hisui forms if sequential in API)
        9: { limit: 120, offset: 905 }, // 906-1025 (Includes Paldea forms/Paradox/Treasures)
        // Adicionar futuras gerações aqui
    };

    let allPokemonBaseData = []; // Armazena { name, url, id, spriteUrl }
    let pokemonDetailsCache = {}; // Cache para detalhes { url: { details, species } }
    let currentGenerationFilter = 'all';
    let isFetchingAll = false; // Flag to prevent multiple simultaneous fetches

    // --- Funções ---

    // Mostra/Esconde estados do Display Central
    const showDisplayState = (state) => { // 'prompt', 'loading', 'info', 'error'
        displayPrompt.classList.add('hidden');
        displayLoader.classList.add('hidden');
        pokemonInfoDiv.classList.add('hidden');
        // Reset animation properties only if hiding
        if (state !== 'info') {
            pokemonInfoDiv.style.opacity = '0';
            pokemonInfoDiv.style.transform = 'translateY(20px)';
        }
        displayError.classList.add('hidden');

        switch (state) {
            case 'prompt': displayPrompt.classList.remove('hidden'); break;
            case 'loading': displayLoader.classList.remove('hidden'); break;
            case 'info':
                pokemonInfoDiv.classList.remove('hidden');
                // Ensure transition happens after display is set to block/grid
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { // Double RAF for robustness in some browsers
                        pokemonInfoDiv.style.opacity = '1';
                        pokemonInfoDiv.style.transform = 'translateY(0)';
                    });
                });
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
        if (isFetchingAll) return; // Prevent re-entry if already fetching
        isFetchingAll = true;

        carouselLoader.classList.remove('hidden');
        pokemonCarousel.innerHTML = ''; // Limpa carrossel
        showDisplayState('prompt'); // Show prompt while initial list loads

        try {
            // 1. Fetch the list of names/URLs
            const listResponse = await fetch(`${API_BASE_URL}pokemon?limit=${POKEMON_LIMIT}&offset=0`);
            if (!listResponse.ok) throw new Error(`List fetch failed: ${listResponse.status}`);
            const listData = await listResponse.json();

            // 2. Process basic data including ID extraction from URL (more efficient than individual fetches)
            allPokemonBaseData = listData.results.map(pokemon => {
                const urlParts = pokemon.url.split('/');
                const id = parseInt(urlParts[urlParts.length - 2], 10); // Extract ID from URL
                 // Construct default sprite URL directly (less reliable if API changes structure, but faster)
                 // const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
                 // Safer but requires fetch: We'll fetch sprites *during* carousel display for better performance.
                return {
                    name: pokemon.name,
                    url: pokemon.url,
                    id: id,
                    spriteUrl: null // Will be fetched on demand
                };
            }).filter(p => p.id <= POKEMON_LIMIT); // Ensure we don't exceed known limit if API returns more

            applyFilterAndDisplayCarousel(); // Display initially unfiltered carousel

        } catch (error) {
            console.error("Erro Crítico ao buscar lista de Pokémon:", error);
            pokemonCarousel.innerHTML = '<p class="error-message" style="color: #ff6b6b; text-align: center; width: 100%;">Falha ao carregar Pokémon. Recarregue a página.</p>';
             showDisplayState('error');
             // Update error message display
             displayError.querySelector('p').textContent = 'Falha grave ao carregar a lista de Pokémon.';
        } finally {
             carouselLoader.classList.add('hidden');
             isFetchingAll = false;
        }
    };


    // Aplica filtro e atualiza o carrossel
    const applyFilterAndDisplayCarousel = () => {
         pokemonCarousel.innerHTML = ''; // Limpa antes de filtrar
         carouselLoader.classList.remove('hidden'); // Show loader during filtering/rendering

         let filteredData = [];

         if (currentGenerationFilter === 'all') {
             filteredData = allPokemonBaseData;
         } else {
             const gen = parseInt(currentGenerationFilter, 10);
             if (GENERATIONS[gen]) {
                 const genInfo = GENERATIONS[gen];
                 const startId = genInfo.offset + 1;
                 const endId = genInfo.offset + genInfo.limit;
                 // Ensure filtering uses the pre-calculated ID
                 filteredData = allPokemonBaseData.filter(p => p.id >= startId && p.id <= endId);
             } else {
                 filteredData = allPokemonBaseData; // Fallback for invalid selection
             }
         }

        // Display placeholders first, then load images
        displayPokemonCarouselPlaceholders(filteredData);
        loadCarouselImages(filteredData); // Load images async

        carouselLoader.classList.add('hidden');

         // Clear main display if no Pokémon active or visible
         const activeItem = pokemonCarousel.querySelector('.carousel-item.active');
         if (!activeItem) {
            showDisplayState('prompt');
         } else {
             // If an item was active but is no longer in the filtered list, clear display
             const activeUrl = activeItem.dataset.url;
             if (!filteredData.some(p => p.url === activeUrl)) {
                 activeItem.classList.remove('active');
                 showDisplayState('prompt');
             }
         }
    };

    // Display carousel items without images initially
    const displayPokemonCarouselPlaceholders = (pokemonArray) => {
        pokemonCarousel.innerHTML = ''; // Clear carousel
        if (pokemonArray.length === 0) {
             pokemonCarousel.innerHTML = '<p class="info-message" style="color: #bdc3c7; text-align: center; width: 100%;">Nenhum Pokémon encontrado para esta geração.</p>';
             return;
        }

        pokemonArray.forEach(pokemon => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.dataset.url = pokemon.url; // Store main URL
            item.dataset.id = pokemon.id;   // Store ID for sprite fetching

            const img = document.createElement('img');
            // Use a placeholder or leave src empty initially
            img.src = 'img/pokeball.png'; // Placeholder image
            img.alt = pokemon.name;
            img.loading = 'lazy'; // Still useful

            item.appendChild(img);
            item.addEventListener('click', handleCarouselItemClick);
            pokemonCarousel.appendChild(item);
        });
    };

    // Fetch and update sprites for visible carousel items (basic lazy loading)
    const loadCarouselImages = async (pokemonArray) => {
        const items = pokemonCarousel.querySelectorAll('.carousel-item');
        const promises = [];

        items.forEach(item => {
            const pokemonId = item.dataset.id;
            const img = item.querySelector('img');
            // Optional: Check if image is already loaded or is placeholder
            // if (img.src.includes('pokeball.png')) {
                // Simple direct URL construction (faster, less robust if URL structure changes)
                const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
                // Preload the image before setting src
                const tempImg = new Image();
                tempImg.onload = () => { img.src = spriteUrl; };
                tempImg.onerror = () => { img.src = 'img/pokeball.png'; }; // Fallback on error
                tempImg.src = spriteUrl;
            // }

            // --- Alternative using individual fetches (more robust, MUCH slower) ---
            // const pokemonUrl = item.dataset.url;
            // promises.push(
            //     fetch(pokemonUrl)
            //         .then(res => res.ok ? res.json() : Promise.reject(`Sprite fetch failed for ${pokemonId}`))
            //         .then(data => {
            //             img.src = data.sprites.front_default || 'img/pokeball.png';
            //         })
            //         .catch(err => {
            //             console.warn(err);
            //             img.src = 'img/pokeball.png'; // Fallback
            //         })
            // );
        });

        // await Promise.all(promises); // Only needed for the fetch alternative
    };


     // Handler for clique no item do carrossel
    const handleCarouselItemClick = (event) => {
        const item = event.currentTarget;
        const url = item.dataset.url;

        // Ignore click if already active? Optional.
        // if (item.classList.contains('active')) return;

        // Remove active class from others, add to clicked
        document.querySelectorAll('.carousel-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        // Scroll to the item (ensure it's visible)
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        fetchPokemonDetailsAndSpecies(url);
    };


    // Busca detalhes completos (Pokémon + Species)
    const fetchPokemonDetailsAndSpecies = async (url) => {
        showDisplayState('loading');

        // Check cache first
        if (pokemonDetailsCache[url]) {
            console.log("Cache hit for:", url)
            displayPokemonDetails(pokemonDetailsCache[url].details, pokemonDetailsCache[url].species);
            return;
        }
        console.log("Cache miss, fetching:", url)

        try {
            // Construct the species URL correctly from the base Pokémon URL
            const pokemonId = url.split('/').filter(Boolean).pop(); // Get ID from URL
            const speciesUrl = `${API_BASE_URL}pokemon-species/${pokemonId}/`;

            const [detailsResponse, speciesResponse] = await Promise.all([
                fetch(url),
                fetch(speciesUrl)
            ]);

            // Improved error handling for individual fetches
            if (!detailsResponse.ok) throw new Error(`Details fetch failed (${detailsResponse.status}) for ${url}`);
            if (!speciesResponse.ok) throw new Error(`Species fetch failed (${speciesResponse.status}) for ${speciesUrl}`);

            const detailsData = await detailsResponse.json();
            const speciesData = await speciesResponse.json();

            // Store in cache
            pokemonDetailsCache[url] = { details: detailsData, species: speciesData };

            displayPokemonDetails(detailsData, speciesData);

        } catch (error) {
            console.error(`Erro ao buscar detalhes completos (${url}):`, error);
            showDisplayState('error');
             // Update error message display
             displayError.querySelector('p').textContent = `Erro ao carregar: ${error.message}`;
        }
    };

    // Exibe os detalhes completos no Display Central
    const displayPokemonDetails = (details, species) => {
        // Nome e ID
        pokemonNameH2.textContent = details.name;
        pokemonIdDiv.textContent = `#${String(details.id).padStart(4, '0')}`; // Pad to 4 digits

        // Imagem (Prioritize official art, then animated, then default)
        const officialArt = details.sprites.other?.['official-artwork']?.front_default;
        const animatedSprite = details.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default;
        const defaultSprite = details.sprites.front_default;
        pokemonImage.src = officialArt || animatedSprite || defaultSprite || 'img/pokeball.png'; // Fallback chain
        pokemonImage.alt = details.name;

        // Tipos
        pokemonTypesDiv.innerHTML = '';
        details.types.forEach(typeInfo => {
            const typeBadge = document.createElement('span');
            typeBadge.textContent = typeInfo.type.name;
            typeBadge.className = `type-badge type-${typeInfo.type.name}`;
            pokemonTypesDiv.appendChild(typeBadge);
        });

        // Descrição (Find 'en' entry, clean it)
        const englishEntry = species.flavor_text_entries.find(
            entry => entry.language.name === 'en'
        );
         const cleanedDescription = englishEntry
            ? englishEntry.flavor_text.replace(/[\n\f\r\u00ad]/g, ' ').replace(/\s+/g, ' ').trim() // Clean newlines, soft hyphens, extra spaces
            : 'No description available for this Pokémon.';
        pokemonDescriptionP.textContent = cleanedDescription;


        // Stats
        pokemonStatsGrid.innerHTML = ''; // Clear previous stats
        const maxStatValue = 255; // Theoretical max for bar calculation

        details.stats.forEach(statInfo => {
            const statValue = statInfo.base_stat;
            // Clean up stat names like "special-attack" -> "Sp. Atk"
            const statNameRaw = statInfo.stat.name;
            let statNameDisplay = statNameRaw.replace('-', ' ');
             if (statNameRaw === 'special-attack') statNameDisplay = 'Sp. Atk';
             else if (statNameRaw === 'special-defense') statNameDisplay = 'Sp. Def';
             else statNameDisplay = statNameDisplay.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');


            const nameElement = document.createElement('div');
            nameElement.className = 'stat-name';
            nameElement.textContent = statNameDisplay; // Use cleaned name

            const barContainer = document.createElement('div');
            barContainer.className = 'stat-bar-container';
            const barElement = document.createElement('div');
            barElement.className = 'stat-bar';
            // Calculate percentage, ensuring it doesn't exceed 100% visually even if data is odd
            const percentage = Math.min(100, Math.max(0, (statValue / maxStatValue) * 100));

             // Set width directly, transition is handled by CSS
            barElement.style.width = `0%`; // Start at 0 for animation
            // Animate width after element is rendered and display state is 'info'
             setTimeout(() => {
                 // Check if still in 'info' state before animating
                 if (!pokemonInfoDiv.classList.contains('hidden')) {
                    barElement.style.width = `${percentage}%`;
                 }
             }, 50); // Small delay ensures transition occurs

            barContainer.appendChild(barElement);

            const valueElement = document.createElement('div');
            valueElement.className = 'stat-value';
            valueElement.textContent = statValue;

            pokemonStatsGrid.appendChild(nameElement);
            pokemonStatsGrid.appendChild(barContainer);
            pokemonStatsGrid.appendChild(valueElement);
        });

        showDisplayState('info'); // Show the info panel now that it's populated
    };


    // --- Event Listeners ---
    generationSelect.addEventListener('change', (event) => {
        currentGenerationFilter = event.target.value;
        applyFilterAndDisplayCarousel();
        // Clear display ONLY if a different generation is selected
        // No need to explicitly clear if 'all' is selected again, or if the same gen is re-selected.
        // applyFilterAndDisplayCarousel handles clearing if the active item is removed.
    });

    // --- Inicialização ---
    populateGenerationSelect();
    fetchAllPokemonBaseData(); // Start the initial data fetch
    showDisplayState('prompt'); // Show initial prompt

});