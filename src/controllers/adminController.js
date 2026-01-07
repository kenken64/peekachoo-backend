const { getDb, prepare, saveDatabase } = require("../config/sqlite");

/**
 * Get all users with pagination and search
 */
const getUsers = async (req, res) => {
	try {
		const db = getDb();
		const search = req.query.search || "";
		const page = parseInt(req.query.page, 10) || 1;
		const pageSize = parseInt(req.query.pageSize, 10) || 30;
		const offset = (page - 1) * pageSize;
		const sortBy = req.query.sortBy || "created_at";
		const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";

		// Validate sortBy to prevent SQL injection
		const allowedSortColumns = [
			"username",
			"created_at",
			"total_spent",
			"shields",
			"total_shields_purchased",
			"monthly_spent",
			"purchase_reset_date",
		];
		const sortColumn = allowedSortColumns.includes(sortBy)
			? sortBy
			: "created_at";

		// Get total count
		let countQuery = "SELECT COUNT(*) as total FROM users";
		let dataQuery =
			"SELECT id, username, display_name, created_at, updated_at, shields, total_shields_purchased, total_spent, monthly_spent, first_purchase_date, purchase_reset_date FROM users";

		if (search) {
			const whereClause = " WHERE username LIKE ?";
			countQuery += whereClause;
			dataQuery += whereClause;
		}

		dataQuery += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;

		// Execute count query
		const countStmt = db.prepare(countQuery);
		if (search) {
			countStmt.bind([`%${search}%`]);
		}
		let total = 0;
		if (countStmt.step()) {
			total = countStmt.getAsObject().total;
		}
		countStmt.free();

		// Execute data query
		const dataStmt = db.prepare(dataQuery);
		if (search) {
			dataStmt.bind([`%${search}%`, pageSize, offset]);
		} else {
			dataStmt.bind([pageSize, offset]);
		}

		const users = [];
		while (dataStmt.step()) {
			users.push(dataStmt.getAsObject());
		}
		dataStmt.free();

		// Get global stats
		const statsQuery =
			"SELECT SUM(total_shields_purchased) as totalShields, SUM(total_spent) as totalRevenue FROM users";
		const statsStmt = db.prepare(statsQuery);
		const globalStats = { totalShields: 0, totalRevenue: 0 };
		if (statsStmt.step()) {
			const result = statsStmt.getAsObject();
			globalStats.totalShields = result.totalShields || 0;
			globalStats.totalRevenue = result.totalRevenue || 0;
		}
		statsStmt.free();

		const totalPages = Math.ceil(total / pageSize);

		res.json({
			success: true,
			data: {
				users,
				globalStats,
				pagination: {
					total,
					page,
					pageSize,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
			},
		});
	} catch (error) {
		console.error("Error getting users:", error);
		res.status(500).json({ success: false, error: "Failed to get users" });
	}
};

/**
 * Get a single user by ID
 */
const getUserById = async (req, res) => {
	try {
		const { id } = req.params;
		const user = prepare(
			"SELECT id, username, display_name, created_at, updated_at, shields, total_shields_purchased, total_spent FROM users WHERE id = ?",
		).get(id);

		if (!user) {
			return res.status(404).json({ success: false, error: "User not found" });
		}

		res.json({ success: true, data: user });
	} catch (error) {
		console.error("Error getting user:", error);
		res.status(500).json({ success: false, error: "Failed to get user" });
	}
};

/**
 * Delete a user by ID (cascades to related data)
 */
const deleteUser = async (req, res) => {
	try {
		const { id } = req.params;
		const db = getDb();

		// Check if user exists
		const user = prepare("SELECT id, username FROM users WHERE id = ?").get(id);
		if (!user) {
			return res.status(404).json({ success: false, error: "User not found" });
		}

		// Delete user (foreign key constraints will cascade delete related data)
		db.run("DELETE FROM users WHERE id = ?", [id]);
		saveDatabase();

		res.json({
			success: true,
			message: `User ${user.username} deleted successfully`,
			deletedUserId: id,
		});
	} catch (error) {
		console.error("Error deleting user:", error);
		res.status(500).json({ success: false, error: "Failed to delete user" });
	}
};

/**
 * Get total user count
 */
const getUserCount = async (_req, res) => {
	try {
		const db = getDb();
		const stmt = db.prepare("SELECT COUNT(*) as total FROM users");
		let total = 0;
		if (stmt.step()) {
			total = stmt.getAsObject().total;
		}
		stmt.free();

		res.json({ success: true, data: { total } });
	} catch (error) {
		console.error("Error getting user count:", error);
		res.status(500).json({ success: false, error: "Failed to get user count" });
	}
};

module.exports = {
	getUsers,
	getUserById,
	deleteUser,
	getUserCount,
};
