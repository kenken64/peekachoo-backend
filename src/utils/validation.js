/**
 * Input validation utilities to prevent XSS and injection attacks
 */

// Regex pattern for valid usernames: alphanumeric, underscores, hyphens, 3-30 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

// Patterns that indicate potential XSS attacks
const XSS_PATTERNS = [
	/<script/i,
	/<\/script/i,
	/javascript:/i,
	/on\w+\s*=/i, // onclick=, onerror=, onload=, etc.
	/<img/i,
	/<svg/i,
	/<iframe/i,
	/<object/i,
	/<embed/i,
	/<link/i,
	/<style/i,
	/<meta/i,
	/<form/i,
	/<input/i,
	/<body/i,
	/<html/i,
	/data:/i,
	/vbscript:/i,
	/expression\s*\(/i,
	/url\s*\(/i,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
	/('\s*(or|and)\s*')/i,
	/(--\s*$)/,
	/(;\s*drop\s+table)/i,
	/(;\s*delete\s+from)/i,
	/(union\s+select)/i,
	/(insert\s+into)/i,
];

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {object} { valid: boolean, error?: string }
 */
exports.validateUsername = (username) => {
	if (!username || typeof username !== 'string') {
		return { valid: false, error: 'Username is required' };
	}

	const trimmed = username.trim();

	if (trimmed.length < 3) {
		return { valid: false, error: 'Username must be at least 3 characters' };
	}

	if (trimmed.length > 30) {
		return { valid: false, error: 'Username must be 30 characters or less' };
	}

	if (!USERNAME_REGEX.test(trimmed)) {
		return {
			valid: false,
			error: 'Username can only contain letters, numbers, underscores, and hyphens',
		};
	}

	return { valid: true };
};

/**
 * Check if input contains potential XSS attack patterns
 * @param {string} input - Input string to check
 * @returns {boolean} true if XSS pattern detected
 */
exports.containsXSS = (input) => {
	if (!input || typeof input !== 'string') {
		return false;
	}

	return XSS_PATTERNS.some((pattern) => pattern.test(input));
};

/**
 * Check if input contains potential SQL injection patterns
 * @param {string} input - Input string to check
 * @returns {boolean} true if SQL injection pattern detected
 */
exports.containsSQLInjection = (input) => {
	if (!input || typeof input !== 'string') {
		return false;
	}

	return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
};

/**
 * Sanitize a string by escaping HTML entities
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
exports.sanitizeHTML = (input) => {
	if (!input || typeof input !== 'string') {
		return '';
	}

	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');
};

/**
 * Validate display name (more permissive than username)
 * @param {string} displayName - Display name to validate
 * @returns {object} { valid: boolean, error?: string, sanitized?: string }
 */
exports.validateDisplayName = (displayName) => {
	if (!displayName || typeof displayName !== 'string') {
		return { valid: true, sanitized: '' }; // Display name is optional
	}

	const trimmed = displayName.trim();

	if (trimmed.length > 50) {
		return { valid: false, error: 'Display name must be 50 characters or less' };
	}

	// Check for XSS patterns
	if (exports.containsXSS(trimmed)) {
		return { valid: false, error: 'Display name contains invalid characters' };
	}

	// Return sanitized version
	return { valid: true, sanitized: exports.sanitizeHTML(trimmed) };
};

/**
 * Comprehensive input validation for user registration
 * @param {object} data - { username, displayName }
 * @returns {object} { valid: boolean, errors: string[], sanitized?: object }
 */
exports.validateRegistrationInput = (data) => {
	const errors = [];
	const sanitized = {};

	// Validate username
	const usernameResult = exports.validateUsername(data.username);
	if (!usernameResult.valid) {
		errors.push(usernameResult.error);
	} else {
		sanitized.username = data.username.trim();
	}

	// Validate display name
	const displayNameResult = exports.validateDisplayName(data.displayName);
	if (!displayNameResult.valid) {
		errors.push(displayNameResult.error);
	} else {
		sanitized.displayName = displayNameResult.sanitized || sanitized.username;
	}

	return {
		valid: errors.length === 0,
		errors,
		sanitized,
	};
};
