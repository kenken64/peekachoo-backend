const { v4: uuidv4 } = require('uuid');
const { prepare, saveDatabase } = require('../config/sqlite');
const websocketService = require('../services/websocketService');

// Create a new game
exports.createGame = async (req, res) => {
    try {
        const { name, description, levels } = req.body;
        const creatorId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'Game name is required' });
        }

        if (!levels || !Array.isArray(levels) || levels.length === 0) {
            return res.status(400).json({ error: 'At least one level is required' });
        }

        const gameId = uuidv4();
        
        prepare(`
            INSERT INTO games (id, creator_id, name, description, levels, is_published)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            gameId,
            creatorId,
            name,
            description || '',
            JSON.stringify(levels),
            0
        );

        res.status(201).json({
            success: true,
            data: {
                id: gameId,
                name,
                description,
                levels,
                isPublished: false
            }
        });
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all games by current user
exports.getMyGames = async (req, res) => {
    try {
        const userId = req.user.id;

        const games = prepare(`
            SELECT * FROM games
            WHERE creator_id = ?
            ORDER BY created_at DESC
        `).all(userId);

        const parsed = games.map(g => ({
            id: g.id,
            name: g.name,
            description: g.description,
            levels: JSON.parse(g.levels || '[]'),
            isPublished: g.is_published === 1,
            playCount: g.play_count,
            activePlayerCount: websocketService.getActivePlayerCount(g.id, userId),
            createdAt: g.created_at,
            updatedAt: g.updated_at
        }));

        res.json({
            success: true,
            data: parsed
        });
    } catch (error) {
        console.error('Get my games error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all published games
exports.getPublishedGames = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const games = prepare(`
            SELECT g.*, u.username as creator_name
            FROM games g
            JOIN users u ON g.creator_id = u.id
            WHERE g.is_published = 1
            ORDER BY g.play_count DESC, g.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        const parsed = games.map(g => ({
            id: g.id,
            name: g.name,
            description: g.description,
            levels: JSON.parse(g.levels || '[]'),
            creatorName: g.creator_name,
            playCount: g.play_count,
            createdAt: g.created_at
        }));

        res.json({
            success: true,
            data: parsed
        });
    } catch (error) {
        console.error('Get published games error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get game by ID
exports.getGameById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const game = prepare(`
            SELECT g.*, u.username as creator_name
            FROM games g
            JOIN users u ON g.creator_id = u.id
            WHERE g.id = ?
        `).get(id);

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Only allow access if published or owned by user
        if (game.is_published !== 1 && game.creator_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const isOwner = game.creator_id === userId;

        res.json({
            success: true,
            data: {
                id: game.id,
                name: game.name,
                description: game.description,
                levels: JSON.parse(game.levels || '[]'),
                isPublished: game.is_published === 1,
                creatorName: game.creator_name,
                playCount: game.play_count,
                // Only include active player count for the owner
                ...(isOwner ? { activePlayerCount: websocketService.getActivePlayerCount(id, userId) } : {}),
                createdAt: game.created_at,
                updatedAt: game.updated_at
            }
        });
    } catch (error) {
        console.error('Get game by ID error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update game
exports.updateGame = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, levels } = req.body;
        const userId = req.user.id;

        // Check ownership
        const game = prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        if (game.creator_id !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this game' });
        }

        prepare(`
            UPDATE games SET
                name = ?,
                description = ?,
                levels = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            name || game.name,
            description !== undefined ? description : game.description,
            levels ? JSON.stringify(levels) : game.levels,
            id
        );

        res.json({
            success: true,
            message: 'Game updated successfully'
        });
    } catch (error) {
        console.error('Update game error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Publish/Unpublish game
exports.togglePublish = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const game = prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        if (game.creator_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const isCurrentlyPublished = game.is_published === 1;
        const newStatus = isCurrentlyPublished ? 0 : 1;

        // If trying to unpublish, check for active players (excluding the owner)
        if (isCurrentlyPublished) {
            const activePlayerCount = websocketService.getActivePlayerCount(id, userId);
            if (activePlayerCount > 0) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'ACTIVE_PLAYERS',
                        message: `Cannot unpublish: ${activePlayerCount} player(s) currently playing this game`,
                        activePlayerCount
                    }
                });
            }
        }

        prepare('UPDATE games SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

        res.json({
            success: true,
            isPublished: newStatus === 1
        });
    } catch (error) {
        console.error('Toggle publish error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete game
exports.deleteGame = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const game = prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        if (game.creator_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Prevent deletion of published games
        if (game.is_published === 1) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'GAME_PUBLISHED',
                    message: 'Cannot delete a published game. Please unpublish it first.'
                }
            });
        }

        prepare('DELETE FROM games WHERE id = ?').run(id);

        res.json({
            success: true,
            message: 'Game deleted successfully'
        });
    } catch (error) {
        console.error('Delete game error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Increment play count
exports.incrementPlayCount = async (req, res) => {
    try {
        const { id } = req.params;

        const game = prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        prepare('UPDATE games SET play_count = play_count + 1 WHERE id = ?').run(id);

        res.json({
            success: true,
            playCount: game.play_count + 1
        });
    } catch (error) {
        console.error('Increment play count error:', error);
        res.status(500).json({ error: error.message });
    }
};
