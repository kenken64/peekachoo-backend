const express = require("express");
const peekachooRoutes = require("./peekachooRoutes");
const authRoutes = require("./authRoutes");
const pokemonRoutes = require("./pokemonRoutes");
const gameRoutes = require("./gameRoutes");
const quizRoutes = require("./quizRoutes");
const leaderboardRoutes = require("./leaderboardRoutes");
const statsRoutes = require("./statsRoutes");
const achievementsRoutes = require("./achievementsRoutes");
const adminRoutes = require("./adminRoutes");
const paymentRoutes = require("./paymentRoutes");

const router = express.Router();

// API welcome route
router.get("/", (_req, res) => {
	res.json({
		message: "Welcome to Peekachoo API",
		version: "1.0.0",
		endpoints: {
			auth: "/api/auth",
			peekachoos: "/api/peekachoos",
			pokemon: "/api/pokemon",
			games: "/api/games",
			quiz: "/api/quiz",
			leaderboard: "/api/leaderboard",
			stats: "/api/stats",
			achievements: "/api/achievements",
			admin: "/api/admin (requires API key)",
		},
	});
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/peekachoos", peekachooRoutes);
router.use("/pokemon", pokemonRoutes);
router.use("/games", gameRoutes);
router.use("/quiz", quizRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/stats", statsRoutes);
router.use("/achievements", achievementsRoutes);
router.use("/admin", adminRoutes);
router.use("/payment", paymentRoutes);

module.exports = router;
