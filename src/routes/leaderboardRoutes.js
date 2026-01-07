const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// All leaderboard routes require authentication
router.use(authMiddleware);

// Leaderboard endpoints
router.get("/global", leaderboardController.getGlobalLeaderboard);
router.get("/level/:level", leaderboardController.getLevelLeaderboard);
router.get("/game/:gameId", leaderboardController.getGameLeaderboard);

router.get("/around-me", leaderboardController.getAroundMe);
router.post("/scores", leaderboardController.submitScore);
router.post("/sessions", leaderboardController.startSession);
router.post("/sessions/:sessionId/end", leaderboardController.endSession);

module.exports = router;
