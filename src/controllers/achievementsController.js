const { prepare } = require('../config/sqlite');

/**
 * Get all achievements with player's progress
 * GET /api/achievements
 */
async function getAchievements(req, res, next) {
    try {
        const userId = req.user.id;

        // Get all achievements
        const achievements = prepare(`SELECT * FROM achievements ORDER BY category, points`).all();

        // Get player's achievement progress
        const playerProgress = prepare(`
            SELECT achievement_id, progress, unlocked_at
            FROM player_achievements
            WHERE user_id = ?
        `).all(userId);

        const progressMap = new Map(
            playerProgress.map(p => [p.achievement_id, p])
        );

        // Get total players for rarity calculation
        const totalPlayers = prepare(`
            SELECT COUNT(*) as count FROM users
        `).get()?.count || 1;

        // Calculate rarity for each achievement
        const rarityMap = new Map();
        const rarityCounts = prepare(`
            SELECT achievement_id, COUNT(*) as count
            FROM player_achievements
            WHERE unlocked_at IS NOT NULL
            GROUP BY achievement_id
        `).all();

        rarityCounts.forEach(r => {
            rarityMap.set(r.achievement_id, (r.count / totalPlayers) * 100);
        });

        // Separate unlocked and locked achievements
        const unlocked = [];
        const locked = [];

        for (const achievement of achievements) {
            const progress = progressMap.get(achievement.id);
            const rarity = rarityMap.get(achievement.id) || 0;

            const baseAchievement = {
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                icon: achievement.icon,
                category: achievement.category,
                points: achievement.points,
                rarity: Math.round(rarity * 10) / 10,
            };

            if (progress?.unlocked_at) {
                unlocked.push({
                    ...baseAchievement,
                    unlockedAt: progress.unlocked_at,
                });
            } else {
                const progressInfo = getProgressInfo(achievement, progress?.progress || 0);
                locked.push({
                    ...baseAchievement,
                    progress: progressInfo,
                    hint: achievement.is_hidden ? null : getHint(achievement),
                });
            }
        }

        // Calculate totals
        const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);
        const maxPoints = achievements.reduce((sum, a) => sum + a.points, 0);
        const completionPercentage = (unlocked.length / achievements.length) * 100;

        res.json({
            success: true,
            data: {
                unlocked,
                locked,
                totalPoints,
                maxPoints,
                completionPercentage: Math.round(completionPercentage * 10) / 10,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get a specific achievement details
 * GET /api/achievements/:achievementId
 */
async function getAchievement(req, res, next) {
    try {
        const userId = req.user.id;
        const { achievementId } = req.params;

        const achievement = prepare(`
            SELECT * FROM achievements WHERE id = ?
        `).get(achievementId);

        if (!achievement) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Achievement not found' },
            });
        }

        const progress = prepare(`
            SELECT progress, unlocked_at
            FROM player_achievements
            WHERE user_id = ? AND achievement_id = ?
        `).get(userId, achievementId);

        // Get rarity
        const totalPlayers = prepare(`SELECT COUNT(*) as count FROM users`).get()?.count || 1;
        const unlockedCount = prepare(`
            SELECT COUNT(*) as count
            FROM player_achievements
            WHERE achievement_id = ? AND unlocked_at IS NOT NULL
        `).get(achievementId)?.count || 0;

        const rarity = (unlockedCount / totalPlayers) * 100;

        // Get recent unlockers
        const recentUnlockers = prepare(`
            SELECT u.display_name as displayName, pa.unlocked_at as unlockedAt
            FROM player_achievements pa
            JOIN users u ON u.id = pa.user_id
            WHERE pa.achievement_id = ? AND pa.unlocked_at IS NOT NULL
            ORDER BY pa.unlocked_at DESC
            LIMIT 5
        `).all(achievementId);

        res.json({
            success: true,
            data: {
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                icon: achievement.icon,
                category: achievement.category,
                points: achievement.points,
                rarity: Math.round(rarity * 10) / 10,
                isUnlocked: !!progress?.unlocked_at,
                unlockedAt: progress?.unlocked_at,
                progress: getProgressInfo(achievement, progress?.progress || 0),
                recentUnlockers,
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get achievements by category
 * GET /api/achievements/category/:category
 */
async function getAchievementsByCategory(req, res, next) {
    try {
        const userId = req.user.id;
        const { category } = req.params;

        const achievements = prepare(`
            SELECT * FROM achievements WHERE category = ? ORDER BY points
        `).all(category);

        if (achievements.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Category not found' },
            });
        }

        const playerProgress = prepare(`
            SELECT achievement_id, progress, unlocked_at
            FROM player_achievements
            WHERE user_id = ? AND achievement_id IN (${achievements.map(() => '?').join(',')})
        `).all(userId, ...achievements.map(a => a.id));

        const progressMap = new Map(
            playerProgress.map(p => [p.achievement_id, p])
        );

        const result = achievements.map(achievement => {
            const progress = progressMap.get(achievement.id);
            return {
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                icon: achievement.icon,
                points: achievement.points,
                isUnlocked: !!progress?.unlocked_at,
                unlockedAt: progress?.unlocked_at,
                progress: getProgressInfo(achievement, progress?.progress || 0),
            };
        });

        const unlockedCount = result.filter(a => a.isUnlocked).length;

        res.json({
            success: true,
            data: {
                category,
                achievements: result,
                summary: {
                    total: achievements.length,
                    unlocked: unlockedCount,
                    percentage: Math.round((unlockedCount / achievements.length) * 100),
                },
            },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get achievement categories summary
 * GET /api/achievements/categories
 */
async function getCategories(req, res, next) {
    try {
        const userId = req.user.id;

        const categories = prepare(`
            SELECT
                category,
                COUNT(*) as total,
                SUM(points) as totalPoints
            FROM achievements
            GROUP BY category
        `).all();

        const unlockedByCategory = prepare(`
            SELECT
                a.category,
                COUNT(*) as unlocked,
                SUM(a.points) as earnedPoints
            FROM player_achievements pa
            JOIN achievements a ON a.id = pa.achievement_id
            WHERE pa.user_id = ? AND pa.unlocked_at IS NOT NULL
            GROUP BY a.category
        `).all(userId);

        const unlockedMap = new Map(
            unlockedByCategory.map(u => [u.category, u])
        );

        const result = categories.map(cat => {
            const unlocked = unlockedMap.get(cat.category);
            return {
                category: cat.category,
                total: cat.total,
                unlocked: unlocked?.unlocked || 0,
                percentage: Math.round(((unlocked?.unlocked || 0) / cat.total) * 100),
                totalPoints: cat.totalPoints,
                earnedPoints: unlocked?.earnedPoints || 0,
            };
        });

        res.json({
            success: true,
            data: { categories: result },
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get progress info for an achievement
 */
function getProgressInfo(achievement, currentProgress) {
    return {
        current: currentProgress,
        target: achievement.requirement_value,
        percentage: Math.min(100, Math.round((currentProgress / achievement.requirement_value) * 100)),
    };
}

/**
 * Get hint for locked achievement
 */
function getHint(achievement) {
    const hints = {
        highest_level: `Reach level ${achievement.requirement_value}`,
        levels_completed: `Complete ${achievement.requirement_value} levels`,
        total_score: `Score ${achievement.requirement_value.toLocaleString()} total points`,
        best_coverage: `Achieve ${achievement.requirement_value}% coverage`,
        fastest_level: `Complete a level in under ${achievement.requirement_value} seconds`,
        best_streak: `Get a ${achievement.requirement_value}-level streak`,
        quiz_correct: `Answer ${achievement.requirement_value} quiz questions correctly`,
        total_territory: `Claim ${achievement.requirement_value.toLocaleString()} pixels`,
        unique_pokemon: `Reveal ${achievement.requirement_value} unique Pokemon`,
    };

    return hints[achievement.requirement_type] || 'Keep playing to unlock!';
}

module.exports = {
    getAchievements,
    getAchievement,
    getAchievementsByCategory,
    getCategories,
};
