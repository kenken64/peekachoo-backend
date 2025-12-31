const axios = require('axios');

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

        // Generate 3 wrong answers from the provided list or common Pokemon names
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
 */
function generateWrongAnswers(correctAnswer, allNames) {
    const commonPokemon = [
        'pikachu', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo',
        'eevee', 'snorlax', 'dragonite', 'gengar', 'lucario',
        'garchomp', 'alakazam', 'gyarados', 'lapras', 'arcanine',
        'machamp', 'golem', 'rapidash', 'meowth', 'psyduck',
        'jigglypuff', 'wigglytuff', 'venusaur', 'blastoise', 'butterfree'
    ];

    // Use provided names or common Pokemon
    const namePool = allNames.length > 0 ? allNames : commonPokemon;

    // Filter out the correct answer
    const availableNames = namePool.filter(
        name => name.toLowerCase() !== correctAnswer.toLowerCase()
    );

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
