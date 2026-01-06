const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.get('/purchase-status', authMiddleware, paymentController.checkPurchaseStatus);
router.post('/create-order', authMiddleware, paymentController.createOrder);
router.post('/verify-payment', authMiddleware, paymentController.verifyPayment);
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
