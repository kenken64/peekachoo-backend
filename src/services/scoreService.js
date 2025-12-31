const { v4: uuidv4 } = require('uuid');
const { prepare, saveDatabase } = require('../config/sqlite');

/**
 * Score Calculation Service
 * Handles score calculation, submission, stats updates, and achievement checking
 */

// Score calculation constants
const SCORE_CONFIG = {
    TERRITORY_MULTIPLIER: 10,        // Points per coverage percentage
    TIME_BONUS_BASE: 120,            // Seconds to beat for max bonus
    TIME_BONUS_MULTIPLIER: 5,        // Points per second under base
    LIFE_BONUS: 200,                 // Points per remaining life
    QUIZ_BONUS_FIRST_TRY: 500,       // Bonus for first try
    QUIZ_BONUS_SECOND_TRY: 200,      // Bonus for second try
    LEVEL_MULTIPLIER_BASE: 1,        // Base multiplier
    LEVEL_MULTIPLIER_INCREMENT: 0.2, // Multiplier increase per level
    STREAK_BONUSES: {
        3: 500,
        5: 1000,
        10: 2500,
        15: 4000,
        20: 6000,
    },
};

/**
 * Calculate score breakdown for a level completion
 */
function calculateScoreBreakdown(data) {
    const {
        level,
        territoryPercentage,
        timeTakenSeconds,
        livesRemaining,
        quizAttempts,
        currentStreak,
    } = data;

    // Territory score: coverage% * 10
    const territoryScore = Math.round(territoryPercentage * 100 * SCORE_CONFIG.TERRITORY_MULTIPLIER);

    // Time bonus: faster = more points
    const timeBonus = Math.max(0, Math.round((SCORE_CONFIG.TIME_BONUS_BASE - timeTakenSeconds) * SCORE_CONFIG.TIME_BONUS_MULTIPLIER));

    // Life bonus: points per remaining life
    const lifeBonus = livesRemaining * SCORE_CONFIG.LIFE_BONUS;

    // Quiz bonus: based on attempts
    let quizBonus = 0;
    if (quizAttempts === 1) {
        quizBonus = SCORE_CONFIG.QUIZ_BONUS_FIRST_TRY;
    } else if (quizAttempts === 2) {
        quizBonus = SCORE_CONFIG.QUIZ_BONUS_SECOND_TRY;
    }

    // Level multiplier
    const levelMultiplier = SCORE_CONFIG.LEVEL_MULTIPLIER_BASE + (level * SCORE_CONFIG.LEVEL_MULTIPLIER_INCREMENT);

    // Subtotal before multiplier
    const subtotal = territoryScore + timeBonus + lifeBonus + quizBonus;

    // Level score after multiplier
    const levelScore = Math.round(subtotal * levelMultiplier);

    // Streak bonus
    let streakBonus = 0;
    const streakThresholds = Object.keys(SCORE_CONFIG.STREAK_BONUSES)
        .map(Number)
        .sort((a, b) => b - a);

    for (const threshold of streakThresholds) {
        if (currentStreak >= threshold) {
            streakBonus = SCORE_CONFIG.STREAK_BONUSES[threshold];
            break;
        }
    }

    // Total score
    const totalScore = levelScore + streakBonus;

    return {
        territoryScore,
        timeBonus,
        lifeBonus,
        quizBonus,
        subtotal,
        levelMultiplier,
        levelScore,
        streakBonus,
        totalScore,
    };
}

/**
 * Submit a score and update all related stats
 */
