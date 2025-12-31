const { prepare } = require('../config/sqlite');
const scoreService = require('../services/scoreService');
const websocketService = require('../services/websocketService');

/**
 * Get global leaderboard
 * GET /api/leaderboard/global
 */
async function getGlobalLeaderboard(req, res, next) {
    try {
        const {
            period = 'all_time',
            limit = 50,
            offset = 0,
            sortBy = 'score'
        } = req.query;

        const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
        const offsetNum = Math.max(0, parseInt(offset) || 0);

        // Build date filter based on period
        let dateFilter = '';
        let periodStart = null;
        let periodEnd = new Date().toISOString();

        switch (period) {
            case 'daily':
                periodStart = new Date();
                periodStart.setHours(0, 0, 0, 0);
                dateFilter = `AND ps.created_at >= '${periodStart.toISOString()}'`;
                break;
            case 'weekly':
                periodStart = new Date();
                periodStart.setDate(periodStart.getDate() - periodStart.getDay());
                periodStart.setHours(0, 0, 0, 0);
                dateFilter = `AND ps.created_at >= '${periodStart.toISOString()}'`;
                break;
            case 'monthly':
                periodStart = new Date();
                periodStart.setDate(1);
                periodStart.setHours(0, 0, 0, 0);
                dateFilter = `AND ps.created_at >= '${periodStart.toISOString()}'`;
                break;
            default:
                periodStart = new Date(0);
        }

        // Get leaderboard based on sort criteria
        let orderBy = 'total_score DESC';
        if (sortBy === 'level') orderBy = 'highest_level DESC, total_score DESC';
        if (sortBy === 'streak') orderBy = 'best_streak DESC, total_score DESC';

        let query;
        let countQuery;

        if (period === 'all_time') {
            // Use player_stats for all-time leaderboard
            query = `
                SELECT
                    u.id as userId,
                    u.display_name as displayName,
                    u.username,
                    pst.total_score_all_time as totalScore,
                    pst.highest_level_reached as highestLevel,
                    pst.best_streak as bestStreak,
                    pst.total_games_played as gamesPlayed,
                    pst.last_played_at as lastPlayedAt,
                    (SELECT COUNT(*) FROM player_achievements pa WHERE pa.user_id = u.id AND pa.unlocked_at IS NOT NULL) as achievementCount
                FROM player_stats pst
                JOIN users u ON u.id = pst.user_id
                WHERE pst.total_score_all_time > 0
                ORDER BY pst.${sortBy === 'level' ? 'highest_level_reached' : sortBy === 'streak' ? 'best_streak' : 'total_score_all_time'} DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = `SELECT COUNT(*) as total FROM player_stats WHERE total_score_all_time > 0`;
        } else {
            // Use aggregated scores for period-based leaderboard
            query = `
                SELECT
                    u.id as userId,
                    u.display_name as displayName,
                    u.username,
                    SUM(ps.total_score) as totalScore,
                    MAX(ps.level) as highestLevel,
                    MAX(pst.best_streak) as bestStreak,
                    COUNT(DISTINCT ps.session_id) as gamesPlayed,
                    MAX(ps.created_at) as lastPlayedAt,
                    (SELECT COUNT(*) FROM player_achievements pa WHERE pa.user_id = u.id AND pa.unlocked_at IS NOT NULL) as achievementCount
                FROM player_scores ps
                JOIN users u ON u.id = ps.user_id
                LEFT JOIN player_stats pst ON pst.user_id = u.id
                WHERE 1=1 ${dateFilter}
                GROUP BY u.id
                ORDER BY ${sortBy === 'level' ? 'highestLevel' : sortBy === 'streak' ? 'bestStreak' : 'totalScore'} DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = `
                SELECT COUNT(DISTINCT user_id) as total
                FROM player_scores ps
                WHERE 1=1 ${dateFilter}
            `;
        }

        const entries = prepare(query).all(limitNum, offsetNum);
        const countResult = prepare(countQuery).get();
        const total = countResult?.total || 0;

        // Add rank to entries and check online status
        const leaderboard = entries.map((entry, index) => ({
            rank: offsetNum + index + 1,
            userId: entry.userId,
            displayName: entry.displayName || entry.username,
            totalScore: entry.totalScore || 0,
            highestLevel: entry.highestLevel || 0,
            bestStreak: entry.bestStreak || 0,
            gamesPlayed: entry.gamesPlayed || 0,
            achievementCount: entry.achievementCount || 0,
            lastPlayedAt: entry.lastPlayedAt,
            isOnline: websocketService.isUserOnline(entry.userId),
        }));

        res.json({
            success: true,
            data: {
                leaderboard,
                pagination: {
                    total,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + entries.length < total,
                },
                period,
                periodStart: periodStart?.toISOString(),
                periodEnd,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get leaderboard entries around the current player
 * GET /api/leaderboard/around-me
 */
async function getAroundMe(req, res, next) {
    try {
        const userId = req.user.id;
        const { period = 'all_time', range = 5 } = req.query;
        const rangeNum = Math.min(Math.max(1, parseInt(range) || 5), 10);

        // Get player's current rank and score
        const playerStats = prepare(`
            SELECT total_score_all_time as totalScore
            FROM player_stats
            WHERE user_id = ?
        `).get(userId);

        if (!playerStats) {
            return res.json({
                success: true,
                data: {
                    player: { rank: 0, totalScore: 0, percentile: 0 },
                    above: [],
                    below: [],
                    period,
                },
            });
        }

        const playerRank = await scoreService.getPlayerRank(userId);
        const totalPlayers = prepare(`SELECT COUNT(*) as count FROM player_stats WHERE total_score_all_time > 0`).get()?.count || 1;
        const percentile = ((totalPlayers - playerRank) / totalPlayers) * 100;

        // Get players above
        const above = prepare(`
            SELECT
                u.id as oduserId,
                u.display_name as displayName,
                pst.total_score_all_time as totalScore,
                pst.highest_level_reached as highestLevel,
                pst.best_streak as bestStreak
            FROM player_stats pst
            JOIN users u ON u.id = pst.user_id
            WHERE pst.total_score_all_time > ?
            ORDER BY pst.total_score_all_time ASC
            LIMIT ?
        `).all(playerStats.totalScore, rangeNum);

        // Get players below
        const below = prepare(`
            SELECT
                u.id as oduserId,
                u.display_name as displayName,
                pst.total_score_all_time as totalScore,
                pst.highest_level_reached as highestLevel,
                pst.best_streak as bestStreak
            FROM player_stats pst
            JOIN users u ON u.id = pst.user_id
            WHERE pst.total_score_all_time < ? AND pst.total_score_all_time > 0
            ORDER BY pst.total_score_all_time DESC
            LIMIT ?
        `).all(playerStats.totalScore, rangeNum);

        // Calculate ranks and check online status
        const aboveWithRanks = above.reverse().map((entry, index) => ({
            rank: playerRank - (above.length - index),
            userId: entry.oduserId,
            displayName: entry.displayName,
            totalScore: entry.totalScore,
            highestLevel: entry.highestLevel,
            bestStreak: entry.bestStreak,
            isOnline: websocketService.isUserOnline(entry.oduserId),
        }));

        const belowWithRanks = below.map((entry, index) => ({
            rank: playerRank + index + 1,
            userId: entry.oduserId,
            displayName: entry.displayName,
            totalScore: entry.totalScore,
            highestLevel: entry.highestLevel,
            bestStreak: entry.bestStreak,
            isOnline: websocketService.isUserOnline(entry.oduserId),
        }));

        res.json({
            success: true,
            data: {
                player: {
                    rank: playerRank,
                    totalScore: playerStats.totalScore,
                    percentile: Math.round(percentile * 10) / 10,
                },
                above: aboveWithRanks,
                below: belowWithRanks,
                period,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get leaderboard for a specific level
 * GET /api/leaderboard/level/:level
 */
async function getLevelLeaderboard(req, res, next) {
    try {
        const { level } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
        const offsetNum = Math.max(0, parseInt(offset) || 0);
        const levelNum = parseInt(level);

        if (isNaN(levelNum) || levelNum < 1) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid level' },
            });
        }

        const entries = prepare(`
            SELECT
                u.id as userId,
                u.display_name as displayName,
                ps.total_score as score,
                ps.territory_percentage as territoryPercentage,
                ps.time_taken_seconds as timeTakenSeconds,
                ps.created_at as achievedAt
            FROM player_scores ps
            JOIN users u ON u.id = ps.user_id
            WHERE ps.level = ?
            ORDER BY ps.total_score DESC
            LIMIT ? OFFSET ?
        `).all(levelNum, limitNum, offsetNum);

        const countResult = prepare(`
            SELECT COUNT(*) as total FROM player_scores WHERE level = ?
        `).get(levelNum);

        const leaderboard = entries.map((entry, index) => ({
            rank: offsetNum + index + 1,
            userId: entry.userId,
            displayName: entry.displayName,
            score: entry.score,
            territoryPercentage: entry.territoryPercentage,
            timeTakenSeconds: entry.timeTakenSeconds,
            achievedAt: entry.achievedAt,
        }));

        res.json({
            success: true,
            data: {
                level: levelNum,
                leaderboard,
                pagination: {
                    total: countResult?.total || 0,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + entries.length < (countResult?.total || 0),
                },
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get leaderboard for a custom game
 * GET /api/leaderboard/game/:gameId
 */
async function getGameLeaderboard(req, res, next) {
    try {
        const { gameId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
        const offsetNum = Math.max(0, parseInt(offset) || 0);

        // Get game info
        const game = prepare(`
            SELECT g.*, u.display_name as creatorName
            FROM games g
            JOIN users u ON u.id = g.creator_id
            WHERE g.id = ?
        `).get(gameId);

        if (!game) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Game not found' },
            });
        }

        // Get leaderboard for this game
        const entries = prepare(`
            SELECT
                u.id as userId,
                u.display_name as displayName,
                SUM(ps.total_score) as totalScore,
                MAX(ps.level) as highestLevel,
                COUNT(*) as levelsCompleted
            FROM player_scores ps
            JOIN users u ON u.id = ps.user_id
            WHERE ps.game_id = ?
            GROUP BY u.id
            ORDER BY totalScore DESC
            LIMIT ? OFFSET ?
        `).all(gameId, limitNum, offsetNum);

        const countResult = prepare(`
            SELECT COUNT(DISTINCT user_id) as total
            FROM player_scores WHERE game_id = ?
        `).get(gameId);

        const levels = JSON.parse(game.levels || '[]');

        const leaderboard = entries.map((entry, index) => ({
            rank: offsetNum + index + 1,
            userId: entry.userId,
            displayName: entry.displayName,
            totalScore: entry.totalScore,
            highestLevel: entry.highestLevel,
            levelsCompleted: entry.levelsCompleted,
        }));

        res.json({
            success: true,
            data: {
                game: {
                    id: game.id,
                    name: game.name,
                    creatorId: game.creator_id,
                    creatorName: game.creatorName,
                    levelCount: levels.length,
                    playCount: game.play_count,
                },
                leaderboard,
                pagination: {
                    total: countResult?.total || 0,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + entries.length < (countResult?.total || 0),
                },
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Submit a score
 * POST /api/leaderboard/scores
 */
async function submitScore(req, res, next) {
    try {
        const userId = req.user.id;
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
        } = req.body;

        // Validate input
        if (!sessionId || !level || territoryPercentage === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing required fields',
                },
            });
        }

        // Validate ranges
        if (territoryPercentage < 0 || territoryPercentage > 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Territory percentage must be between 0 and 1',
                },
            });
        }

        // Anti-cheat: Check for suspicious scores
        if (timeTakenSeconds < 5) {
            return res.status(422).json({
                success: false,
                error: {
                    code: 'SCORE_REJECTED',
                    message: 'Score flagged for review',
                    details: { reason: 'Completion time below minimum threshold' },
                },
            });
        }

        const result = await scoreService.submitScore(userId, {
            gameId: gameId || null,
            sessionId,
            level,
            territoryPercentage,
            timeTakenSeconds: timeTakenSeconds || 0,
            livesRemaining: livesRemaining || 0,
            quizAttempts: quizAttempts || 1,
            pokemonId: pokemonId || null,
            pokemonName: pokemonName || null,
        });

        // Send WebSocket notifications
        const user = prepare(`SELECT display_name, username FROM users WHERE id = ?`).get(userId);
        const displayName = user?.display_name || user?.username || 'Player';

        // Notify about new score
        websocketService.notifyNewScore({
            userId,
            displayName,
            score: result.breakdown.totalScore,
            level,
            rank: result.rankings.globalRank,
            isNewPersonalBest: result.rankings.isNewPersonalBest,
        });

        // Notify about rank change
        if (result.rankings.rankChange !== 0) {
            websocketService.notifyRankChange(
                userId,
                result.rankings.previousRank,
                result.rankings.globalRank,
                displayName
            );
        }

        // Notify about achievements
        if (result.achievements.unlocked.length > 0) {
            result.achievements.unlocked.forEach(achievement => {
                websocketService.notifyAchievementUnlock(userId, achievement);
            });
        }

        // Notify about new Pokemon reveal
        if (result.pokemon.isNewReveal) {
            websocketService.notifyPokemonReveal(userId, {
                id: result.pokemon.pokemonId,
                name: result.pokemon.pokemonName,
            }, {
                count: result.pokemon.collectionCount,
                total: result.pokemon.collectionTotal,
            });
        }

        // Notify about streak milestones
        const streakBonus = result.breakdown.streakBonus;
        if (streakBonus > 0) {
            websocketService.notifyStreakMilestone(userId, result.session.currentStreak, streakBonus);
        }

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Start a new game session
 * POST /api/leaderboard/sessions
 */
async function startSession(req, res, next) {
    try {
        const userId = req.user.id;
        const { gameId } = req.body;

        const sessionId = scoreService.startSession(userId, gameId || null);

        res.status(201).json({
            success: true,
            data: { sessionId },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * End a game session
 * POST /api/leaderboard/sessions/:sessionId/end
 */
async function endSession(req, res, next) {
    try {
        const { sessionId } = req.params;

        const session = scoreService.endSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Session not found' },
            });
        }

        res.json({
            success: true,
            data: {
                sessionId: session.id,
                totalScore: session.total_score,
                levelsCompleted: session.levels_completed,
                highestLevel: session.highest_level,
                maxStreak: session.max_streak,
            },
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getGlobalLeaderboard,
    getAroundMe,
    getLevelLeaderboard,
    getGameLeaderboard,
    submitScore,
    startSession,
    endSession,
};
