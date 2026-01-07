const express = require("express");
const authController = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { rpName, rpID, origin } = require("../config/config");

const router = express.Router();

// Debug endpoint to check WebAuthn configuration
router.get("/config", (_req, res) => {
	res.json({
		rpName,
		rpID,
		origin,
		nodeEnv: process.env.NODE_ENV,
	});
});

// Check if username exists
router.get("/check-username/:username", authController.checkUsername);

// Registration endpoints
router.post("/register/start", authController.startRegistration);
router.post("/register/complete", authController.completeRegistration);

// Authentication endpoints
router.post("/login/start", authController.startAuthentication);
router.post("/login/complete", authController.completeAuthentication);

// Protected endpoint - get current user
router.get("/me", authMiddleware, authController.getCurrentUser);

// Protected endpoint - purchase shield
router.post("/purchase-shield", authMiddleware, authController.purchaseShield);

// Protected endpoint - consume shield
router.post("/consume-shield", authMiddleware, authController.consumeShield);

module.exports = router;
