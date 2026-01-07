const { prepare, saveDatabase } = require("../config/sqlite");

const POKEAPI_REST_URL = "https://pokeapi.co/api/v2";

// Fetch Pokemon list from REST API
async function fetchPokemonList(limit = 50, offset = 0) {
	const response = await fetch(
		`${POKEAPI_REST_URL}/pokemon?limit=${limit}&offset=${offset}`,
	);
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
		// Check if user wants to sync all Pokemon
		const syncAll = req.body.syncAll || req.query.syncAll === "true";

		const limit =
			parseInt(req.body.limit, 10) || parseInt(req.query.limit, 10) || 50;
		const offset =
			parseInt(req.body.offset, 10) || parseInt(req.query.offset, 10) || 0;

		let totalInserted = 0;
		let totalUpdated = 0;
		let totalCount = 0;

		if (syncAll) {
			// First, fetch to get the total count
			console.log("Fetching total Pokemon count...");
			const initialData = await fetchPokemonList(1, 0);
			totalCount = initialData.count;
			console.log(`Total Pokemon available: ${totalCount}`);
			console.log("Starting full sync...");

			// Sync in batches of 100
			const batchSize = 100;
			for (
				let currentOffset = 0;
				currentOffset < totalCount;
				currentOffset += batchSize
			) {
				const currentLimit = Math.min(batchSize, totalCount - currentOffset);
				console.log(
					`Syncing batch: ${currentOffset + 1}-${currentOffset + currentLimit} of ${totalCount}...`,
				);

				const listData = await fetchPokemonList(currentLimit, currentOffset);
				const pokemonList = listData.results;

				// Fetch details for each Pokemon in this batch
				for (const item of pokemonList) {
					try {
						const pokemon = await fetchPokemonDetails(item.url);

						// Fetch species data to get Japanese and Chinese names
						let nameJp = null;
						let nameCn = null;
						if (pokemon.species?.url) {
							try {
								const species = await fetchPokemonDetails(pokemon.species.url);
								const jpNameObj = species.names.find(
									(n) => n.language.name === "ja",
								);
								nameJp = jpNameObj ? jpNameObj.name : null;

								const cnNameObj = species.names.find(
									(n) => n.language.name === "zh-Hans",
								);
								nameCn = cnNameObj ? cnNameObj.name : null;
							} catch (err) {
								console.warn(
									`Failed to fetch species for ${pokemon.name}:`,
									err.message,
								);
							}
						}

						// Extract sprite URL
						const spriteUrl =
							pokemon.sprites?.front_default ||
							pokemon.sprites?.other?.["official-artwork"]?.front_default ||
							null;

						// Extract types
						const types = pokemon.types.map((t) => t.type.name);

						// Extract abilities
						const abilities = pokemon.abilities.map((a) => a.ability.name);

						// Extract stats
						const stats = pokemon.stats.map((s) => ({
							name: s.stat.name,
							base_stat: s.base_stat,
						}));

						// Check if Pokemon exists
						const existing = prepare("SELECT id FROM pokemon WHERE id = ?").get(
							pokemon.id,
						);

						if (existing) {
							// Update existing
							prepare(`
                                UPDATE pokemon SET
                                    name = ?, name_jp = ?, name_cn = ?, height = ?, weight = ?, base_experience = ?,
                                    sprite_url = ?, types = ?, abilities = ?, stats = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `).run(
								pokemon.name,
								nameJp,
								nameCn,
								pokemon.height,
								pokemon.weight,
								pokemon.base_experience,
								spriteUrl,
								JSON.stringify(types),
								JSON.stringify(abilities),
								JSON.stringify(stats),
								pokemon.id,
							);
							totalUpdated++;
						} else {
							// Insert new
							prepare(`
                                INSERT INTO pokemon (id, name, name_jp, name_cn, height, weight, base_experience, sprite_url, types, abilities, stats)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
								pokemon.id,
								pokemon.name,
								nameJp,
								nameCn,
								pokemon.height,
								pokemon.weight,
								pokemon.base_experience,
								spriteUrl,
								JSON.stringify(types),
								JSON.stringify(abilities),
								JSON.stringify(stats),
							);
							totalInserted++;
						}

						// Small delay to avoid rate limiting
						await new Promise((resolve) => setTimeout(resolve, 50));
					} catch (err) {
						console.error(`Error fetching ${item.name}:`, err.message);
					}
				}

				// Save after each batch
				saveDatabase();
				console.log(
					`Batch complete. Progress: ${totalInserted + totalUpdated}/${totalCount}`,
				);
			}

			console.log("Full sync complete!");
			res.json({
				success: true,
				message: `Successfully synced all ${totalInserted + totalUpdated} Pokemon`,
				data: {
					inserted: totalInserted,
					updated: totalUpdated,
					total: totalInserted + totalUpdated,
					totalAvailable: totalCount,
				},
			});
		} else {
			// Original single-batch sync
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

					// Fetch species data to get Japanese name
					let nameJp = null;
					if (pokemon.species?.url) {
						try {
							const species = await fetchPokemonDetails(pokemon.species.url);
							const jpNameObj = species.names.find(
								(n) => n.language.name === "ja",
							);
							nameJp = jpNameObj ? jpNameObj.name : null;
						} catch (err) {
							console.warn(
								`Failed to fetch species for ${pokemon.name}:`,
								err.message,
							);
						}
					}

					// Extract sprite URL
					const spriteUrl =
						pokemon.sprites?.front_default ||
						pokemon.sprites?.other?.["official-artwork"]?.front_default ||
						null;

					// Extract types
					const types = pokemon.types.map((t) => t.type.name);

					// Extract abilities
					const abilities = pokemon.abilities.map((a) => a.ability.name);

					// Extract stats
					const stats = pokemon.stats.map((s) => ({
						name: s.stat.name,
						base_stat: s.base_stat,
					}));

					// Check if Pokemon exists
					const existing = prepare("SELECT id FROM pokemon WHERE id = ?").get(
						pokemon.id,
					);

					if (existing) {
						// Update existing
						prepare(`
                            UPDATE pokemon SET
                                name = ?, name_jp = ?, height = ?, weight = ?, base_experience = ?,
                                sprite_url = ?, types = ?, abilities = ?, stats = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(
							pokemon.name,
							nameJp,
							pokemon.height,
							pokemon.weight,
							pokemon.base_experience,
							spriteUrl,
							JSON.stringify(types),
							JSON.stringify(abilities),
							JSON.stringify(stats),
							pokemon.id,
						);
						updated++;
					} else {
						// Insert new
						prepare(`
                            INSERT INTO pokemon (id, name, name_jp, height, weight, base_experience, sprite_url, types, abilities, stats)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(
							pokemon.id,
							pokemon.name,
							nameJp,
							pokemon.height,
							pokemon.weight,
							pokemon.base_experience,
							spriteUrl,
							JSON.stringify(types),
							JSON.stringify(abilities),
							JSON.stringify(stats),
						);
						inserted++;
					}

					// Small delay to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, 50));
				} catch (err) {
					console.error(`Error fetching ${item.name}:`, err.message);
				}
			}

			saveDatabase();

			res.json({
				success: true,
				message: `Synced ${inserted + updated} Pokemon`,
				data: { inserted, updated, total: inserted + updated },
			});
		}
	} catch (error) {
		console.error("Pokemon sync error:", error);
		res.status(500).json({ error: error.message });
	}
};

// Get all Pokemon from database
exports.getAllPokemon = async (req, res) => {
	try {
		const limit = parseInt(req.query.limit, 10) || 50;
		const offset = parseInt(req.query.offset, 10) || 0;

		const pokemon = prepare(`
            SELECT * FROM pokemon 
            ORDER BY id 
            LIMIT ? OFFSET ?
        `).all(limit, offset);

		const countResult = prepare("SELECT COUNT(*) as count FROM pokemon").get();
		const total = countResult?.count || 0;

		// Parse JSON fields and convert to camelCase
		const parsed = pokemon.map((p) => ({
			id: p.id,
			name: p.name,
			nameJp: p.name_jp,
			nameCn: p.name_cn,
			height: p.height,
			weight: p.weight,
			baseExperience: p.base_experience,
			spriteUrl: p.sprite_url,
			types: JSON.parse(p.types || "[]"),
			abilities: JSON.parse(p.abilities || "[]"),
			stats: JSON.parse(p.stats || "[]"),
		}));

		res.json({
			success: true,
			data: parsed,
			pagination: {
				limit,
				offset,
				total,
			},
		});
	} catch (error) {
		console.error("Get Pokemon error:", error);
		res.status(500).json({ error: error.message });
	}
};

// Get Pokemon by ID
exports.getPokemonById = async (req, res) => {
	try {
		const { id } = req.params;
		const pokemon = prepare("SELECT * FROM pokemon WHERE id = ?").get(
			parseInt(id, 10),
		);

		if (!pokemon) {
			return res.status(404).json({ error: "Pokemon not found" });
		}

		res.json({
			success: true,
			data: {
				id: pokemon.id,
				name: pokemon.name,
				nameJp: pokemon.name_jp,
				nameCn: pokemon.name_cn,
				height: pokemon.height,
				weight: pokemon.weight,
				baseExperience: pokemon.base_experience,
				spriteUrl: pokemon.sprite_url,
				types: JSON.parse(pokemon.types || "[]"),
				abilities: JSON.parse(pokemon.abilities || "[]"),
				stats: JSON.parse(pokemon.stats || "[]"),
			},
		});
	} catch (error) {
		console.error("Get Pokemon by ID error:", error);
		res.status(500).json({ error: error.message });
	}
};

// Search Pokemon by name
exports.searchPokemon = async (req, res) => {
	try {
		const { q } = req.query;

		if (!q) {
			return res.status(400).json({ error: "Search query is required" });
		}

		const pokemon = prepare(`
            SELECT * FROM pokemon 
            WHERE name LIKE ? OR name_jp LIKE ? OR name_cn LIKE ?
            ORDER BY id 
            LIMIT 20
        `).all(`%${q}%`, `%${q}%`, `%${q}%`);

		const parsed = pokemon.map((p) => ({
			id: p.id,
			name: p.name,
			nameJp: p.name_jp,
			nameCn: p.name_cn,
			height: p.height,
			weight: p.weight,
			baseExperience: p.base_experience,
			spriteUrl: p.sprite_url,
			types: JSON.parse(p.types || "[]"),
			abilities: JSON.parse(p.abilities || "[]"),
			stats: JSON.parse(p.stats || "[]"),
		}));

		res.json({
			success: true,
			data: parsed,
			count: parsed.length,
		});
	} catch (error) {
		console.error("Search Pokemon error:", error);
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

		const parsed = pokemon.map((p) => ({
			id: p.id,
			name: p.name,
			nameJp: p.name_jp,
			nameCn: p.name_cn,
			height: p.height,
			weight: p.weight,
			baseExperience: p.base_experience,
			spriteUrl: p.sprite_url,
			types: JSON.parse(p.types || "[]"),
			abilities: JSON.parse(p.abilities || "[]"),
			stats: JSON.parse(p.stats || "[]"),
		}));

		res.json({
			success: true,
			data: parsed,
			count: parsed.length,
		});
	} catch (error) {
		console.error("Get Pokemon by type error:", error);
		res.status(500).json({ error: error.message });
	}
};

// Get a random unrevealed Pokemon for endless mode
exports.getRandomUnrevealed = async (req, res) => {
	try {
		const userId = req.user.id;

		// Get all Pokemon IDs that the user has already revealed
		const revealedPokemon = prepare(`
            SELECT pokemon_id FROM player_pokemon_collection WHERE user_id = ?
        `).all(userId);

		const revealedIds = revealedPokemon.map((p) => p.pokemon_id);

		// Get total Pokemon count
		const totalCount = prepare(`SELECT COUNT(*) as count FROM pokemon`).get();

		if (!totalCount || totalCount.count === 0) {
			return res.status(404).json({
				success: false,
				error: "No Pokemon available. Please sync Pokemon first.",
				code: "NO_POKEMON",
			});
		}

		let pokemon;

		if (revealedIds.length >= totalCount.count) {
			// User has revealed all Pokemon - pick any random one
			pokemon = prepare(`
                SELECT * FROM pokemon 
                ORDER BY RANDOM() 
                LIMIT 1
            `).get();
		} else {
			// Pick a random unrevealed Pokemon
			const placeholders =
				revealedIds.length > 0
					? `AND id NOT IN (${revealedIds.map(() => "?").join(",")})`
					: "";

			const query = `
                SELECT * FROM pokemon 
                WHERE sprite_url IS NOT NULL ${placeholders}
                ORDER BY RANDOM() 
                LIMIT 1
            `;

			pokemon =
				revealedIds.length > 0
					? prepare(query).get(...revealedIds)
					: prepare(query).get();
		}

		if (!pokemon) {
			return res.status(404).json({
				success: false,
				error: "No Pokemon found",
				code: "NO_POKEMON",
			});
		}

		res.json({
			success: true,
			data: {
				id: pokemon.id,
				name: pokemon.name,
				name_jp: pokemon.name_jp,
				spriteUrl: pokemon.sprite_url,
				types: JSON.parse(pokemon.types || "[]"),
				isNew: !revealedIds.includes(pokemon.id),
				revealedCount: revealedIds.length,
				totalCount: totalCount.count,
			},
		});
	} catch (error) {
		console.error("Get random unrevealed Pokemon error:", error);
		res.status(500).json({ error: error.message });
	}
};
