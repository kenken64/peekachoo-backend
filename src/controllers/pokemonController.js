const { v4: uuidv4 } = require('uuid');
const { prepare, saveDatabase } = require('../config/sqlite');

const POKEAPI_REST_URL = 'https://pokeapi.co/api/v2';

// Fetch Pokemon list from REST API
async function fetchPokemonList(limit = 50, offset = 0) {
    const response = await fetch(`${POKEAPI_REST_URL}/pokemon?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
        throw new Error(`PokeAPI request failed: ${response.status}`);
    }
    return response.json();
}

// Fetch single Pokemon details
async function fetchPokemonDetails(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`PokeAPI request failed: ${response.status}`);
    }
    return response.json();
}

// Sync Pokemon from API to database
exports.syncPokemon = async (req, res) => {
    try {
        const limit = parseInt(req.body.limit) || parseInt(req.query.limit) || 50;
        const offset = parseInt(req.body.offset) || parseInt(req.query.offset) || 0;

        console.log(`Fetching ${limit} Pokemon from offset ${offset}...`);
        
        // Get list of Pokemon
        const listData = await fetchPokemonList(limit, offset);
        const pokemonList = listData.results;

        let inserted = 0;
        let updated = 0;

        // Fetch details for each Pokemon (with rate limiting)
        for (const item of pokemonList) {
            try {
                const pokemon = await fetchPokemonDetails(item.url);
                
                // Extract sprite URL
                const spriteUrl = pokemon.sprites?.front_default || 
                    pokemon.sprites?.other?.['official-artwork']?.front_default || null;

                // Extract types
                const types = pokemon.types.map(t => t.type.name);

                // Extract abilities
                const abilities = pokemon.abilities.map(a => a.ability.name);

                // Extract stats
                const stats = pokemon.stats.map(s => ({
                    name: s.stat.name,
                    base_stat: s.base_stat
                }));

                // Check if Pokemon exists
                const existing = prepare('SELECT id FROM pokemon WHERE id = ?').get(pokemon.id);

                if (existing) {
                    // Update existing
                    prepare(`
                        UPDATE pokemon SET 
                            name = ?, height = ?, weight = ?, base_experience = ?,
                            sprite_url = ?, types = ?, abilities = ?, stats = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(
                        pokemon.name,
                        pokemon.height,
                        pokemon.weight,
                        pokemon.base_experience,
                        spriteUrl,
                        JSON.stringify(types),
                        JSON.stringify(abilities),
                        JSON.stringify(stats),
                        pokemon.id
                    );
                    updated++;
                } else {
                    // Insert new
                    prepare(`
                        INSERT INTO pokemon (id, name, height, weight, base_experience, sprite_url, types, abilities, stats)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        pokemon.id,
                        pokemon.name,
                        pokemon.height,
                        pokemon.weight,
                        pokemon.base_experience,
                        spriteUrl,
                        JSON.stringify(types),
                        JSON.stringify(abilities),
                        JSON.stringify(stats)
                    );
                    inserted++;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
                console.error(`Error fetching ${item.name}:`, err.message);
            }
        }

        saveDatabase();

        res.json({
            success: true,
            message: `Synced ${inserted + updated} Pokemon`,
            data: { inserted, updated, total: inserted + updated }
        });
    } catch (error) {
        console.error('Pokemon sync error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all Pokemon from database
exports.getAllPokemon = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const pokemon = prepare(`
            SELECT * FROM pokemon 
            ORDER BY id 
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        const countResult = prepare('SELECT COUNT(*) as count FROM pokemon').get();
        const total = countResult?.count || 0;

        // Parse JSON fields and convert to camelCase
        const parsed = pokemon.map(p => ({
            id: p.id,
            name: p.name,
            height: p.height,
            weight: p.weight,
            baseExperience: p.base_experience,
            spriteUrl: p.sprite_url,
            types: JSON.parse(p.types || '[]'),
            abilities: JSON.parse(p.abilities || '[]'),
            stats: JSON.parse(p.stats || '[]')
        }));

        res.json({
            success: true,
            data: parsed,
            pagination: {
                limit,
                offset,
                total
            }
        });
    } catch (error) {
        console.error('Get Pokemon error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Pokemon by ID
exports.getPokemonById = async (req, res) => {
    try {
        const { id } = req.params;
        const pokemon = prepare('SELECT * FROM pokemon WHERE id = ?').get(parseInt(id));

        if (!pokemon) {
            return res.status(404).json({ error: 'Pokemon not found' });
        }

        res.json({
            success: true,
            data: {
                id: pokemon.id,
                name: pokemon.name,
                height: pokemon.height,
                weight: pokemon.weight,
                baseExperience: pokemon.base_experience,
                spriteUrl: pokemon.sprite_url,
                types: JSON.parse(pokemon.types || '[]'),
                abilities: JSON.parse(pokemon.abilities || '[]'),
                stats: JSON.parse(pokemon.stats || '[]')
            }
        });
    } catch (error) {
        console.error('Get Pokemon by ID error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Search Pokemon by name
exports.searchPokemon = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const pokemon = prepare(`
            SELECT * FROM pokemon 
            WHERE name LIKE ? 
            ORDER BY id 
            LIMIT 20
        `).all(`%${q}%`);

        const parsed = pokemon.map(p => ({
            id: p.id,
            name: p.name,
            height: p.height,
            weight: p.weight,
            baseExperience: p.base_experience,
            spriteUrl: p.sprite_url,
            types: JSON.parse(p.types || '[]'),
            abilities: JSON.parse(p.abilities || '[]'),
            stats: JSON.parse(p.stats || '[]')
        }));

        res.json({
            success: true,
            data: parsed,
            count: parsed.length
        });
    } catch (error) {
        console.error('Search Pokemon error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Pokemon by type
exports.getPokemonByType = async (req, res) => {
    try {
        const { type } = req.params;

        const pokemon = prepare(`
            SELECT * FROM pokemon 
            WHERE types LIKE ? 
            ORDER BY id
        `).all(`%"${type}"%`);

        const parsed = pokemon.map(p => ({
            id: p.id,
            name: p.name,
            height: p.height,
            weight: p.weight,
            baseExperience: p.base_experience,
            spriteUrl: p.sprite_url,
            types: JSON.parse(p.types || '[]'),
            abilities: JSON.parse(p.abilities || '[]'),
            stats: JSON.parse(p.stats || '[]')
        }));

        res.json({
            success: true,
            data: parsed,
            count: parsed.length
        });
    } catch (error) {
        console.error('Get Pokemon by type error:', error);
        res.status(500).json({ error: error.message });
    }
};
