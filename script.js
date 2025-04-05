document.addEventListener('DOMContentLoaded', async () => { // Added async for initial fetch
    // --- DOM References ---
    const generationSelect = document.getElementById('generation-select');
    const typeFilter = document.getElementById('type-filter');
    const favoriteFilter = document.getElementById('favorite-filter');
    const searchInput = document.getElementById('search-input');
    const pokemonCarousel = document.getElementById('pokemon-carousel');
    const carouselLoader = document.getElementById('carousel-loader');
    const displayArea = document.getElementById('pokemon-display-area-main');
    const displayLoader = document.getElementById('display-loader');
    const displayPrompt = document.getElementById('display-prompt');
    const displayError = document.getElementById('display-error');
    const errorDetailsP = document.getElementById('error-details');
    const pokemonInfoDiv = document.getElementById('pokemon-info');
    const pokemonNameH2 = document.getElementById('pokemon-name');
    const pokemonIdDiv = document.getElementById('pokemon-id');
    const cryButton = document.getElementById('cry-button');
    const favoriteButton = document.getElementById('favorite-button');
    const pokemonTypesDiv = document.getElementById('pokemon-types');
    const pokemonHeightSpan = document.getElementById('pokemon-height');
    const pokemonWeightSpan = document.getElementById('pokemon-weight');
    const pokemonDescriptionP = document.getElementById('pokemon-description');
    const pokemonAbilitiesUl = document.getElementById('pokemon-abilities');
    const pokemonImage = document.getElementById('pokemon-image');
    const spriteDefaultButton = document.getElementById('sprite-default-button');
    const spriteShinyButton = document.getElementById('sprite-shiny-button');
    const pokemonStatsGrid = document.getElementById('pokemon-stats');
    const typeEffectivenessDiv = document.getElementById('type-effectiveness');
    const pokemonEvolutionDiv = document.getElementById('pokemon-evolution');
    const cryAudio = document.getElementById('pokemon-cry-audio');

    // --- Constants & Variables ---
    const API_BASE_URL = 'https://pokeapi.co/api/v2/';
    const POKEMON_LIMIT = 1025; // Adjust as needed
    const GENERATIONS = { /* Generation map remains the same */
        1: { limit: 151, offset: 0 }, 2: { limit: 100, offset: 151 }, 3: { limit: 135, offset: 251 },
        4: { limit: 107, offset: 386 }, 5: { limit: 156, offset: 493 }, 6: { limit: 72, offset: 649 },
        7: { limit: 88, offset: 721 }, 8: { limit: 96, offset: 809 }, 9: { limit: 120, offset: 905 },
    };
    const MAX_STAT_VALUE = 255;
    const FAVORITES_STORAGE_KEY = 'pokedexSupremaFavorites';

    let allPokemonBaseData = []; // { name, url, id }
    let pokemonDetailsCache = {}; // Cache: { url: { details, species, evolution, typeData, abilityData, cryUrl, sprites } }
    let typeDataCache = {}; // Stores fetched type relations { typeName: typeApiData }
    let abilityDataCache = {}; // Stores fetched ability descriptions { abilityUrl: abilityApiData }
    let favoritePokemon = new Set(); // Set of favorited pokemon URLs
    let currentFilters = {
        generation: 'all',
        type: 'all',
        search: '',
        favorites: 'all'
    };
    let currentDisplayedPokemonUrl = null;
    let isFetchingAll = false;

    // --- Utility Functions ---
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    const formatId = (id) => `#${String(id).padStart(4, '0')}`;
    const formatHeight = (decimetres) => `${(decimetres / 10).toFixed(1)} m`;
    const formatWeight = (hectograms) => `${(hectograms / 10).toFixed(1)} kg`;

    // --- LocalStorage Functions ---
    const loadFavorites = () => {
        const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (storedFavorites) {
            favoritePokemon = new Set(JSON.parse(storedFavorites));
        }
    };
    const saveFavorites = () => {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoritePokemon]));
    };
    const toggleFavorite = (url) => {
        if (favoritePokemon.has(url)) {
            favoritePokemon.delete(url);
        } else {
            favoritePokemon.add(url);
        }
        saveFavorites();
        updateFavoriteButtonState(url);
        // Update marker on carousel item if visible
        const carouselItem = pokemonCarousel.querySelector(`.carousel-item[data-url="${url}"]`);
        if (carouselItem) {
            carouselItem.classList.toggle('is-favorite', favoritePokemon.has(url));
        }
    };

    // --- UI Update Functions ---
    const showDisplayState = (state, errorMsg = '') => {
        displayPrompt.classList.add('hidden');
        displayLoader.classList.add('hidden');
        pokemonInfoDiv.classList.add('hidden');
        displayError.classList.add('hidden');
        errorDetailsP.textContent = ''; // Clear previous errors

        // Reset animation properties only if hiding 'info'
        if (pokemonInfoDiv.style.opacity === '1' && state !== 'info') {
            pokemonInfoDiv.style.opacity = '0';
            pokemonInfoDiv.style.transform = 'translateY(20px)';
        }

        switch (state) {
            case 'prompt': displayPrompt.classList.remove('hidden'); break;
            case 'loading': displayLoader.classList.remove('hidden'); break;
            case 'info':
                pokemonInfoDiv.classList.remove('hidden');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        pokemonInfoDiv.style.opacity = '1';
                        pokemonInfoDiv.style.transform = 'translateY(0)';
                    });
                });
                break;
            case 'error':
                displayError.classList.remove('hidden');
                errorDetailsP.textContent = errorMsg;
                break;
        }
    };

    const applyTypeBackground = (types = []) => {
        // Remove previous type classes
        const typeClasses = Object.keys(typeDataCache).map(t => `type-${t}`);
        displayArea.classList.remove(...typeClasses);

        if (types.length > 0) {
            const primaryType = types[0].type.name;
            displayArea.classList.add(`type-${primaryType}`);
        }
    };

    const updateFavoriteButtonState = (url) => {
        if (url === currentDisplayedPokemonUrl) {
            favoriteButton.classList.toggle('active', favoritePokemon.has(url));
            favoriteButton.textContent = favoritePokemon.has(url) ? '★' : '☆'; // Update icon
            favoriteButton.setAttribute('aria-label', favoritePokemon.has(url) ? 'Desmarcar Favorito' : 'Marcar como Favorito');
        }
    };

    // --- Initialization Functions ---
    const populateFilterDropdowns = () => {
        // Generations
        for (const gen in GENERATIONS) {
            const option = document.createElement('option');
            option.value = gen; option.textContent = `Geração ${gen}`;
            generationSelect.appendChild(option);
        }
        // Types (Populated after type data is fetched)
    };

    const fetchAllTypeData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}type?limit=18`); // Fetch all 18 types
            if (!response.ok) throw new Error('Failed to fetch type list');
            const data = await response.json();

            const typePromises = data.results.map(type => fetch(type.url).then(res => {
                if (!res.ok) console.warn(`Failed to fetch details for type: ${type.name}`);
                return res.ok ? res.json() : null;
            }));

            const typeDetails = await Promise.all(typePromises);

            typeDetails.filter(details => details !== null).forEach(details => {
                typeDataCache[details.name] = details.damage_relations;
                // Add type to filter dropdown
                const option = document.createElement('option');
                option.value = details.name; option.textContent = capitalize(details.name);
                typeFilter.appendChild(option);
            });
            console.log("Type data pre-fetched and cached.");

        } catch (error) {
            console.error("Error pre-fetching type data:", error);
            // Handle error - maybe disable type filtering?
        }
    };

    const fetchAllPokemonBaseData = async () => {
        if (isFetchingAll) return;
        isFetchingAll = true;
        carouselLoader.classList.remove('hidden');
        pokemonCarousel.innerHTML = '';
        showDisplayState('prompt');

        try {
            const response = await fetch(`${API_BASE_URL}pokemon?limit=${POKEMON_LIMIT}&offset=0`);
            if (!response.ok) throw new Error(`List fetch failed: ${response.status}`);
            const data = await response.json();
            allPokemonBaseData = data.results.map(p => ({
                name: p.name,
                url: p.url,
                id: parseInt(p.url.split('/').filter(Boolean).pop(), 10)
            })).filter(p => p.id <= POKEMON_LIMIT); // Ensure within limit

            filterAndDisplayCarousel(); // Initial display

        } catch (error) {
            console.error("Critical error fetching Pokémon list:", error);
            pokemonCarousel.innerHTML = '<p class="error-message" style="color: #ff6b6b; text-align: center; width: 100%;">Falha ao carregar Pokémon. Recarregue.</p>';
            showDisplayState('error', 'Falha ao buscar lista de Pokémon.');
        } finally {
            carouselLoader.classList.add('hidden');
            isFetchingAll = false;
        }
    };


    // --- Carousel Filtering & Display ---
    const filterAndDisplayCarousel = () => {
        carouselLoader.classList.remove('hidden'); // Show loader briefly

        // Apply all filters
        let filteredData = allPokemonBaseData.filter(pokemon => {
            // Generation Filter
            if (currentFilters.generation !== 'all') {
                const genInfo = GENERATIONS[currentFilters.generation];
                const startId = genInfo.offset + 1;
                const endId = genInfo.offset + genInfo.limit;
                if (pokemon.id < startId || pokemon.id > endId) return false;
            }
            // Search Filter (Name or ID)
            if (currentFilters.search) {
                const searchTerm = currentFilters.search.toLowerCase();
                if (!pokemon.name.includes(searchTerm) && String(pokemon.id) !== searchTerm) {
                    return false;
                }
            }
             // Favorite Filter
             if (currentFilters.favorites === 'favorites' && !favoritePokemon.has(pokemon.url)) {
                 return false;
             }

            // Type Filter (Requires details - fetch or cache?)
            // This is tricky without details. We'll apply type filter *after* fetching details for the main view,
            // or we could implement a slower carousel filter that fetches types.
            // For now, type filter will NOT filter the carousel directly, only apply when loading details.
            // A better approach would be to fetch basic types for ALL pokemon initially if performance allows.

            return true; // Passed all applicable filters
        });

        displayPokemonCarousel(filteredData);
        carouselLoader.classList.add('hidden');

        // Clear display if active Pokémon is filtered out
        const activeItem = pokemonCarousel.querySelector('.carousel-item.active');
        if (activeItem && !filteredData.some(p => p.url === activeItem.dataset.url)) {
             activeItem.classList.remove('active');
             showDisplayState('prompt');
             applyTypeBackground(); // Reset background
             currentDisplayedPokemonUrl = null;
        } else if (!activeItem && !pokemonInfoDiv.classList.contains('hidden') && !displayLoader.classList.contains('hidden')) {
            // If something was displayed but no item is active (e.g., after filtering)
             showDisplayState('prompt');
             applyTypeBackground(); // Reset background
             currentDisplayedPokemonUrl = null;
        }
    };

    const displayPokemonCarousel = (pokemonArray) => {
        pokemonCarousel.innerHTML = ''; // Clear previous
        if (pokemonArray.length === 0) {
            pokemonCarousel.innerHTML = '<p class="info-message" style="color: #bdc3c7; text-align: center; width: 100%;">Nenhum Pokémon encontrado.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        pokemonArray.forEach(pokemon => {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            item.dataset.url = pokemon.url;
            item.dataset.id = pokemon.id;
            item.classList.toggle('is-favorite', favoritePokemon.has(pokemon.url)); // Mark favorites

            const img = document.createElement('img');
             // Use official artwork or fallback sprite URL (faster than fetching just for carousel)
             img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
             img.alt = pokemon.name;
             img.loading = 'lazy';
             img.onerror = () => { // Fallback if official art fails
                 img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
                 img.onerror = () => { img.src = 'img/pokeball.png'; }; // Final fallback
             };

            const favMarker = document.createElement('span');
            favMarker.className = 'favorite-marker';
            favMarker.textContent = '★'; // Star icon

            item.appendChild(img);
            item.appendChild(favMarker); // Add marker
            item.addEventListener('click', handleCarouselItemClick);
            fragment.appendChild(item);
        });
        pokemonCarousel.appendChild(fragment);
    };

     // --- Fetching Detailed Pokémon Data ---

    const fetchJson = async (url, cache = null, cacheKey = null) => {
        if (cache && cacheKey && cache[cacheKey]) {
            // console.log("Cache hit for:", cacheKey);
            return cache[cacheKey];
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Workspace failed (${response.status}) for ${url}`);
            const data = await response.json();
            if (cache && cacheKey) {
                cache[cacheKey] = data;
                // console.log("Fetched and cached:", cacheKey);
            }
            return data;
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw error; // Re-throw to be caught by the main handler
        }
    };

    const fetchAllDetails = async (url) => {
        currentDisplayedPokemonUrl = url; // Track currently selected
        showDisplayState('loading');
        applyTypeBackground(); // Reset background while loading

        // Use cache if available
        if (pokemonDetailsCache[url]) {
            console.log("Full cache hit:", url);
            displayAllDetails(pokemonDetailsCache[url]);
            return;
        }
        console.log("Cache miss, fetching all details for:", url);

        try {
            // 1. Fetch Base Details and Species
            const details = await fetchJson(url);
            const species = await fetchJson(details.species.url);

            // 2. Fetch Evolution Chain Data
            const evolutionChainUrl = species.evolution_chain.url;
            const evolutionData = await fetchJson(evolutionChainUrl); // Evolution chains rarely change, could cache long-term

            // 3. Fetch Ability Descriptions (Use cache)
            const abilityPromises = details.abilities.map(abilityInfo =>
                fetchJson(abilityInfo.ability.url, abilityDataCache, abilityInfo.ability.url)
            );
            const abilityDetails = await Promise.all(abilityPromises);

            // 4. Get Type Data (Already cached in typeDataCache)
            const typeDetails = details.types.map(typeInfo => ({
                name: typeInfo.type.name,
                relations: typeDataCache[typeInfo.type.name] || null // Use pre-fetched data
            }));

             // 5. Prepare Sprite URLs
             const sprites = {
                 default: details.sprites.other?.['official-artwork']?.front_default || details.sprites.front_default || 'img/pokeball.png',
                 shiny: details.sprites.other?.['official-artwork']?.front_shiny || details.sprites.front_shiny || details.sprites.front_default || 'img/pokeball.png',
                 // Add other forms here if needed
             };

             // 6. Get Cry URL
             const cryUrl = details.cries?.latest || details.cries?.legacy || null;


            // Assemble cached data
            const combinedData = {
                details, species, evolution: evolutionData,
                types: typeDetails, abilities: abilityDetails, cryUrl, sprites
            };
            pokemonDetailsCache[url] = combinedData; // Store combined data

            displayAllDetails(combinedData);

        } catch (error) {
            console.error(`Error fetching full details for ${url}:`, error);
            showDisplayState('error', `Failed to load details: ${error.message}`);
             currentDisplayedPokemonUrl = null; // Reset tracking on error
        }
    };


    // --- Displaying Detailed Pokémon Data ---

    const displayAllDetails = (data) => {
        // Apply Type Background
        applyTypeBackground(data.details.types);

        // Basic Info
        pokemonNameH2.textContent = data.details.name;
        pokemonIdDiv.textContent = formatId(data.details.id);
        pokemonHeightSpan.textContent = formatHeight(data.details.height);
        pokemonWeightSpan.textContent = formatWeight(data.details.weight);

        // Description
        const englishEntry = data.species.flavor_text_entries.find(e => e.language.name === 'en');
        const cleanedDesc = englishEntry ? englishEntry.flavor_text.replace(/[\n\f\r\u00ad]/g, ' ').replace(/\s+/g, ' ').trim() : 'No description available.';
        pokemonDescriptionP.textContent = cleanedDesc;

        // Update Favorite Button State
        updateFavoriteButtonState(data.details.species.url.replace("-species", "")); // Use consistent URL format if needed

        // Cry Button
        cryButton.onclick = () => playCry(data.cryUrl);
        cryButton.disabled = !data.cryUrl;

        // Sprites
        displaySprites(data.sprites);

        // Types & Effectiveness
        displayTypesAndEffectiveness(data.types);

        // Abilities
        displayAbilities(data.details.abilities, data.abilities);

        // Stats
        displayStats(data.details.stats);

        // Evolution Chain
        displayEvolutionChain(data.evolution.chain);

        showDisplayState('info'); // Show the populated info panel
    };

    const playCry = (url) => {
        if (!url) return;
        cryAudio.src = url;
        cryAudio.play().catch(e => console.error("Audio playback failed:", e));
         // Add visual feedback to button maybe?
         cryButton.style.transform = 'scale(1.1)';
         setTimeout(() => { cryButton.style.transform = 'scale(1)'; }, 200);
    };

    const displaySprites = (sprites) => {
        pokemonImage.src = sprites.default; // Start with default
        spriteDefaultButton.onclick = () => {
            pokemonImage.src = sprites.default;
            spriteDefaultButton.classList.add('active');
            spriteShinyButton.classList.remove('active');
        };
        spriteShinyButton.onclick = () => {
            pokemonImage.src = sprites.shiny;
            spriteShinyButton.classList.add('active');
            spriteDefaultButton.classList.remove('active');
        };
         // Disable shiny button if shiny sprite is same as default (or missing)
         spriteShinyButton.disabled = !sprites.shiny || sprites.shiny === sprites.default;
         // Reset to default view state
         spriteDefaultButton.classList.add('active');
         spriteShinyButton.classList.remove('active');
    };

     const displayTypesAndEffectiveness = (pokemonTypes) => {
        // Display Type Badges
        pokemonTypesDiv.innerHTML = '';
        pokemonTypes.forEach(typeInfo => {
            const badge = document.createElement('span');
            badge.className = `type-badge type-${typeInfo.name}`;
            badge.textContent = typeInfo.name;
            pokemonTypesDiv.appendChild(badge);
        });

        // Calculate Combined Effectiveness
        const effectiveness = {
            double_damage_from: new Set(),
            half_damage_from: new Set(),
            no_damage_from: new Set()
        };

        pokemonTypes.forEach(typeInfo => {
            if (!typeInfo.relations) return; // Skip if type data failed
            typeInfo.relations.double_damage_from.forEach(t => effectiveness.double_damage_from.add(t.name));
            typeInfo.relations.half_damage_from.forEach(t => effectiveness.half_damage_from.add(t.name));
            typeInfo.relations.no_damage_from.forEach(t => effectiveness.no_damage_from.add(t.name));
        });

        // Adjust based on dual types (e.g., half cancels double)
        const finalEffectiveness = { weaknesses: [], resistances: [], immunities: [] };
        effectiveness.double_damage_from.forEach(type => {
            if (!effectiveness.half_damage_from.has(type) && !effectiveness.no_damage_from.has(type)) {
                finalEffectiveness.weaknesses.push(type);
            }
        });
        effectiveness.half_damage_from.forEach(type => {
            if (!effectiveness.double_damage_from.has(type) && !effectiveness.no_damage_from.has(type)) {
                finalEffectiveness.resistances.push(type);
            }
        });
        effectiveness.no_damage_from.forEach(type => {
            finalEffectiveness.immunities.push(type);
        });

         // Display Effectiveness
         typeEffectivenessDiv.innerHTML = ''; // Clear previous
         const createCategory = (title, types) => {
             if (types.length === 0) return;
             const categoryDiv = document.createElement('div');
             categoryDiv.className = 'effectiveness-category';
             categoryDiv.innerHTML = `<h4>${title}</h4>`;
             const typesDiv = document.createElement('div');
             typesDiv.className = 'effectiveness-types';
             types.forEach(typeName => {
                 const badge = document.createElement('span');
                 badge.className = `type-badge type-${typeName}`;
                 badge.textContent = typeName;
                 typesDiv.appendChild(badge);
             });
             categoryDiv.appendChild(typesDiv);
             typeEffectivenessDiv.appendChild(categoryDiv);
         };

         createCategory('Weaknesses (x2)', finalEffectiveness.weaknesses.sort());
         createCategory('Resistances (x0.5)', finalEffectiveness.resistances.sort());
         createCategory('Immunities (x0)', finalEffectiveness.immunities.sort());
     };

     const displayAbilities = (pokemonAbilities, abilityDetailsList) => {
        pokemonAbilitiesUl.innerHTML = '';
        pokemonAbilities.forEach((abilityInfo, index) => {
            const abilityData = abilityDetailsList[index]; // Corresponding fetched details
            if (!abilityData) return; // Skip if fetch failed

            const li = document.createElement('li');
            li.textContent = capitalize(abilityInfo.ability.name.replace('-', ' '));
            if (abilityInfo.is_hidden) {
                li.classList.add('hidden-ability');
            }

             // Add Tooltip for description
             const tooltip = document.createElement('span');
             tooltip.className = 'ability-tooltip';
             const englishDesc = abilityData.effect_entries.find(e => e.language.name === 'en');
             tooltip.textContent = englishDesc ? englishDesc.short_effect : 'No description available.';
             li.appendChild(tooltip);

            pokemonAbilitiesUl.appendChild(li);
        });
    };

     const displayStats = (stats) => {
        pokemonStatsGrid.innerHTML = '';
        stats.forEach(statInfo => {
             const statValue = statInfo.base_stat;
             const statNameRaw = statInfo.stat.name;
             let statNameDisplay = statNameRaw.replace('-', ' ');
              if (statNameRaw === 'special-attack') statNameDisplay = 'Sp. Atk';
              else if (statNameRaw === 'special-defense') statNameDisplay = 'Sp. Def';
              else statNameDisplay = statNameDisplay.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

             const nameElement = document.createElement('div'); nameElement.className = 'stat-name'; nameElement.textContent = statNameDisplay;
             const barContainer = document.createElement('div'); barContainer.className = 'stat-bar-container';
             const barElement = document.createElement('div'); barElement.className = 'stat-bar';
             const percentage = Math.min(100, Math.max(0, (statValue / MAX_STAT_VALUE) * 100));
             barElement.style.width = `0%`; // Start at 0
             setTimeout(() => { barElement.style.width = `${percentage}%`; }, 50); // Animate after render

             barContainer.appendChild(barElement);
             const valueElement = document.createElement('div'); valueElement.className = 'stat-value'; valueElement.textContent = statValue;

             pokemonStatsGrid.appendChild(nameElement);
             pokemonStatsGrid.appendChild(barContainer);
             pokemonStatsGrid.appendChild(valueElement);
        });
    };

     const displayEvolutionChain = (chain) => {
        pokemonEvolutionDiv.innerHTML = ''; // Clear previous
        let currentStage = chain;

        while (currentStage) {
             const stageDiv = document.createElement('div');
             stageDiv.className = 'evolution-stage';

             const speciesName = currentStage.species.name;
             const speciesUrl = currentStage.species.url;
             const speciesId = speciesUrl.split('/').filter(Boolean).pop();

             const img = document.createElement('img');
             // Use direct sprite URL for simplicity in evolution chain
             img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`;
             img.alt = speciesName;
             img.onerror = () => { img.src = 'img/pokeball.png'; }; // Fallback

             const nameSpan = document.createElement('span');
             nameSpan.textContent = capitalize(speciesName);

             stageDiv.appendChild(img);
             stageDiv.appendChild(nameSpan);
             pokemonEvolutionDiv.appendChild(stageDiv);

             // Check for next stage(s)
             if (currentStage.evolves_to.length > 0) {
                 // Display arrow/trigger only if there's a next stage
                const triggerSpan = document.createElement('span');
                triggerSpan.className = 'evolution-trigger';
                triggerSpan.textContent = '➔'; // Simple arrow for now
                // TODO: Could parse evolution_details for more info (level, item etc.)
                pokemonEvolutionDiv.appendChild(triggerSpan);

                // Handle branches later if needed, for now just take the first evolution path
                currentStage = currentStage.evolves_to[0];
             } else {
                currentStage = null; // End of chain
             }
        }
     };


    // --- Event Listeners ---
    const handleCarouselItemClick = (event) => {
        const item = event.currentTarget;
        const url = item.dataset.url;

        // Don't re-fetch if already selected and displayed
        if (url === currentDisplayedPokemonUrl && !pokemonInfoDiv.classList.contains('hidden')) return;

        document.querySelectorAll('.carousel-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        fetchAllDetails(url); // Fetch all data for the selected Pokémon
    };

    generationSelect.addEventListener('change', (e) => {
        currentFilters.generation = e.target.value;
        filterAndDisplayCarousel();
    });

    typeFilter.addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
         // Note: Currently doesn't filter carousel directly, applied on display fetch
         // Or implement more complex carousel filtering if needed.
         // If a Pokemon is displayed, re-fetch/filter might be desired, but could be slow.
         console.log("Type filter changed, affects next selection or requires refresh.");
    });

     favoriteFilter.addEventListener('change', (e) => {
        currentFilters.favorites = e.target.value;
        filterAndDisplayCarousel();
    });

    searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim();
        // Add debounce here if list is huge? For 1000 items, direct filter is likely fine.
        filterAndDisplayCarousel();
    });

     favoriteButton.addEventListener('click', () => {
        if (currentDisplayedPokemonUrl) {
             toggleFavorite(currentDisplayedPokemonUrl);
        }
    });


    // --- Initial Setup Call ---
    const initializePokedex = async () => {
        loadFavorites();
        populateFilterDropdowns(); // Populate static parts
        await fetchAllTypeData(); // Fetch types BEFORE pokemon list
        await fetchAllPokemonBaseData(); // Fetch base pokemon data
        showDisplayState('prompt');
    };

    initializePokedex(); // Start the application

}); // End DOMContentLoaded