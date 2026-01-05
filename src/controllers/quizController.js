const axios = require('axios');
const { prepare } = require('../config/sqlite');

/**
 * Generate a quiz question for a Pokemon using OpenAI Vision API
 */
exports.generateQuiz = async (req, res) => {
    try {
        const { pokemonName, spriteUrl, allPokemonNames, lang } = req.body;
        const isJP = lang === 'jp';
        const isCN = lang === 'cn';

        if (!pokemonName || !spriteUrl) {
            return res.status(400).json({
                error: 'Pokemon name and sprite URL are required'
            });
        }

        const cleanPokemonName = pokemonName.trim();
        console.log(`[Quiz] Generating for: ${cleanPokemonName}, Lang: ${lang}`);

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return res.status(500).json({
                error: 'OpenAI API key not configured'
            });
        }

        // If JP or CN, we need to find the localized name for the correct answer.
        let targetName = cleanPokemonName;
        if (isJP) {
            try {
                const dbResult = prepare('SELECT name_jp FROM pokemon WHERE LOWER(name) = ?').get(cleanPokemonName.toLowerCase());
                if (dbResult && dbResult.name_jp) {
                    targetName = dbResult.name_jp;
                } else {
                    // Fallback: Try to fetch from PokeAPI if not in DB
                    const apiName = await fetchPokemonNameFromApi(cleanPokemonName, 'ja');
                    if (apiName) targetName = apiName;
                }
            } catch (e) {
                console.warn('Failed to lookup JP name for quiz:', e);
            }
        } else if (isCN) {
            try {
                const dbResult = prepare('SELECT name_cn FROM pokemon WHERE LOWER(name) = ?').get(cleanPokemonName.toLowerCase());
                if (dbResult && dbResult.name_cn) {
                    targetName = dbResult.name_cn;
                    console.log(`[Quiz] Found CN name in DB: ${targetName}`);
                } else {
                    console.log(`[Quiz] CN name not in DB for ${cleanPokemonName}, trying API...`);
                    // Fallback: Try to fetch from PokeAPI if not in DB
                    // Try Simplified Chinese first, then Traditional
                    let apiName = await fetchPokemonNameFromApi(cleanPokemonName, 'zh-Hans');
                    if (!apiName) {
                        apiName = await fetchPokemonNameFromApi(cleanPokemonName, 'zh-Hant');
                    }
                    
                    if (apiName) {
                        targetName = apiName;
                        console.log(`[Quiz] Found CN name in API: ${targetName}`);
                    } else {
                        console.warn(`[Quiz] Failed to find CN name for ${cleanPokemonName}`);
                    }
                }
            } catch (e) {
                console.warn('Failed to lookup CN name for quiz:', e);
            }
        }

        // Generate 3 wrong answers, fetching from database if needed
        const wrongAnswers = generateWrongAnswers(cleanPokemonName, allPokemonNames || [], isJP, isCN);

        // Create multiple choice options (mix correct and wrong answers)
        const allChoices = [targetName, ...wrongAnswers];
        const shuffledChoices = shuffleArray(allChoices);

        // Use OpenAI Vision API to verify the Pokemon (optional enhancement)
        // For now, we'll use a simpler approach without calling OpenAI for every quiz
        // to save on API costs. You can uncomment below to use vision API.

        /*
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'What Pokemon is shown in this image? Answer with just the Pokemon name.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: spriteUrl
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 50
            },
            {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiAnswer = response.data.choices[0].message.content.trim().toLowerCase();
        console.log('AI identified Pokemon as:', aiAnswer);
        */

        let questionText = 'What is the name of this Pokemon?';
        if (isJP) {
            questionText = 'このポケモンの名前は？';
        } else if (isCN) {
            questionText = '这只宝可梦的名字是？';
        }

        res.json({
            question: questionText,
            choices: shuffledChoices,
            correctAnswer: targetName,
            spriteUrl: spriteUrl
        });

    } catch (error) {
        console.error('Quiz generation error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to generate quiz',
            details: error.message
        });
    }
};

/**
 * Helper to fetch localized name from PokeAPI
 */
