const express = require("express");
const {
	getAllPeekachoos,
	getPeekachooById,
	createPeekachoo,
	updatePeekachoo,
	deletePeekachoo,
} = require("../controllers/peekachooController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// All peekachoo routes require authentication
router.use(authMiddleware);

router.get("/", getAllPeekachoos);
router.get("/:id", getPeekachooById);
router.post("/", createPeekachoo);
router.put("/:id", updatePeekachoo);
router.delete("/:id", deletePeekachoo);

module.exports = router;
