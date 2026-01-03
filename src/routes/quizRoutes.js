const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// All quiz routes require authentication
router.use(authMiddleware);

/**
 * POST /api/quiz/generate
 * Generate a quiz question for a Pokemon
 */
router.post('/generate', quizController.generateQuiz);

module.exports = router;
