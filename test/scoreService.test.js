/**
 * Tests for Score Service
 */

// Mock the sqlite module before requiring scoreService
jest.mock("../src/config/sqlite", () => ({
	prepare: jest.fn(() => ({
		get: jest.fn(),
		all: jest.fn(() => []),
		run: jest.fn(),
	})),
}));

const {
	calculateScoreBreakdown,
	SCORE_CONFIG,
} = require("../src/services/scoreService");

describe("ScoreService", () => {
	describe("calculateScoreBreakdown", () => {
		it("should calculate territory score correctly", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.75, // 75%
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 1,
				currentStreak: 1,
			});

			// 75% * 100 * 10 = 750
			expect(result.territoryScore).toBe(750);
		});

		it("should calculate time bonus for fast completion", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 60, // 60 seconds under 120 base
				livesRemaining: 3,
				quizAttempts: 1,
				currentStreak: 1,
			});

			// (120 - 60) * 5 = 300
			expect(result.timeBonus).toBe(300);
		});

		it("should return zero time bonus for slow completion", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 150, // Over 120 base
				livesRemaining: 3,
				quizAttempts: 1,
				currentStreak: 1,
			});

			expect(result.timeBonus).toBe(0);
		});

		it("should calculate life bonus correctly", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 2,
				quizAttempts: 1,
				currentStreak: 1,
			});

			// 2 * 200 = 400
			expect(result.lifeBonus).toBe(400);
		});

		it("should apply first try quiz bonus", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 1,
				currentStreak: 1,
			});

			expect(result.quizBonus).toBe(SCORE_CONFIG.QUIZ_BONUS_FIRST_TRY);
		});

		it("should apply second try quiz bonus", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 2,
				currentStreak: 1,
			});

			expect(result.quizBonus).toBe(SCORE_CONFIG.QUIZ_BONUS_SECOND_TRY);
		});

		it("should not apply quiz bonus for more than 2 attempts", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 3,
				currentStreak: 1,
			});

			expect(result.quizBonus).toBe(0);
		});

		it("should apply level multiplier", () => {
			const level5Result = calculateScoreBreakdown({
				level: 5,
				territoryPercentage: 0.5, // 500 territory score
				timeTakenSeconds: 120, // 0 time bonus
				livesRemaining: 0, // 0 life bonus
				quizAttempts: 3, // 0 quiz bonus
				currentStreak: 1,
			});

			// Level 5 multiplier: 1 + (5 * 0.2) = 2.0
			// Subtotal: 500
			// Level score: 500 * 2.0 = 1000
			expect(level5Result.levelMultiplier).toBe(2);
			expect(level5Result.levelScore).toBe(1000);
		});

		it("should apply streak bonus for 3+ streak", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 3,
				currentStreak: 3,
			});

			expect(result.streakBonus).toBe(SCORE_CONFIG.STREAK_BONUSES[3]);
		});

		it("should apply streak bonus for 5+ streak", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 3,
				currentStreak: 5,
			});

			expect(result.streakBonus).toBe(SCORE_CONFIG.STREAK_BONUSES[5]);
		});

		it("should apply highest applicable streak bonus", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 3,
				currentStreak: 20,
			});

			expect(result.streakBonus).toBe(SCORE_CONFIG.STREAK_BONUSES[20]);
		});

		it("should not apply streak bonus for streak < 3", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 120,
				livesRemaining: 3,
				quizAttempts: 3,
				currentStreak: 2,
			});

			expect(result.streakBonus).toBe(0);
		});

		it("should calculate total score correctly", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.8, // 800
				timeTakenSeconds: 60, // 300 time bonus
				livesRemaining: 3, // 600 life bonus
				quizAttempts: 1, // 500 quiz bonus
				currentStreak: 3, // 500 streak bonus
			});

			// Subtotal: 800 + 300 + 600 + 500 = 2200
			// Level multiplier (level 1): 1 + (1 * 0.2) = 1.2
			// Level score: 2200 * 1.2 = 2640
			// Streak bonus: 500
			// Total: 2640 + 500 = 3140
			expect(result.subtotal).toBe(2200);
			expect(result.levelScore).toBe(2640);
			expect(result.totalScore).toBe(3140);
		});

		it("should return all breakdown components", () => {
			const result = calculateScoreBreakdown({
				level: 1,
				territoryPercentage: 0.5,
				timeTakenSeconds: 100,
				livesRemaining: 2,
				quizAttempts: 1,
				currentStreak: 1,
			});

			expect(result).toHaveProperty("territoryScore");
			expect(result).toHaveProperty("timeBonus");
			expect(result).toHaveProperty("lifeBonus");
			expect(result).toHaveProperty("quizBonus");
			expect(result).toHaveProperty("subtotal");
			expect(result).toHaveProperty("levelMultiplier");
			expect(result).toHaveProperty("levelScore");
			expect(result).toHaveProperty("streakBonus");
			expect(result).toHaveProperty("totalScore");
		});
	});

	describe("SCORE_CONFIG", () => {
		it("should have all required configuration values", () => {
			expect(SCORE_CONFIG.TERRITORY_MULTIPLIER).toBe(10);
			expect(SCORE_CONFIG.TIME_BONUS_BASE).toBe(120);
			expect(SCORE_CONFIG.TIME_BONUS_MULTIPLIER).toBe(5);
			expect(SCORE_CONFIG.LIFE_BONUS).toBe(200);
			expect(SCORE_CONFIG.QUIZ_BONUS_FIRST_TRY).toBe(500);
			expect(SCORE_CONFIG.QUIZ_BONUS_SECOND_TRY).toBe(200);
			expect(SCORE_CONFIG.LEVEL_MULTIPLIER_BASE).toBe(1);
			expect(SCORE_CONFIG.LEVEL_MULTIPLIER_INCREMENT).toBe(0.2);
		});

		it("should have streak bonuses defined", () => {
			expect(SCORE_CONFIG.STREAK_BONUSES).toBeDefined();
			expect(SCORE_CONFIG.STREAK_BONUSES[3]).toBe(500);
			expect(SCORE_CONFIG.STREAK_BONUSES[5]).toBe(1000);
			expect(SCORE_CONFIG.STREAK_BONUSES[10]).toBe(2500);
			expect(SCORE_CONFIG.STREAK_BONUSES[15]).toBe(4000);
			expect(SCORE_CONFIG.STREAK_BONUSES[20]).toBe(6000);
		});
	});
});
