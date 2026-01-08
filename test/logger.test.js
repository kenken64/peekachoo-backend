const logger = require("../src/middlewares/logger");

describe("Logger Middleware", () => {
	let mockReq;
	let mockRes;
	let mockNext;
	let consoleSpy;

	beforeEach(() => {
		mockReq = {
			method: "GET",
			url: "/api/test",
		};
		mockRes = {};
		mockNext = jest.fn();
		consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it("should log the request method and URL", () => {
		logger(mockReq, mockRes, mockNext);

		expect(consoleSpy).toHaveBeenCalled();
		const logMessage = consoleSpy.mock.calls[0][0];
		expect(logMessage).toContain("GET");
		expect(logMessage).toContain("/api/test");
	});

	it("should call next()", () => {
		logger(mockReq, mockRes, mockNext);

		expect(mockNext).toHaveBeenCalled();
	});

	it("should include timestamp in log", () => {
		logger(mockReq, mockRes, mockNext);

		const logMessage = consoleSpy.mock.calls[0][0];
		// Should contain ISO timestamp format
		expect(logMessage).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it("should log POST requests", () => {
		mockReq.method = "POST";
		mockReq.url = "/api/users";

		logger(mockReq, mockRes, mockNext);

		const logMessage = consoleSpy.mock.calls[0][0];
		expect(logMessage).toContain("POST");
		expect(logMessage).toContain("/api/users");
	});

	it("should log DELETE requests", () => {
		mockReq.method = "DELETE";
		mockReq.url = "/api/users/123";

		logger(mockReq, mockRes, mockNext);

		const logMessage = consoleSpy.mock.calls[0][0];
		expect(logMessage).toContain("DELETE");
		expect(logMessage).toContain("/api/users/123");
	});
});