async function fetchPokemonNameFromApi(pokemonName, langCode) {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName.toLowerCase()}`);
        const nameObj = response.data.names.find(n => n.language.name === langCode);
        return nameObj ? nameObj.name : null;
    } catch (error) {
        console.warn(`Failed to fetch ${langCode} name for ${pokemonName} from API:`, error.message);
        return null;
    }
}

/**
 * Generate wrong answer choices
 * Fetches from database if not enough Pokemon names provided
 */
function generateWrongAnswers(correctAnswer, allNames, isJP = false, isCN = false) {
    // Filter out the correct answer from provided names
    let availableNames = allNames.filter(
        name => name.toLowerCase() !== correctAnswer.toLowerCase()
    );

    if (isJP) {
        try {
             const excludeNames = [correctAnswer.toLowerCase(), ...availableNames.map(n => n.toLowerCase())];
             const placeholders = excludeNames.map(() => '?').join(',');
             
             const dbPokemon = prepare(`
                SELECT name_jp FROM pokemon
                WHERE LOWER(name) NOT IN (${placeholders})
                AND name_jp IS NOT NULL
                ORDER BY RANDOM()
                LIMIT 3
            `).all(...excludeNames);
            
            return dbPokemon.map(p => p.name_jp);
        } catch (e) {
            console.error('JP Quiz generation error', e);
            return ['ピカチュウ', 'ヒトカゲ', 'ゼニガメ']; // Fallback
        }
    }

    if (isCN) {
        try {
             const excludeNames = [correctAnswer.toLowerCase(), ...availableNames.map(n => n.toLowerCase())];
             const placeholders = excludeNames.map(() => '?').join(',');
             
             const dbPokemon = prepare(`
                SELECT name_cn FROM pokemon
                WHERE LOWER(name) NOT IN (${placeholders})
                AND name_cn IS NOT NULL
                ORDER BY RANDOM()
                LIMIT 3
            `).all(...excludeNames);
            
            if (dbPokemon.length < 3) {
                console.warn('Not enough CN names found in DB, using fallback');
                return ['皮卡丘', '小火龙', '杰尼龟']; 
            }

            return dbPokemon.map(p => p.name_cn);
        } catch (e) {
            console.error('CN Quiz generation error', e);
            return ['皮卡丘', '小火龙', '杰尼龟']; // Fallback
        }
    }

    // If we don't have enough names (need at least 3 wrong answers), fetch from database
    if (availableNames.length < 3) {
        try {
            // Get random Pokemon from database, excluding the correct answer and already available names
            const excludeNames = [correctAnswer.toLowerCase(), ...availableNames.map(n => n.toLowerCase())];
            const placeholders = excludeNames.map(() => '?').join(',');

            const dbPokemon = prepare(`
                SELECT name FROM pokemon
                WHERE LOWER(name) NOT IN (${placeholders})
                ORDER BY RANDOM()
                LIMIT ?
            `).all(...excludeNames, 3 - availableNames.length);

            // Add database Pokemon names to available names
            const dbNames = dbPokemon.map(p => p.name);
            availableNames = [...availableNames, ...dbNames];

            console.log('[Quiz] Fetched additional Pokemon from DB:', dbNames);
        } catch (dbError) {
            console.error('[Quiz] Failed to fetch Pokemon from database:', dbError.message);

            // Fallback to hardcoded list if database fails
            const fallbackPokemon = [
                'pikachu', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo',
                'eevee', 'snorlax', 'dragonite', 'gengar', 'lucario',
                'alakazam', 'gyarados', 'lapras', 'arcanine', 'machamp'
            ];

            const fallbackFiltered = fallbackPokemon.filter(
                name => name.toLowerCase() !== correctAnswer.toLowerCase() &&
                       !availableNames.some(n => n.toLowerCase() === name.toLowerCase())
            );

            availableNames = [...availableNames, ...shuffleArray(fallbackFiltered).slice(0, 3 - availableNames.length)];
        }
    }

    // Shuffle and pick 3
    const shuffled = shuffleArray(availableNames);
    return shuffled.slice(0, 3);
}

/**
 * Shuffle array
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
