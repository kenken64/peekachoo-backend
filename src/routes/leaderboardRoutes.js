const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authMiddleware, optionalAuth } = require('../middlewares/authMiddleware');

// Public endpoints (no auth required)
router.get('/global', leaderboardController.getGlobalLeaderboard);
router.get('/level/:level', leaderboardController.getLevelLeaderboard);
router.get('/game/:gameId', leaderboardController.getGameLeaderboard);

// Protected endpoints (auth required)
router.get('/around-me', authMiddleware, leaderboardController.getAroundMe);
router.post('/scores', authMiddleware, leaderboardController.submitScore);
router.post('/sessions', authMiddleware, leaderboardController.startSession);
router.post('/sessions/:sessionId/end', authMiddleware, leaderboardController.endSession);

module.exports = router;