async function submitScore(userId, scoreData) {
    const {
        gameId,
        sessionId,
        level,
        territoryPercentage,
        timeTakenSeconds,
        livesRemaining,
        quizAttempts,
        pokemonId,
        pokemonName,
    } = scoreData;

    // Get or create player stats
    let playerStats = prepare(`SELECT * FROM player_stats WHERE user_id = ?`).get(userId);

    if (!playerStats) {
        // Initialize player stats
        prepare(`
            INSERT INTO player_stats (user_id, first_played_at, last_played_at)
            VALUES (?, datetime('now'), datetime('now'))
        `).run(userId);
        playerStats = prepare(`SELECT * FROM player_stats WHERE user_id = ?`).get(userId);
    }

    // Calculate current streak (check if player died - lives < 3 means died at some point)
    // If livesRemaining is 3, streak continues; otherwise it was reset during gameplay
    const currentStreak = livesRemaining === 3 ? (playerStats.current_streak || 0) + 1 : 1;

    // Calculate score breakdown
    const breakdown = calculateScoreBreakdown({
        level,
        territoryPercentage,
        timeTakenSeconds,
        livesRemaining,
        quizAttempts,
        currentStreak,
    });

    // Get previous rank
    const previousRank = await getPlayerRank(userId);

    // Insert score record
    const scoreId = uuidv4();
    prepare(`
        INSERT INTO player_scores (
            id, user_id, game_id, session_id, level,
            territory_score, time_bonus, life_bonus, quiz_bonus, streak_bonus,
            level_multiplier, total_score,
            territory_percentage, time_taken_seconds, lives_remaining, quiz_attempts,
            pokemon_id, pokemon_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        scoreId, userId, gameId, sessionId, level,
        breakdown.territoryScore, breakdown.timeBonus, breakdown.lifeBonus,
        breakdown.quizBonus, breakdown.streakBonus, breakdown.levelMultiplier,
        breakdown.totalScore, territoryPercentage, timeTakenSeconds,
        livesRemaining, quizAttempts, pokemonId, pokemonName
    );

    // Update player stats
    const newTotalScore = (playerStats.total_score_all_time || 0) + breakdown.totalScore;
    const newTotalLevels = (playerStats.total_levels_completed || 0) + 1;
    const newHighestLevel = Math.max(playerStats.highest_level_reached || 0, level);
    const newBestStreak = Math.max(playerStats.best_streak || 0, currentStreak);
    const newBestCoverage = Math.max(playerStats.best_coverage || 0, territoryPercentage);
    const newFastestLevel = Math.min(playerStats.fastest_level_seconds || 999999, timeTakenSeconds);
    const newQuizCorrect = (playerStats.quiz_correct_total || 0) + (quizAttempts === 1 ? 1 : 0);
    const newQuizAttempts = (playerStats.quiz_attempts_total || 0) + quizAttempts;

    // Calculate new average coverage
    const totalCoverage = (playerStats.average_coverage || 0) * (newTotalLevels - 1) + territoryPercentage;
    const newAverageCoverage = totalCoverage / newTotalLevels;

    // Estimate territory claimed (assuming 800x600 play area)
    const playAreaPixels = 800 * 600;
    const territoryClaimed = Math.round(playAreaPixels * territoryPercentage);
    const newTotalTerritory = (playerStats.total_territory_claimed || 0) + territoryClaimed;

    prepare(`
        UPDATE player_stats SET
            highest_level_reached = ?,
            total_levels_completed = ?,
            total_score_all_time = ?,
            total_territory_claimed = ?,
            average_coverage = ?,
            best_coverage = ?,
            fastest_level_seconds = ?,
            current_streak = ?,
            best_streak = ?,
            quiz_correct_total = ?,
            quiz_attempts_total = ?,
            last_played_at = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ?
    `).run(
        newHighestLevel, newTotalLevels, newTotalScore,
        newTotalTerritory, newAverageCoverage, newBestCoverage,
        newFastestLevel, currentStreak, newBestStreak,
        newQuizCorrect, newQuizAttempts, userId
    );

    // Update session
    updateGameSession(sessionId, userId, gameId, breakdown.totalScore, level, currentStreak);

    // Track Pokemon collection
    const isNewPokemon = await trackPokemonCollection(userId, pokemonId, territoryPercentage, timeTakenSeconds);

    // Get new rank
    const newRank = await getPlayerRank(userId);

    // Check for new achievements
    const unlockedAchievements = await checkAchievements(userId, {
        highestLevel: newHighestLevel,
        totalLevels: newTotalLevels,
        totalScore: newTotalScore,
        bestCoverage: newBestCoverage * 100,
        fastestLevel: newFastestLevel,
        bestStreak: newBestStreak,
        quizCorrect: newQuizCorrect,
        totalTerritory: newTotalTerritory,
        uniquePokemon: playerStats.unique_pokemon_revealed || 0,
    });

    // Get session summary
    const session = prepare(`SELECT * FROM game_sessions WHERE id = ?`).get(sessionId);

    return {
        scoreId,
        breakdown,
        session: {
            sessionScore: session?.total_score || breakdown.totalScore,
            levelsCompleted: session?.levels_completed || 1,
            currentStreak,
        },
        rankings: {
            globalRank: newRank,
            previousRank,
            rankChange: previousRank - newRank,
            isNewPersonalBest: breakdown.totalScore > (playerStats.best_single_game_score || 0),
            isNewLevelBest: level > (playerStats.highest_level_reached || 0),
        },
        achievements: {
            unlocked: unlockedAchievements,
        },
        pokemon: {
            pokemonId,
            pokemonName,
            isNewReveal: isNewPokemon,
            collectionCount: (playerStats.unique_pokemon_revealed || 0) + (isNewPokemon ? 1 : 0),
            collectionTotal: 151,
        },
    };
}

/**
 * Get player's global rank
 */
async function getPlayerRank(userId) {
    const result = prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM player_stats
        WHERE total_score_all_time > (
            SELECT COALESCE(total_score_all_time, 0)
            FROM player_stats
            WHERE user_id = ?
        )
    `).get(userId);

    return result?.rank || 1;
}

