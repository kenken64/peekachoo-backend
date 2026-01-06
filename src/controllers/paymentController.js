const Razorpay = require('razorpay');
const crypto = require('crypto');
const { prepare, saveDatabase } = require('../config/sqlite');
const { razorpay: razorpayConfig } = require('../config/config');

const razorpay = new Razorpay({
    key_id: razorpayConfig.key_id,
    key_secret: razorpayConfig.key_secret
});

exports.createOrder = async (req, res) => {
    try {
        const { quantity } = req.body;
        const qty = parseInt(quantity) || 1;
        if (qty < 1) return res.status(400).json({ error: 'Invalid quantity' });

        // Price configuration
        const unitPriceUSD = 0.20;
        const unitPriceCents = unitPriceUSD * 100;
        
        const options = {
            amount: Math.round(qty * unitPriceCents), // Amount in smallest currency unit
            currency: 'USD',
            receipt: `receipt_${Date.now().toString().slice(-10)}_${req.user.id.slice(0, 5)}`,
            notes: {
                userId: req.user.id,
                quantity: qty.toString()
            }
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            quantity 
        } = req.body;

        const generated_signature = crypto
            .createHmac('sha256', razorpayConfig.key_secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
             // Payment successful
             const qty = parseInt(quantity) || 1;
             const unitPrice = 0.20;
             const cost = qty * unitPrice;

             // Ensure this payment hasn't been processed yet 
             // (Ideally we should store payment_id in a payments table to prevent replay attacks)
             // For now, allow it but log it.
             console.log(`Processing valid payment ${razorpay_payment_id} for user ${req.user.id}`);
             
             // Update user
             prepare(`
                UPDATE users 
                SET 
                    shields = COALESCE(shields, 0) + ?,
                    total_shields_purchased = COALESCE(total_shields_purchased, 0) + ?,
                    total_spent = COALESCE(total_spent, 0) + ?
                WHERE id = ?
            `).run(qty, qty, cost, req.user.id);
            
            saveDatabase();
            
            const user = prepare('SELECT shields FROM users WHERE id = ?').get(req.user.id);
            
            res.json({ success: true, shields: user.shields });
        } else {
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: error.message });
    }
};
