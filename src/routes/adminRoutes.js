const express = require('express');
const router = express.Router();
const { adminApiKeyAuth } = require('../middlewares/authMiddleware');
const adminController = require('../controllers/adminController');
const pokemonController = require('../controllers/pokemonController');
const paymentController = require('../controllers/paymentController');

// All admin routes are protected by API key
router.use(adminApiKeyAuth);

// GET /api/admin/users - Get all users with pagination and search
router.get('/users', adminController.getUsers);

// GET /api/admin/users/count - Get total user count
router.get('/users/count', adminController.getUserCount);

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', adminController.getUserById);

// GET /api/admin/users/:id/purchases - Get user's purchase history
router.get('/users/:userId/purchases', paymentController.getPurchaseHistory);

// DELETE /api/admin/users/:id - Delete user by ID
router.delete('/users/:id', adminController.deleteUser);

// POST /api/admin/pokemon/sync - Sync Pokemon database
router.post('/pokemon/sync', pokemonController.syncPokemon);

// POST /api/admin/payments/sync - Sync payments from Razorpay
router.post('/payments/sync', paymentController.syncRazorpayPayments);

module.exports = router;
