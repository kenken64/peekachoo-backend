const { prepare } = require('../config/sqlite');
const scoreService = require('../services/scoreService');

/**
 * Get current player's stats
 * GET /api/stats/me
 */
async function getMyStats(req, res, next) {
    try {
        const userId = req.user.id;

        const user = prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
        const stats = prepare(`SELECT * FROM player_stats WHERE user_id = ?`).get(userId);

        if (!stats) {
            return res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        displayName: user.display_name || user.username,
                        createdAt: user.created_at,
                    },
                    stats: getEmptyStats(),
                    rankings: {
                        global: { rank: 0, total: 0, percentile: 0 },
                        weekly: { rank: 0, total: 0 },
                    },
                    recentGames: [],
                },
            });
        }

        // Get global rank
        const globalRank = await scoreService.getPlayerRank(userId);
        const totalPlayers = prepare(`
            SELECT COUNT(*) as count FROM player_stats WHERE total_score_all_time > 0
        `).get()?.count || 1;
        const percentile = ((totalPlayers - globalRank) / totalPlayers) * 100;

        // Get weekly rank
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weeklyStats = prepare(`
            SELECT SUM(total_score) as weeklyScore
            FROM player_scores
            WHERE user_id = ? AND created_at >= ?
        `).get(userId, weekStart.toISOString());

        const weeklyRankResult = prepare(`
            SELECT COUNT(*) + 1 as rank
            FROM (
                SELECT user_id, SUM(total_score) as score
                FROM player_scores
                WHERE created_at >= ?
                GROUP BY user_id
                HAVING score > ?
            )
        `).get(weekStart.toISOString(), weeklyStats?.weeklyScore || 0);

        const weeklyTotal = prepare(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM player_scores
            WHERE created_at >= ?
        `).get(weekStart.toISOString())?.count || 0;

        // Get recent games
        const recentGames = prepare(`
            SELECT
                gs.id as sessionId,
                gs.game_id as gameId,
                g.name as gameName,
                gs.levels_completed as levelsCompleted,
                gs.highest_level as highestLevel,
                gs.total_score as totalScore,
                gs.started_at as playedAt,
                CAST((julianday(COALESCE(gs.ended_at, datetime('now'))) - julianday(gs.started_at)) * 86400 AS INTEGER) as duration
            FROM game_sessions gs
            LEFT JOIN games g ON g.id = gs.game_id
            WHERE gs.user_id = ?
            ORDER BY gs.started_at DESC
            LIMIT 10
        `).all(userId);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    displayName: user.display_name || user.username,
                    createdAt: user.created_at,
                },
                stats: {
                    highestLevelReached: stats.highest_level_reached || 0,
                    totalLevelsCompleted: stats.total_levels_completed || 0,
                    totalGamesPlayed: stats.total_games_played || 0,
                    totalScoreAllTime: stats.total_score_all_time || 0,
                    bestSingleGameScore: stats.best_single_game_score || 0,
                    averageScorePerGame: stats.total_games_played > 0
                        ? Math.round(stats.total_score_all_time / stats.total_games_played)
                        : 0,
                    totalTerritoryClaimed: stats.total_territory_claimed || 0,
                    averageCoverage: stats.average_coverage || 0,
                    bestCoverage: stats.best_coverage || 0,
                    fastestLevelSeconds: stats.fastest_level_seconds === 999999 ? null : stats.fastest_level_seconds,
                    currentStreak: stats.current_streak || 0,
                    bestStreak: stats.best_streak || 0,
                    quizCorrectTotal: stats.quiz_correct_total || 0,
                    quizAttemptsTotal: stats.quiz_attempts_total || 0,
                    quizAccuracy: stats.quiz_attempts_total > 0
                        ? stats.quiz_correct_total / stats.quiz_attempts_total
                        : 0,
                    totalPlayTimeSeconds: stats.total_play_time_seconds || 0,
                    uniquePokemonRevealed: stats.unique_pokemon_revealed || 0,
                    totalPokemon: 151,
                    firstPlayedAt: stats.first_played_at,
                    lastPlayedAt: stats.last_played_at,
                },
                rankings: {
                    global: {
                        rank: globalRank,
                        total: totalPlayers,
                        percentile: Math.round(percentile * 10) / 10,
                    },
                    weekly: {
                        rank: weeklyRankResult?.rank || 0,
                        total: weeklyTotal,
                    },
                },
                recentGames,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get another player's public stats
 * GET /api/stats/player/:userId
 */
async function getPlayerStats(req, res, next) {
    try {
        const { userId } = req.params;

        const user = prepare(`SELECT * FROM users WHERE id = ?`).get(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Player not found' },
            });
        }

        const stats = prepare(`SELECT * FROM player_stats WHERE user_id = ?`).get(userId);

        if (!stats) {
            return res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        displayName: user.display_name || user.username,
                        createdAt: user.created_at,
                    },
                    stats: getEmptyStats(),
                    rankings: {
                        global: { rank: 0, total: 0, percentile: 0 },
                    },
                },
            });
        }

        // Get global rank
        const globalRank = await scoreService.getPlayerRank(userId);
        const totalPlayers = prepare(`
            SELECT COUNT(*) as count FROM player_stats WHERE total_score_all_time > 0
        `).get()?.count || 1;
        const percentile = ((totalPlayers - globalRank) / totalPlayers) * 100;

        // Public stats (limited info)
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    displayName: user.display_name || user.username,
                    createdAt: user.created_at,
                },
                stats: {
                    highestLevelReached: stats.highest_level_reached || 0,
                    totalLevelsCompleted: stats.total_levels_completed || 0,
                    totalGamesPlayed: stats.total_games_played || 0,
                    totalScoreAllTime: stats.total_score_all_time || 0,
                    bestStreak: stats.best_streak || 0,
                    uniquePokemonRevealed: stats.unique_pokemon_revealed || 0,
                    totalPokemon: 151,
                    lastPlayedAt: stats.last_played_at,
                },
                rankings: {
                    global: {
                        rank: globalRank,
                        total: totalPlayers,
                        percentile: Math.round(percentile * 10) / 10,
                    },
                },
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get player's game history
 * GET /api/stats/history
 */
async function getGameHistory(req, res, next) {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0, gameId } = req.query;

        const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 50);
        const offsetNum = Math.max(0, parseInt(offset) || 0);

        let whereClause = 'WHERE gs.user_id = ?';
        const params = [userId];

        if (gameId) {
            whereClause += ' AND gs.game_id = ?';
            params.push(gameId);
        }

        const sessions = prepare(`
            SELECT
                gs.id as sessionId,
                gs.game_id as gameId,
                g.name as gameName,
                gs.levels_completed as levelsCompleted,
                gs.highest_level as highestLevel,
                gs.total_score as totalScore,
                gs.max_streak as maxStreak,
                gs.started_at as playedAt,
                gs.ended_at as endedAt,
                CAST((julianday(COALESCE(gs.ended_at, datetime('now'))) - julianday(gs.started_at)) * 86400 AS INTEGER) as duration
            FROM game_sessions gs
            LEFT JOIN games g ON g.id = gs.game_id
            ${whereClause}
            ORDER BY gs.started_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limitNum, offsetNum);

        // Get level details for each session
        const history = await Promise.all(sessions.map(async session => {
            const levels = prepare(`
                SELECT
                    level,
                    total_score as score,
                    territory_percentage as territoryPercentage,
                    time_taken_seconds as timeTakenSeconds,
                    lives_remaining as livesRemaining,
                    quiz_attempts as quizAttempts,
                    pokemon_name as pokemonRevealed
                FROM player_scores
                WHERE session_id = ?
                ORDER BY level ASC
            `).all(session.sessionId);

            return {
                ...session,
                levels,
            };
        }));

        const countResult = prepare(`
            SELECT COUNT(*) as total
            FROM game_sessions gs
            ${whereClause}
        `).get(...params);

        res.json({
            success: true,
            data: {
                history,
                pagination: {
                    total: countResult?.total || 0,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + sessions.length < (countResult?.total || 0),
                },
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get player's Pokemon collection
 * GET /api/stats/collection
 */
async function getCollection(req, res, next) {
    try {
        const userId = req.user.id;
        const { filter = 'all', sortBy = 'id', order = 'asc' } = req.query;

        // Get collection summary
        const revealed = prepare(`
            SELECT COUNT(*) as count FROM player_pokemon_collection WHERE user_id = ?
        `).get(userId)?.count || 0;

        const total = 151;
        const percentage = (revealed / total) * 100;

        // Get all Pokemon with collection status
        let query = `
            SELECT
                p.id,
                p.name,
                p.sprite_url as spriteUrl,
                p.types,
                ppc.first_revealed_at as revealedAt,
                ppc.times_revealed as timesRevealed,
                ppc.best_coverage as bestCoverage,
                ppc.fastest_reveal_seconds as fastestReveal,
                CASE WHEN ppc.user_id IS NOT NULL THEN 1 ELSE 0 END as isRevealed
            FROM pokemon p
            LEFT JOIN player_pokemon_collection ppc ON ppc.pokemon_id = p.id AND ppc.user_id = ?
        `;

        if (filter === 'revealed') {
            query += ' WHERE ppc.user_id IS NOT NULL';
        } else if (filter === 'hidden') {
            query += ' WHERE ppc.user_id IS NULL';
        }

        // Add ordering
        let orderColumn = 'p.id';
        if (sortBy === 'name') orderColumn = 'p.name';
        if (sortBy === 'revealed_at') orderColumn = 'ppc.first_revealed_at';
        if (sortBy === 'times_revealed') orderColumn = 'ppc.times_revealed';

        query += ` ORDER BY ${orderColumn} ${order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;

        const pokemon = prepare(query).all(userId);

        // Get recently revealed
        const recentlyRevealed = prepare(`
            SELECT
                p.id,
                p.name,
                p.sprite_url as spriteUrl,
                ppc.first_revealed_at as revealedAt
            FROM player_pokemon_collection ppc
            JOIN pokemon p ON p.id = ppc.pokemon_id
            WHERE ppc.user_id = ?
            ORDER BY ppc.first_revealed_at DESC
            LIMIT 5
        `).all(userId);

        res.json({
            success: true,
            data: {
                summary: {
                    revealed,
                    total,
                    percentage: Math.round(percentage * 10) / 10,
                },
                pokemon: pokemon.map(p => ({
                    ...p,
                    types: p.types ? JSON.parse(p.types) : [],
                    isRevealed: !!p.isRevealed,
                })),
                recentlyRevealed: recentlyRevealed.map(p => ({
                    ...p,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get empty stats object
 */
function getEmptyStats() {
    return {
        highestLevelReached: 0,
        totalLevelsCompleted: 0,
        totalGamesPlayed: 0,
        totalScoreAllTime: 0,
        bestSingleGameScore: 0,
        averageScorePerGame: 0,
        totalTerritoryClaimed: 0,
        averageCoverage: 0,
        bestCoverage: 0,
        fastestLevelSeconds: null,
        currentStreak: 0,
        bestStreak: 0,
        quizCorrectTotal: 0,
        quizAttemptsTotal: 0,
        quizAccuracy: 0,
        totalPlayTimeSeconds: 0,
        uniquePokemonRevealed: 0,
        totalPokemon: 151,
        firstPlayedAt: null,
        lastPlayedAt: null,
    };
}

module.exports = {
    getMyStats,
    getPlayerStats,
    getGameHistory,
    getCollection,
};
