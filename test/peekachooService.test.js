/**
 * Tests for Peekachoo Service
 */

const peekachooService = require("../src/services/peekachooService");

describe("PeekachooService", () => {
	describe("getAllPeekachoos", () => {
		it("should return all peekachoos", async () => {
			const result = await peekachooService.getAllPeekachoos();
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should return items with id and name", async () => {
			const result = await peekachooService.getAllPeekachoos();
			expect(result[0]).toHaveProperty("id");
			expect(result[0]).toHaveProperty("name");
		});
	});

	describe("getPeekachooById", () => {
		it("should return a peekachoo by id", async () => {
			const result = await peekachooService.getPeekachooById(1);
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});

		it("should return undefined for non-existent id", async () => {
			const result = await peekachooService.getPeekachooById(999);
			expect(result).toBeUndefined();
		});

		it("should handle string id", async () => {
			const result = await peekachooService.getPeekachooById("1");
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});
	});

	describe("createPeekachoo", () => {
		it("should create a new peekachoo", async () => {
			const newData = { name: "Test Peekachoo", description: "Test description" };
			const result = await peekachooService.createPeekachoo(newData);

			expect(result).toBeDefined();
			expect(result.id).toBeDefined();
			expect(result.name).toBe("Test Peekachoo");
			expect(result.description).toBe("Test description");
		});

		it("should assign incremental id", async () => {
			const initialItems = await peekachooService.getAllPeekachoos();
			const initialCount = initialItems.length;

			const result = await peekachooService.createPeekachoo({ name: "Another" });
			expect(result.id).toBe(initialCount + 1);
		});
	});

	describe("updatePeekachoo", () => {
		it("should update an existing peekachoo", async () => {
			const result = await peekachooService.updatePeekachoo(1, {
				name: "Updated Name",
			});

			expect(result).toBeDefined();
			expect(result.name).toBe("Updated Name");
		});

		it("should return null for non-existent id", async () => {
			const result = await peekachooService.updatePeekachoo(999, {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("should preserve existing fields when updating", async () => {
			// First create one
			const created = await peekachooService.createPeekachoo({
				name: "Original",
				description: "Original desc",
			});

			// Update only name
			const updated = await peekachooService.updatePeekachoo(created.id, {
				name: "New Name",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.description).toBe("Original desc");
		});
	});

	describe("deletePeekachoo", () => {
		it("should delete an existing peekachoo", async () => {
			// Create one to delete
			const created = await peekachooService.createPeekachoo({
				name: "To Delete",
			});

			const result = await peekachooService.deletePeekachoo(created.id);
			expect(result).toBeDefined();
			expect(result.name).toBe("To Delete");

			// Verify it's deleted
			const findDeleted = await peekachooService.getPeekachooById(created.id);
			expect(findDeleted).toBeUndefined();
		});

		it("should return null for non-existent id", async () => {
			const result = await peekachooService.deletePeekachoo(999);
			expect(result).toBeNull();
		});
	});
});
