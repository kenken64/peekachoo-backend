/**
 * Tests for Peekachoo Controller
 */

const peekachooService = require("../../src/services/peekachooService");
const peekachooController = require("../../src/controllers/peekachooController");

// Mock the service
jest.mock("../../src/services/peekachooService");

// Helper to create mock request/response
const createMockReqRes = (params = {}, body = {}) => {
	const req = {
		params,
		body,
	};
	const res = {
		json: jest.fn().mockReturnThis(),
		status: jest.fn().mockReturnThis(),
	};
	const next = jest.fn();
	return { req, res, next };
};

describe("PeekachooController", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getAllPeekachoos", () => {
		it("should return all peekachoos with success", async () => {
			const mockData = [
				{ id: 1, name: "Test1" },
				{ id: 2, name: "Test2" },
			];
			peekachooService.getAllPeekachoos.mockResolvedValue(mockData);

			const { req, res, next } = createMockReqRes();
			await peekachooController.getAllPeekachoos(req, res, next);

			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should call next on error", async () => {
			const error = new Error("Database error");
			peekachooService.getAllPeekachoos.mockRejectedValue(error);

			const { req, res, next } = createMockReqRes();
			await peekachooController.getAllPeekachoos(req, res, next);

			expect(next).toHaveBeenCalledWith(error);
		});
	});

	describe("getPeekachooById", () => {
		it("should return peekachoo when found", async () => {
			const mockData = { id: 1, name: "Test" };
			peekachooService.getPeekachooById.mockResolvedValue(mockData);

			const { req, res, next } = createMockReqRes({ id: "1" });
			await peekachooController.getPeekachooById(req, res, next);

			expect(peekachooService.getPeekachooById).toHaveBeenCalledWith("1");
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			});
		});

		it("should return 404 when not found", async () => {
			peekachooService.getPeekachooById.mockResolvedValue(null);

			const { req, res, next } = createMockReqRes({ id: "999" });
			await peekachooController.getPeekachooById(req, res, next);

			expect(res.status).toHaveBeenCalledWith(404);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Peekachoo not found",
			});
		});

		it("should call next on error", async () => {
			const error = new Error("Database error");
			peekachooService.getPeekachooById.mockRejectedValue(error);

			const { req, res, next } = createMockReqRes({ id: "1" });
			await peekachooController.getPeekachooById(req, res, next);

			expect(next).toHaveBeenCalledWith(error);
		});
	});

	describe("createPeekachoo", () => {
		it("should create and return new peekachoo with 201 status", async () => {
			const inputData = { name: "New", description: "Desc" };
			const mockCreated = { id: 1, ...inputData };
			peekachooService.createPeekachoo.mockResolvedValue(mockCreated);

			const { req, res, next } = createMockReqRes({}, inputData);
			await peekachooController.createPeekachoo(req, res, next);

			expect(peekachooService.createPeekachoo).toHaveBeenCalledWith(inputData);
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: mockCreated,
			});
		});

		it("should call next on error", async () => {
			const error = new Error("Validation error");
			peekachooService.createPeekachoo.mockRejectedValue(error);

			const { req, res, next } = createMockReqRes({}, { name: "Test" });
			await peekachooController.createPeekachoo(req, res, next);

			expect(next).toHaveBeenCalledWith(error);
		});
	});

	describe("updatePeekachoo", () => {
		it("should update and return peekachoo when found", async () => {
			const updateData = { name: "Updated" };
			const mockUpdated = { id: 1, name: "Updated" };
			peekachooService.updatePeekachoo.mockResolvedValue(mockUpdated);

			const { req, res, next } = createMockReqRes({ id: "1" }, updateData);
			await peekachooController.updatePeekachoo(req, res, next);

			expect(peekachooService.updatePeekachoo).toHaveBeenCalledWith(
				"1",
				updateData,
			);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: mockUpdated,
			});
		});

		it("should return 404 when not found", async () => {
			peekachooService.updatePeekachoo.mockResolvedValue(null);

			const { req, res, next } = createMockReqRes({ id: "999" }, { name: "Test" });
			await peekachooController.updatePeekachoo(req, res, next);

			expect(res.status).toHaveBeenCalledWith(404);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Peekachoo not found",
			});
		});

		it("should call next on error", async () => {
			const error = new Error("Database error");
			peekachooService.updatePeekachoo.mockRejectedValue(error);

			const { req, res, next } = createMockReqRes({ id: "1" }, { name: "Test" });
			await peekachooController.updatePeekachoo(req, res, next);

			expect(next).toHaveBeenCalledWith(error);
		});
	});

	describe("deletePeekachoo", () => {
		it("should delete and return success message when found", async () => {
			const mockDeleted = { id: 1, name: "Deleted" };
			peekachooService.deletePeekachoo.mockResolvedValue(mockDeleted);

			const { req, res, next } = createMockReqRes({ id: "1" });
			await peekachooController.deletePeekachoo(req, res, next);

			expect(peekachooService.deletePeekachoo).toHaveBeenCalledWith("1");
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Peekachoo deleted successfully",
			});
		});

		it("should return 404 when not found", async () => {
			peekachooService.deletePeekachoo.mockResolvedValue(null);

			const { req, res, next } = createMockReqRes({ id: "999" });
			await peekachooController.deletePeekachoo(req, res, next);

			expect(res.status).toHaveBeenCalledWith(404);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				message: "Peekachoo not found",
			});
		});

		it("should call next on error", async () => {
			const error = new Error("Database error");
			peekachooService.deletePeekachoo.mockRejectedValue(error);

			const { req, res, next } = createMockReqRes({ id: "1" });
			await peekachooController.deletePeekachoo(req, res, next);

			expect(next).toHaveBeenCalledWith(error);
		});
	});
});
