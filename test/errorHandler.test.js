const errorHandler = require("../src/middlewares/errorHandler");

describe("Error Handler Middleware", () => {
	let mockReq;
	let mockRes;
	let mockNext;
	let consoleSpy;

	beforeEach(() => {
		mockReq = {};
		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};
		mockNext = jest.fn();
		consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it("should return 500 status for errors without status", () => {
		const error = new Error("Something went wrong");

		errorHandler(error, mockReq, mockRes, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(500);
		expect(mockRes.json).toHaveBeenCalledWith(
			expect.objectContaining({
				success: false,
				message: "Something went wrong",
			}),
		);
	});

	it("should use error status if provided", () => {
		const error = new Error("Not found");
		error.status = 404;

		errorHandler(error, mockReq, mockRes, mockNext);

		expect(mockRes.status).toHaveBeenCalledWith(404);
		expect(mockRes.json).toHaveBeenCalledWith(
			expect.objectContaining({
				success: false,
				message: "Not found",
			}),
		);
	});

	it("should use default message if error has no message", () => {
		const error = new Error();
		error.message = "";

		errorHandler(error, mockReq, mockRes, mockNext);

		expect(mockRes.json).toHaveBeenCalledWith(
			expect.objectContaining({
				success: false,
				message: "Internal Server Error",
			}),
		);
	});

	it("should log error stack", () => {
		const error = new Error("Test error");

		errorHandler(error, mockReq, mockRes, mockNext);

		expect(consoleSpy).toHaveBeenCalled();
	});

	it("should include stack trace in development mode", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const error = new Error("Dev error");
		error.stack = "Error stack trace";

		errorHandler(error, mockReq, mockRes, mockNext);

		expect(mockRes.json).toHaveBeenCalledWith(
			expect.objectContaining({
				stack: "Error stack trace",
			}),
		);

		process.env.NODE_ENV = originalEnv;
	});

	it("should not include stack trace in production mode", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const error = new Error("Prod error");

		errorHandler(error, mockReq, mockRes, mockNext);

		const jsonCall = mockRes.json.mock.calls[0][0];
		expect(jsonCall.stack).toBeUndefined();

		process.env.NODE_ENV = originalEnv;
	});
});
