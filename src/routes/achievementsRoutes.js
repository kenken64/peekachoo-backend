const express = require('express');
const router = express.Router();
const achievementsController = require('../controllers/achievementsController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// All achievements routes require authentication
router.use(authMiddleware);

// Get all achievements with progress
router.get('/', achievementsController.getAchievements);

// Get categories summary
router.get('/categories', achievementsController.getCategories);

// Get achievements by category
router.get('/category/:category', achievementsController.getAchievementsByCategory);

// Get specific achievement
router.get('/:achievementId', achievementsController.getAchievement);

module.exports = router;