/**
 * Update or create game session
 */
function updateGameSession(sessionId, userId, gameId, score, level, streak) {
    let session = prepare(`SELECT * FROM game_sessions WHERE id = ?`).get(sessionId);

    if (!session) {
        prepare(`
            INSERT INTO game_sessions (id, user_id, game_id, total_score, levels_completed, highest_level, max_streak)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        `).run(sessionId, userId, gameId, score, level, streak);
    } else {
        prepare(`
            UPDATE game_sessions SET
                total_score = total_score + ?,
                levels_completed = levels_completed + 1,
                highest_level = MAX(highest_level, ?),
                max_streak = MAX(max_streak, ?)
            WHERE id = ?
        `).run(score, level, streak, sessionId);
    }
}

/**
 * Track Pokemon collection
 */
async function trackPokemonCollection(userId, pokemonId, coverage, timeSeconds) {
    if (!pokemonId) return false;

    const existing = prepare(`
        SELECT * FROM player_pokemon_collection
        WHERE user_id = ? AND pokemon_id = ?
    `).get(userId, pokemonId);

    if (existing) {
        // Update existing record
        prepare(`
            UPDATE player_pokemon_collection SET
                times_revealed = times_revealed + 1,
                best_coverage = MAX(best_coverage, ?),
                fastest_reveal_seconds = MIN(COALESCE(fastest_reveal_seconds, 999999), ?)
            WHERE user_id = ? AND pokemon_id = ?
        `).run(coverage, timeSeconds, userId, pokemonId);
        return false;
    } else {
        // New Pokemon!
        prepare(`
            INSERT INTO player_pokemon_collection (user_id, pokemon_id, best_coverage, fastest_reveal_seconds)
            VALUES (?, ?, ?, ?)
        `).run(userId, pokemonId, coverage, timeSeconds);

        // Update unique count in player_stats
        prepare(`
            UPDATE player_stats SET
                unique_pokemon_revealed = unique_pokemon_revealed + 1
            WHERE user_id = ?
        `).run(userId);

        return true;
    }
}

/**
 * Check and unlock achievements
 */
