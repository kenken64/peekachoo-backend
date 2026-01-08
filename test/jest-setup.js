// Jest setup for backend tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.ADMIN_API_KEY = "test-admin-api-key";

// Increase timeout for async operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
	// Allow pending operations to complete
	await new Promise((resolve) => setTimeout(resolve, 100));
});
