const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Create a new game
router.post("/", gameController.createGame);

// Get current user's games
router.get("/my-games", gameController.getMyGames);

// Get all published games
router.get("/published", gameController.getPublishedGames);

// Get game by ID
router.get("/:id", gameController.getGameById);

// Update game
router.put("/:id", gameController.updateGame);

// Toggle publish status
router.patch("/:id/publish", gameController.togglePublish);

// Delete game
router.delete("/:id", gameController.deleteGame);

// Increment play count
router.post("/:id/play", gameController.incrementPlayCount);

module.exports = router;
