const errorHandler = (err, _req, res, _next) => {
	console.error(err.stack);

	res.status(err.status || 500).json({
		success: false,
		message: err.message || "Internal Server Error",
		...(process.env.NODE_ENV === "development" && { stack: err.stack }),
	});
};

module.exports = errorHandler;
