/**
 * Format response object
 * @param {boolean} success - Whether the operation was successful
 * @param {any} data - The data to return
 * @param {string} message - Optional message
 * @returns {object} Formatted response object
 */
exports.formatResponse = (success, data, message = null) => {
	const response = { success };
	if (data) response.data = data;
	if (message) response.message = message;
	return response;
};

/**
 * Create an error with status code
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Error} Error object with status
 */
exports.createError = (message, status = 500) => {
	const error = new Error(message);
	error.status = status;
	return error;
};

/**
 * Async handler wrapper to avoid try-catch blocks
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
exports.asyncHandler = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};
