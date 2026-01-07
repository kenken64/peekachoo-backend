const jwt = require("jsonwebtoken");
const { jwtSecret, adminApiKey } = require("../config/config");

const authMiddleware = (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader) {
			return res
				.status(401)
				.json({ error: "No authorization header provided" });
		}

		const token = authHeader.split(" ")[1]; // Bearer <token>

		if (!token) {
			return res.status(401).json({ error: "No token provided" });
		}

		const decoded = jwt.verify(token, jwtSecret);
		req.user = decoded;
		next();
	} catch (error) {
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Token expired" });
		}
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({ error: "Invalid token" });
		}
		return res.status(500).json({ error: "Authentication failed" });
	}
};

// Optional auth - sets user if token present but doesn't require it
const optionalAuth = (req, _res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (authHeader) {
			const token = authHeader.split(" ")[1];
			if (token) {
				const decoded = jwt.verify(token, jwtSecret);
				req.user = decoded;
			}
		}
		next();
	} catch (_error) {
		// Token invalid but continue without user
		next();
	}
};

// Admin API key authentication middleware
const adminApiKeyAuth = (req, res, next) => {
	try {
		const apiKey = req.headers["x-api-key"];

		if (!apiKey) {
			return res.status(401).json({ error: "No API key provided" });
		}

		if (apiKey !== adminApiKey) {
			return res.status(403).json({ error: "Invalid API key" });
		}

		next();
	} catch (_error) {
		return res.status(500).json({ error: "API key authentication failed" });
	}
};

module.exports = { authMiddleware, optionalAuth, adminApiKeyAuth };
