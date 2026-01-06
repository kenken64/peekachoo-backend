const Razorpay = require('razorpay');
const crypto = require('crypto');
const { prepare, saveDatabase } = require('../config/sqlite');
const { razorpay: razorpayConfig } = require('../config/config');

let razorpay;
try {
    razorpay = new Razorpay({
        key_id: razorpayConfig.key_id,
        key_secret: razorpayConfig.key_secret
    });
} catch (error) {
    console.error('Failed to initialize Razorpay:', error.message);
    // Do not crash, just log. createOrder will fail if called.
}

exports.createOrder = async (req, res) => {
    if (!razorpay) {
        return res.status(503).json({ error: 'Payment service unavailable (configuration error)' });
    }
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

exports.handleWebhook = async (req, res) => {
    try {
        const secret = razorpayConfig.webhook_secret;
        const signature = req.headers['x-razorpay-signature'];
        
        // Use rawBody if available (from app.js change), else JSONstringify body (fallback, unreliable)
        const body = req.rawBody ? req.rawBody : JSON.stringify(req.body);

        const isValid = Razorpay.validateWebhookSignature(body, signature, secret);

        if (isValid) {
            console.log('Webhook signature verified');
            // Process event if needed
            // const event = req.body.event;
            
            res.json({ status: 'ok' });
        } else {
            console.error('Invalid webhook signature');
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: error.message });
    }
};
