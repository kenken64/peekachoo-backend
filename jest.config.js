/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	roots: ["<rootDir>/src", "<rootDir>/test"],
	testMatch: ["**/*.spec.js", "**/*.test.js"],
	moduleFileExtensions: ["js", "json"],
	setupFilesAfterEnv: ["<rootDir>/test/jest-setup.js"],
	collectCoverageFrom: [
		"src/**/*.js",
		"!src/server.js",
		"!src/config/*.js",
		"!src/app.js", // Express app setup
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html", "json-summary"],
	coverageThreshold: {
		global: {
			branches: 5,
			functions: 10,
			lines: 10,
			statements: 10,
		},
	},
	testTimeout: 10000,
	verbose: true,
	// Handle async operations cleanup
	forceExit: true,
	detectOpenHandles: true,
};
