const express = require("express");
const cors = require("cors");
const logger = require("./middlewares/logger");
const errorHandler = require("./middlewares/errorHandler");
const routes = require("./routes");

const app = express();

// Middleware
app.use(cors());
app.use(
	express.json({
		verify: (req, _res, buf) => {
			req.rawBody = buf;
		},
	}),
);
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Health check endpoint
app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		message: "Peekachoo backend is running!",
		timestamp: new Date().toISOString(),
	});
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((_req, res) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
	});
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
