const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// All stats routes require authentication
router.use(authMiddleware);

// Player stats
router.get('/me', statsController.getMyStats);
router.get('/player/:userId', statsController.getPlayerStats);

// Game history
router.get('/history', statsController.getGameHistory);

// Pokemon collection
router.get('/collection', statsController.getCollection);

module.exports = router;
