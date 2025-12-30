const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Check if username exists
router.get('/check-username/:username', authController.checkUsername);

// Registration endpoints
router.post('/register/start', authController.startRegistration);
router.post('/register/complete', authController.completeRegistration);

// Authentication endpoints
router.post('/login/start', authController.startAuthentication);
router.post('/login/complete', authController.completeAuthentication);

// Protected endpoint - get current user
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
