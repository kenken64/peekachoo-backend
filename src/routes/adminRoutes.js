const express = require('express');
const router = express.Router();
const { adminApiKeyAuth } = require('../middlewares/authMiddleware');
const adminController = require('../controllers/adminController');

// All admin routes are protected by API key
router.use(adminApiKeyAuth);

// GET /api/admin/users - Get all users with pagination and search
router.get('/users', adminController.getUsers);

// GET /api/admin/users/count - Get total user count
router.get('/users/count', adminController.getUserCount);

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', adminController.getUserById);

// DELETE /api/admin/users/:id - Delete user by ID
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
