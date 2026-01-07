const initSqlJs = require("sql.js");
const path = require("node:path");
const fs = require("node:fs");

const dbPath = path.join(__dirname, "../../data/peekachoo.db");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

async function initDatabase() {
	console.log("[SQLite] Loading sql.js wasm...");
	const SQL = await initSqlJs();
	console.log("[SQLite] sql.js loaded");

	// Load existing database or create new one
	if (fs.existsSync(dbPath)) {
		const fileBuffer = fs.readFileSync(dbPath);
		db = new SQL.Database(fileBuffer);
	} else {
		db = new SQL.Database();
	}

	// Create users table
	db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Create passkey credentials table
	db.run(`
        CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            public_key TEXT NOT NULL,
            counter INTEGER DEFAULT 0,
            device_type TEXT,
            backed_up INTEGER DEFAULT 0,
            transports TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

	// Create challenges table for WebAuthn
	db.run(`
        CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            challenge TEXT NOT NULL,
            type TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Create game scores table
	db.run(`
        CREATE TABLE IF NOT EXISTS scores (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            level INTEGER NOT NULL,
            score INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

	// Create pokemon table
	db.run(`
        CREATE TABLE IF NOT EXISTS pokemon (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            name_jp TEXT,
            name_cn TEXT,
            height INTEGER,
            weight INTEGER,
            base_experience INTEGER,
            sprite_url TEXT,
            types TEXT,
            abilities TEXT,
            stats TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Migration: Add name_jp column if it doesn't exist
	try {
		db.run(`ALTER TABLE pokemon ADD COLUMN name_jp TEXT`);
	} catch (_e) {
		// Column likely already exists, ignore error
	}

	// Migration: Add shields column to users table
	try {
		db.run(`ALTER TABLE users ADD COLUMN shields INTEGER DEFAULT 0`);
	} catch (_e) {
		// Column likely already exists
	}

	// Migration: Add name_cn column if it doesn't exist
	try {
		db.run(`ALTER TABLE pokemon ADD COLUMN name_cn TEXT`);
	} catch (_e) {
		// Column likely already exists, ignore error
	}

	// Migration: Add total_shields_purchased and total_spent to users
	try {
		db.run(
			`ALTER TABLE users ADD COLUMN total_shields_purchased INTEGER DEFAULT 0`,
		);
	} catch (_e) {}

	try {
		db.run(`ALTER TABLE users ADD COLUMN total_spent REAL DEFAULT 0.0`);
	} catch (_e) {}

	// Migration: Backfill total_shields_purchased for existing users with shields
	// This assumes existing shields were purchased at $0.20 each.
	// Only updates users who have shields but no purchase history recorded yet.
	try {
		db.run(`
            UPDATE users 
            SET 
                total_shields_purchased = shields, 
                total_spent = shields * 0.20 
            WHERE 
                shields > 0 AND 
                (total_shields_purchased IS NULL OR total_shields_purchased = 0)
        `);
	} catch (e) {
		console.error("Migration warning: Failed to backfill shield data", e);
	}

	// Migration: Add monthly purchase tracking columns
	try {
		db.run(`ALTER TABLE users ADD COLUMN monthly_spent REAL DEFAULT 0.0`);
	} catch (_e) {}

	try {
		db.run(`ALTER TABLE users ADD COLUMN first_purchase_date TEXT`);
	} catch (_e) {}

	try {
		db.run(`ALTER TABLE users ADD COLUMN purchase_reset_date TEXT`);
	} catch (_e) {}

	// Migration: Backfill first_purchase_date and purchase_reset_date for users with purchases
	try {
		// For users with total_spent > 0 but no first_purchase_date, set it to their created_at
		db.run(`
            UPDATE users 
            SET first_purchase_date = created_at
            WHERE total_spent > 0 
            AND (first_purchase_date IS NULL OR first_purchase_date = '')
        `);
		console.log(
			"[SQLite Migration] Backfilled first_purchase_date for existing purchasers",
		);
	} catch (e) {
		console.error(
			"[SQLite Migration] Failed to backfill first_purchase_date:",
			e,
		);
	}

	// Create purchases table to track individual purchases
	db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            amount_sgd REAL NOT NULL,
            razorpay_order_id TEXT,
            razorpay_payment_id TEXT,
            status TEXT DEFAULT 'captured',
            settlement_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

	db.run(`CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id)`);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC)`,
	);

	// Migration: Add settlement_id column to purchases if it doesn't exist
	try {
		db.run(`ALTER TABLE purchases ADD COLUMN settlement_id TEXT`);
	} catch (_e) {
		// Column already exists
	}

	// Migration: Update default status from 'completed' to 'captured'
	try {
		db.run(
			`UPDATE purchases SET status = 'captured' WHERE status = 'completed'`,
		);
	} catch (_e) {
		// Ignore errors
	}

	// Create games table
	db.run(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            levels TEXT NOT NULL,
            is_published INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

	// ═══════════════════════════════════════════════════════════════════════════
	// LEADERBOARD SYSTEM TABLES
	// ═══════════════════════════════════════════════════════════════════════════

	// Enhanced player scores table with detailed breakdown
	db.run(`
        CREATE TABLE IF NOT EXISTS player_scores (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            game_id TEXT,
            session_id TEXT NOT NULL,
            level INTEGER NOT NULL,

            -- Score breakdown
            territory_score INTEGER NOT NULL DEFAULT 0,
            time_bonus INTEGER NOT NULL DEFAULT 0,
            life_bonus INTEGER NOT NULL DEFAULT 0,
            quiz_bonus INTEGER NOT NULL DEFAULT 0,
            streak_bonus INTEGER NOT NULL DEFAULT 0,
            level_multiplier REAL NOT NULL DEFAULT 1.0,
            total_score INTEGER NOT NULL DEFAULT 0,

            -- Performance details
            territory_percentage REAL NOT NULL DEFAULT 0,
            time_taken_seconds INTEGER NOT NULL DEFAULT 0,
            lives_remaining INTEGER NOT NULL DEFAULT 0,
            quiz_attempts INTEGER NOT NULL DEFAULT 1,

            -- Pokemon revealed
            pokemon_id INTEGER,
            pokemon_name TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
        )
    `);

	// Create indices for player_scores
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_scores_user ON player_scores(user_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_scores_total ON player_scores(total_score DESC)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_scores_session ON player_scores(session_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_scores_game ON player_scores(game_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_scores_created ON player_scores(created_at DESC)`,
	);

	// Aggregated player statistics
	db.run(`
        CREATE TABLE IF NOT EXISTS player_stats (
            user_id TEXT PRIMARY KEY,

            -- Game progress
            highest_level_reached INTEGER DEFAULT 0,
            total_levels_completed INTEGER DEFAULT 0,
            total_games_played INTEGER DEFAULT 0,

            -- Score metrics
            total_score_all_time INTEGER DEFAULT 0,
            best_single_game_score INTEGER DEFAULT 0,

            -- Performance metrics
            total_territory_claimed INTEGER DEFAULT 0,
            average_coverage REAL DEFAULT 0,
            best_coverage REAL DEFAULT 0,
            fastest_level_seconds INTEGER DEFAULT 999999,

            -- Streak tracking
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,

            -- Quiz stats
            quiz_correct_total INTEGER DEFAULT 0,
            quiz_attempts_total INTEGER DEFAULT 0,

            -- Time tracking
            total_play_time_seconds INTEGER DEFAULT 0,

            -- Collection
            unique_pokemon_revealed INTEGER DEFAULT 0,

            -- Timestamps
            first_played_at DATETIME,
            last_played_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

	// Create indices for player_stats
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_stats_score ON player_stats(total_score_all_time DESC)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_stats_level ON player_stats(highest_level_reached DESC)`,
	);

	// Achievement definitions
	db.run(`
        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT NOT NULL,
            category TEXT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            requirement_type TEXT NOT NULL,
            requirement_value INTEGER NOT NULL,
            is_hidden INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

	// Player achievements (unlocked)
	db.run(`
        CREATE TABLE IF NOT EXISTS player_achievements (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            unlocked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, achievement_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
        )
    `);

	db.run(
		`CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id)`,
	);

	// Pokemon collection tracking
	db.run(`
        CREATE TABLE IF NOT EXISTS player_pokemon_collection (
            user_id TEXT NOT NULL,
            pokemon_id INTEGER NOT NULL,
            first_revealed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            times_revealed INTEGER DEFAULT 1,
            best_coverage REAL DEFAULT 0,
            fastest_reveal_seconds INTEGER,
            PRIMARY KEY (user_id, pokemon_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (pokemon_id) REFERENCES pokemon(id) ON DELETE CASCADE
        )
    `);

	db.run(
		`CREATE INDEX IF NOT EXISTS idx_pokemon_collection_user ON player_pokemon_collection(user_id)`,
	);

	// Game sessions for tracking continuous play
	db.run(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            game_id TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            total_score INTEGER DEFAULT 0,
            levels_completed INTEGER DEFAULT 0,
            highest_level INTEGER DEFAULT 0,
            max_streak INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
        )
    `);

	db.run(
		`CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_game_sessions_score ON game_sessions(total_score DESC)`,
	);

	// Daily challenges
	db.run(`
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id TEXT PRIMARY KEY,
            challenge_date DATE NOT NULL,
            challenge_type TEXT NOT NULL,
            description TEXT NOT NULL,
            target_value INTEGER NOT NULL,
            bonus_points INTEGER NOT NULL,
            UNIQUE(challenge_date, challenge_type)
        )
    `);

	// Player daily challenge progress
	db.run(`
        CREATE TABLE IF NOT EXISTS player_daily_challenges (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            challenge_id TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            completed_at DATETIME,
            UNIQUE(user_id, challenge_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
        )
    `);

	// Seed default achievements
	seedAchievements();

	saveDatabase();
	console.log("SQLite database initialized");

	return db;
}

function saveDatabase() {
	if (db) {
		const data = db.export();
		const buffer = Buffer.from(data);
		fs.writeFileSync(dbPath, buffer);
	}
}

function getDb() {
	return db;
}

// Helper functions to match better-sqlite3 API style
function prepare(sql) {
	return {
		run: (...params) => {
			db.run(sql, params);
			saveDatabase();
		},
		get: (...params) => {
			const stmt = db.prepare(sql);
			stmt.bind(params);
			if (stmt.step()) {
				const row = stmt.getAsObject();
				stmt.free();
				return row;
			}
			stmt.free();
			return undefined;
		},
		all: (...params) => {
			const results = [];
			const stmt = db.prepare(sql);
			stmt.bind(params);
			while (stmt.step()) {
				results.push(stmt.getAsObject());
			}
			stmt.free();
			return results;
		},
	};
}

// Seed default achievements
function seedAchievements() {
	const achievements = [
		// Progress achievements
		{
			id: "first_level",
			name: "First Steps",
			description: "Complete your first level",
			icon: "🏁",
			category: "progress",
			points: 10,
			requirement_type: "levels_completed",
			requirement_value: 1,
		},
		{
			id: "level_5",
			name: "Rising Star",
			description: "Reach level 5",
			icon: "⭐",
			category: "progress",
			points: 25,
			requirement_type: "highest_level",
			requirement_value: 5,
		},
		{
			id: "level_10",
			name: "Veteran",
			description: "Reach level 10",
			icon: "🌟",
			category: "progress",
			points: 50,
			requirement_type: "highest_level",
			requirement_value: 10,
		},
		{
			id: "level_15",
			name: "Elite",
			description: "Reach level 15",
			icon: "💫",
			category: "progress",
			points: 100,
			requirement_type: "highest_level",
			requirement_value: 15,
		},
		{
			id: "level_20",
			name: "Legend",
			description: "Reach level 20",
			icon: "👑",
			category: "progress",
			points: 200,
			requirement_type: "highest_level",
			requirement_value: 20,
		},

		// Performance achievements
		{
			id: "coverage_80",
			name: "Perfectionist",
			description: "Achieve 80% coverage in one level",
			icon: "🎯",
			category: "performance",
			points: 25,
			requirement_type: "best_coverage",
			requirement_value: 80,
		},
		{
			id: "coverage_90",
			name: "Master Claimer",
			description: "Achieve 90% coverage in one level",
			icon: "💎",
			category: "performance",
			points: 50,
			requirement_type: "best_coverage",
			requirement_value: 90,
		},
		{
			id: "speed_30",
			name: "Speed Demon",
			description: "Complete a level in under 30 seconds",
			icon: "⚡",
			category: "performance",
			points: 30,
			requirement_type: "fastest_level",
			requirement_value: 30,
		},
		{
			id: "speed_20",
			name: "Lightning Fast",
			description: "Complete a level in under 20 seconds",
			icon: "🚀",
			category: "performance",
			points: 75,
			requirement_type: "fastest_level",
			requirement_value: 20,
		},

		// Streak achievements
		{
			id: "streak_3",
			name: "Warming Up",
			description: "Complete 3 levels in a row without dying",
			icon: "🔥",
			category: "streak",
			points: 15,
			requirement_type: "best_streak",
			requirement_value: 3,
		},
		{
			id: "streak_5",
			name: "On Fire",
			description: "Complete 5 levels in a row without dying",
			icon: "💪",
			category: "streak",
			points: 30,
			requirement_type: "best_streak",
			requirement_value: 5,
		},
		{
			id: "streak_10",
			name: "Unstoppable",
			description: "Complete 10 levels in a row without dying",
			icon: "🌋",
			category: "streak",
			points: 75,
			requirement_type: "best_streak",
			requirement_value: 10,
		},
		{
			id: "streak_20",
			name: "Immortal",
			description: "Complete 20 levels in a row without dying",
			icon: "☄️",
			category: "streak",
			points: 200,
			requirement_type: "best_streak",
			requirement_value: 20,
		},

		// Quiz achievements
		{
			id: "quiz_10",
			name: "Student",
			description: "Answer 10 quiz questions correctly",
			icon: "📚",
			category: "quiz",
			points: 10,
			requirement_type: "quiz_correct",
			requirement_value: 10,
		},
		{
			id: "quiz_50",
			name: "Professor",
			description: "Answer 50 quiz questions correctly",
			icon: "🧠",
			category: "quiz",
			points: 30,
			requirement_type: "quiz_correct",
			requirement_value: 50,
		},
		{
			id: "quiz_100",
			name: "Pokemon Master",
			description: "Answer 100 quiz questions correctly",
			icon: "🎓",
			category: "quiz",
			points: 75,
			requirement_type: "quiz_correct",
			requirement_value: 100,
		},

		// Territory achievements
		{
			id: "territory_100k",
			name: "Homesteader",
			description: "Claim 100,000 total pixels",
			icon: "🏠",
			category: "territory",
			points: 15,
			requirement_type: "total_territory",
			requirement_value: 100000,
		},
		{
			id: "territory_1m",
			name: "Land Baron",
			description: "Claim 1,000,000 total pixels",
			icon: "🏰",
			category: "territory",
			points: 50,
			requirement_type: "total_territory",
			requirement_value: 1000000,
		},
		{
			id: "territory_10m",
			name: "World Dominator",
			description: "Claim 10,000,000 total pixels",
			icon: "🌍",
			category: "territory",
			points: 150,
			requirement_type: "total_territory",
			requirement_value: 10000000,
		},

		// Collection achievements
		{
			id: "pokemon_10",
			name: "Collector",
			description: "Reveal 10 unique Pokemon",
			icon: "🐾",
			category: "collection",
			points: 20,
			requirement_type: "unique_pokemon",
			requirement_value: 10,
		},
		{
			id: "pokemon_50",
			name: "Dex Filler",
			description: "Reveal 50 unique Pokemon",
			icon: "📖",
			category: "collection",
			points: 50,
			requirement_type: "unique_pokemon",
			requirement_value: 50,
		},
		{
			id: "pokemon_100",
			name: "Completionist",
			description: "Reveal 100 unique Pokemon",
			icon: "🏆",
			category: "collection",
			points: 150,
			requirement_type: "unique_pokemon",
			requirement_value: 100,
		},
		{
			id: "pokemon_151",
			name: "Gotta See Em All",
			description: "Reveal all 151 Pokemon",
			icon: "✨",
			category: "collection",
			points: 500,
			requirement_type: "unique_pokemon",
			requirement_value: 151,
		},

		// Score achievements
		{
			id: "score_10k",
			name: "Point Scorer",
			description: "Reach 10,000 total score",
			icon: "💯",
			category: "score",
			points: 15,
			requirement_type: "total_score",
			requirement_value: 10000,
		},
		{
			id: "score_100k",
			name: "High Roller",
			description: "Reach 100,000 total score",
			icon: "💰",
			category: "score",
			points: 50,
			requirement_type: "total_score",
			requirement_value: 100000,
		},
		{
			id: "score_1m",
			name: "Millionaire",
			description: "Reach 1,000,000 total score",
			icon: "🤑",
			category: "score",
			points: 200,
			requirement_type: "total_score",
			requirement_value: 1000000,
		},
	];

	const stmt = db.prepare(`SELECT id FROM achievements WHERE id = ?`);

	achievements.forEach((achievement) => {
		stmt.bind([achievement.id]);
		const exists = stmt.step();
		stmt.reset();

		if (!exists) {
			db.run(
				`
                INSERT INTO achievements (id, name, description, icon, category, points, requirement_type, requirement_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
				[
					achievement.id,
					achievement.name,
					achievement.description,
					achievement.icon,
					achievement.category,
					achievement.points,
					achievement.requirement_type,
					achievement.requirement_value,
				],
			);
		}
	});

	stmt.free();
}

module.exports = { initDatabase, getDb, prepare, saveDatabase };
