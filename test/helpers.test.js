const helpers = require("../src/utils/helpers");

describe("Helpers", () => {
	describe("formatResponse", () => {
		it("should create a success response with data", () => {
			const data = { id: 1, name: "test" };
			const response = helpers.formatResponse(true, data);

			expect(response.success).toBe(true);
			expect(response.data).toEqual(data);
			expect(response.message).toBeUndefined();
		});

		it("should create a success response with message", () => {
			const response = helpers.formatResponse(
				true,
				null,
				"Operation successful",
			);

			expect(response.success).toBe(true);
			expect(response.data).toBeUndefined();
			expect(response.message).toBe("Operation successful");
		});

		it("should create a success response with data and message", () => {
			const data = { id: 1 };
			const response = helpers.formatResponse(true, data, "Created");

			expect(response.success).toBe(true);
			expect(response.data).toEqual(data);
			expect(response.message).toBe("Created");
		});

		it("should create an error response", () => {
			const response = helpers.formatResponse(false, null, "Error occurred");

			expect(response.success).toBe(false);
			expect(response.message).toBe("Error occurred");
		});
	});

	describe("createError", () => {
		it("should create an error with default status 500", () => {
			const error = helpers.createError("Something went wrong");

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("Something went wrong");
			expect(error.status).toBe(500);
		});

		it("should create an error with custom status", () => {
			const error = helpers.createError("Not found", 404);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("Not found");
			expect(error.status).toBe(404);
		});

		it("should create an error with 400 status", () => {
			const error = helpers.createError("Bad request", 400);

			expect(error.status).toBe(400);
		});

		it("should create an error with 401 status", () => {
			const error = helpers.createError("Unauthorized", 401);

			expect(error.status).toBe(401);
		});
	});

	describe("asyncHandler", () => {
		it("should call the wrapped function", async () => {
			const mockFn = jest.fn().mockResolvedValue("result");
			const mockReq = {};
			const mockRes = {};
			const mockNext = jest.fn();

			const handler = helpers.asyncHandler(mockFn);
			await handler(mockReq, mockRes, mockNext);

			expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
		});

		it("should pass errors to next on rejection", async () => {
			const error = new Error("Async error");
			const mockFn = jest.fn().mockRejectedValue(error);
			const mockReq = {};
			const mockRes = {};
			const mockNext = jest.fn();

			const handler = helpers.asyncHandler(mockFn);
			await handler(mockReq, mockRes, mockNext);

			expect(mockNext).toHaveBeenCalledWith(error);
		});

		it("should handle synchronous functions that return a value", async () => {
			const mockFn = jest.fn().mockReturnValue("sync result");
			const mockReq = {};
			const mockRes = {};
			const mockNext = jest.fn();

			const handler = helpers.asyncHandler(mockFn);
			await handler(mockReq, mockRes, mockNext);

			expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
		});
	});
});