async function checkAchievements(userId, stats) {
    const achievements = prepare(`SELECT * FROM achievements`).all();
    const playerAchievements = prepare(`
        SELECT achievement_id FROM player_achievements WHERE user_id = ? AND unlocked_at IS NOT NULL
    `).all(userId);

    const unlockedIds = new Set(playerAchievements.map(a => a.achievement_id));
    const newlyUnlocked = [];

    for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;

        let shouldUnlock = false;
        let progress = 0;

        switch (achievement.requirement_type) {
            case 'highest_level':
                progress = stats.highestLevel;
                shouldUnlock = stats.highestLevel >= achievement.requirement_value;
                break;
            case 'levels_completed':
                progress = stats.totalLevels;
                shouldUnlock = stats.totalLevels >= achievement.requirement_value;
                break;
            case 'total_score':
                progress = stats.totalScore;
                shouldUnlock = stats.totalScore >= achievement.requirement_value;
                break;
            case 'best_coverage':
                progress = stats.bestCoverage;
                shouldUnlock = stats.bestCoverage >= achievement.requirement_value;
                break;
            case 'fastest_level':
                progress = stats.fastestLevel;
                shouldUnlock = stats.fastestLevel <= achievement.requirement_value;
                break;
            case 'best_streak':
                progress = stats.bestStreak;
                shouldUnlock = stats.bestStreak >= achievement.requirement_value;
                break;
            case 'quiz_correct':
                progress = stats.quizCorrect;
                shouldUnlock = stats.quizCorrect >= achievement.requirement_value;
                break;
            case 'total_territory':
                progress = stats.totalTerritory;
                shouldUnlock = stats.totalTerritory >= achievement.requirement_value;
                break;
            case 'unique_pokemon':
                progress = stats.uniquePokemon;
                shouldUnlock = stats.uniquePokemon >= achievement.requirement_value;
                break;
        }

        // Update progress
        const existingProgress = prepare(`
            SELECT id FROM player_achievements WHERE user_id = ? AND achievement_id = ?
        `).get(userId, achievement.id);

        if (existingProgress) {
            if (shouldUnlock) {
                prepare(`
                    UPDATE player_achievements SET progress = ?, unlocked_at = datetime('now')
                    WHERE user_id = ? AND achievement_id = ?
                `).run(progress, userId, achievement.id);
            } else {
                prepare(`
                    UPDATE player_achievements SET progress = ?
                    WHERE user_id = ? AND achievement_id = ?
                `).run(progress, userId, achievement.id);
            }
        } else {
            prepare(`
                INSERT INTO player_achievements (id, user_id, achievement_id, progress, unlocked_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                uuidv4(),
                userId,
                achievement.id,
                progress,
                shouldUnlock ? new Date().toISOString() : null
            );
        }

        if (shouldUnlock) {
            newlyUnlocked.push({
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                icon: achievement.icon,
                points: achievement.points,
            });
        }
    }

    return newlyUnlocked;
}

/**
 * Start a new game session
 */
function startSession(userId, gameId = null) {
    const sessionId = uuidv4();

    prepare(`
        INSERT INTO game_sessions (id, user_id, game_id)
        VALUES (?, ?, ?)
    `).run(sessionId, userId, gameId);

    // Increment games played count
    prepare(`
        UPDATE player_stats SET
            total_games_played = COALESCE(total_games_played, 0) + 1
        WHERE user_id = ?
    `).run(userId);

    return sessionId;
}

/**
 * End a game session
 */
function endSession(sessionId) {
    prepare(`
        UPDATE game_sessions SET ended_at = datetime('now')
        WHERE id = ?
    `).run(sessionId);

    const session = prepare(`SELECT * FROM game_sessions WHERE id = ?`).get(sessionId);

    if (session) {
        // Check if this is a new best single game score
        prepare(`
            UPDATE player_stats SET
                best_single_game_score = MAX(COALESCE(best_single_game_score, 0), ?)
            WHERE user_id = ?
        `).run(session.total_score, session.user_id);
    }

    return session;
}

module.exports = {
    calculateScoreBreakdown,
    submitScore,
    getPlayerRank,
    startSession,
    endSession,
    SCORE_CONFIG,
};
