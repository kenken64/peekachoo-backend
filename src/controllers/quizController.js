const axios = require('axios');
const { prepare } = require('../config/sqlite');

/**
 * Generate a quiz question for a Pokemon using OpenAI Vision API
 */
exports.generateQuiz = async (req, res) => {
    try {
        const { pokemonName, spriteUrl, allPokemonNames } = req.body;

        if (!pokemonName || !spriteUrl) {
            return res.status(400).json({
                error: 'Pokemon name and sprite URL are required'
            });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return res.status(500).json({
                error: 'OpenAI API key not configured'
            });
        }

        // Generate 3 wrong answers, fetching from database if needed
        const wrongAnswers = generateWrongAnswers(pokemonName, allPokemonNames || []);

        // Create multiple choice options (mix correct and wrong answers)
        const allChoices = [pokemonName, ...wrongAnswers];
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

        res.json({
            question: 'What is the name of this Pokemon?',
            choices: shuffledChoices,
            correctAnswer: pokemonName,
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
 * Generate wrong answer choices
 * Fetches from database if not enough Pokemon names provided
 */
function generateWrongAnswers(correctAnswer, allNames) {
    // Filter out the correct answer from provided names
    let availableNames = allNames.filter(
        name => name.toLowerCase() !== correctAnswer.toLowerCase()
    );

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
