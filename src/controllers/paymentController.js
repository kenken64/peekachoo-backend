const crypto = require('crypto');
const { prepare, saveDatabase } = require('../config/sqlite');
const { razorpay: razorpayConfig } = require('../config/config');

// Monthly spending limit in SGD
const MONTHLY_LIMIT_SGD = 50.00;

let razorpay = null;
let RazorpayClass = null;
try {
    RazorpayClass = require('razorpay');
    razorpay = new RazorpayClass({
        key_id: razorpayConfig.key_id,
        key_secret: razorpayConfig.key_secret
    });
    console.log('Razorpay initialized successfully');
} catch (error) {
    console.error('Failed to initialize Razorpay:', error.message);
    // Do not crash, just log. createOrder will fail if called.
}

// Helper: Get first day of next month
function getNextMonthFirstDay(date) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
}

// Helper: Check and reset monthly spending if needed
function checkAndResetMonthlySpending(userId) {
    const user = prepare(`
        SELECT monthly_spent, first_purchase_date, purchase_reset_date 
        FROM users WHERE id = ?
    `).get(userId);

    if (!user) return null;

    const now = new Date();
    const resetDate = user.purchase_reset_date ? new Date(user.purchase_reset_date) : null;

    // If reset date has passed, reset the monthly spending
    if (resetDate && now >= resetDate) {
        prepare(`
            UPDATE users 
            SET monthly_spent = 0, first_purchase_date = NULL, purchase_reset_date = NULL 
            WHERE id = ?
        `).run(userId);
        saveDatabase();
        return { monthly_spent: 0, first_purchase_date: null, purchase_reset_date: null };
    }

    return user;
}

// Check if user can purchase (API endpoint)
exports.checkPurchaseStatus = async (req, res) => {
    try {
        const userStatus = checkAndResetMonthlySpending(req.user.id);
        if (!userStatus) {
            return res.status(404).json({ error: 'User not found' });
        }

        const monthlySpent = userStatus.monthly_spent || 0;
        const remainingAllowance = Math.max(0, MONTHLY_LIMIT_SGD - monthlySpent);
        const canPurchase = remainingAllowance > 0;

        // Calculate reset date if we have a first purchase date but no reset date
        let purchaseResetDate = userStatus.purchase_reset_date;
        if (userStatus.first_purchase_date && !purchaseResetDate) {
            purchaseResetDate = getNextMonthFirstDay(userStatus.first_purchase_date);
            // Update the database with the calculated reset date
            prepare(`UPDATE users SET purchase_reset_date = ? WHERE id = ?`).run(purchaseResetDate, req.user.id);
            saveDatabase();
        }

        res.json({
            canPurchase,
            monthlySpent,
            monthlyLimit: MONTHLY_LIMIT_SGD,
            remainingAllowance,
            firstPurchaseDate: userStatus.first_purchase_date,
            purchaseResetDate: purchaseResetDate
        });
    } catch (error) {
        console.error('Check purchase status error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.createOrder = async (req, res) => {
    if (!razorpay) {
        return res.status(503).json({ error: 'Payment service unavailable (configuration error)' });
    }
    try {
        const { quantity } = req.body;
        const qty = parseInt(quantity) || 1;
        if (qty < 1) return res.status(400).json({ error: 'Invalid quantity' });

        // Price configuration in SGD (unit price: SGD $0.27 ≈ USD $0.20)
        const unitPriceSGD = 0.27;
        const orderAmountSGD = qty * unitPriceSGD;

        // Check monthly limit
        const userStatus = checkAndResetMonthlySpending(req.user.id);
        if (!userStatus) {
            return res.status(404).json({ error: 'User not found' });
        }

        const monthlySpent = userStatus.monthly_spent || 0;
        const remainingAllowance = MONTHLY_LIMIT_SGD - monthlySpent;

        if (orderAmountSGD > remainingAllowance) {
            return res.status(400).json({ 
                error: 'Monthly purchase limit exceeded',
                monthlySpent,
                monthlyLimit: MONTHLY_LIMIT_SGD,
                remainingAllowance,
                requestedAmount: orderAmountSGD
            });
        }
        
        // Razorpay uses USD - convert SGD to USD for payment (1 SGD ≈ 0.74 USD)
        const SGD_TO_USD = 0.74;
        const orderAmountUSD = orderAmountSGD * SGD_TO_USD;
        const amountCents = Math.round(orderAmountUSD * 100);
        
        // Get username for Razorpay notes
        const userInfo = prepare('SELECT username FROM users WHERE id = ?').get(req.user.id);
        const username = userInfo?.username || 'Unknown';
        
        const options = {
            amount: amountCents, // Amount in smallest currency unit (cents)
            currency: 'USD',
            receipt: `receipt_${Date.now().toString().slice(-10)}_${req.user.id.slice(0, 5)}`,
            notes: {
                userId: req.user.id,
                username: username,
                quantity: qty.toString(),
                amountSGD: orderAmountSGD.toFixed(2)
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
             let qty = parseInt(quantity) || 0;
             
             // If quantity not provided, try to fetch from Razorpay order notes
             if (!qty && razorpay && razorpay_order_id) {
                 try {
                     const order = await razorpay.orders.fetch(razorpay_order_id);
                     qty = parseInt(order.notes?.quantity) || 1;
                     console.log(`Fetched quantity ${qty} from Razorpay order notes`);
                 } catch (e) {
                     console.error('Failed to fetch order from Razorpay:', e.message);
                     qty = 1;
                 }
             }
             
             if (!qty) qty = 1; // Final fallback
             
             // Price in SGD (unit price: SGD $0.27 ≈ USD $0.20)
             const unitPriceSGD = 0.27;
             const costSGD = qty * unitPriceSGD;

             console.log(`Processing valid payment ${razorpay_payment_id} for user ${req.user.id}, qty: ${qty}, cost: SGD ${costSGD}`);
             
             // Get current user data
             const currentUser = prepare('SELECT first_purchase_date, purchase_reset_date FROM users WHERE id = ?').get(req.user.id);
             
             const now = new Date().toISOString();
             
             // Always set first_purchase_date if not already set (check for null, undefined, or empty string)
             const firstPurchaseDate = (currentUser?.first_purchase_date && currentUser.first_purchase_date.length > 0) 
                 ? currentUser.first_purchase_date 
                 : now;
             
             // Calculate reset date (first day of next month from first purchase)
             const purchaseResetDate = getNextMonthFirstDay(firstPurchaseDate);
             
             console.log(`Setting first_purchase_date: ${firstPurchaseDate}, purchase_reset_date: ${purchaseResetDate}`);

             // Generate purchase ID
             const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

             // Record individual purchase
             prepare(`
                INSERT INTO purchases (id, user_id, quantity, amount_sgd, razorpay_order_id, razorpay_payment_id, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
             `).run(purchaseId, req.user.id, qty, costSGD, razorpay_order_id, razorpay_payment_id, now);

             // Update user with shields and monthly tracking (all in SGD)
             // Always set first_purchase_date and purchase_reset_date explicitly
             prepare(`
                UPDATE users 
                SET 
                    shields = COALESCE(shields, 0) + ?,
                    total_shields_purchased = COALESCE(total_shields_purchased, 0) + ?,
                    total_spent = COALESCE(total_spent, 0) + ?,
                    monthly_spent = COALESCE(monthly_spent, 0) + ?,
                    first_purchase_date = ?,
                    purchase_reset_date = ?
                WHERE id = ?
            `).run(qty, qty, costSGD, costSGD, firstPurchaseDate, purchaseResetDate, req.user.id);
            
            saveDatabase();
            
            const user = prepare('SELECT shields, monthly_spent, purchase_reset_date FROM users WHERE id = ?').get(req.user.id);
            
            res.json({ 
                success: true, 
                shields: user.shields,
                monthlySpent: user.monthly_spent,
                purchaseResetDate: user.purchase_reset_date,
                remainingAllowance: Math.max(0, MONTHLY_LIMIT_SGD - user.monthly_spent)
            });
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
        if (!RazorpayClass) {
            return res.status(503).json({ error: 'Payment service unavailable' });
        }
        const secret = razorpayConfig.webhook_secret;
        const signature = req.headers['x-razorpay-signature'];
        
        // Use rawBody if available (from app.js change), else JSONstringify body (fallback, unreliable)
        const body = req.rawBody ? req.rawBody : JSON.stringify(req.body);

        const isValid = RazorpayClass.validateWebhookSignature(body, signature, secret);

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

// Get purchase history for a specific user (admin endpoint)
exports.getPurchaseHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const purchases = prepare(`
            SELECT id, quantity, amount_sgd, razorpay_order_id, razorpay_payment_id, status, created_at
            FROM purchases 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId);
        
        res.json({ purchases });
    } catch (error) {
        console.error('Get purchase history error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Sync payments from Razorpay (admin endpoint)
exports.syncRazorpayPayments = async (req, res) => {
    if (!razorpay) {
        return res.status(503).json({ error: 'Razorpay not configured' });
    }

    try {
        console.log('[Razorpay Sync] Starting sync...');
        
        const results = {
            fetched: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
            usersRecalculated: 0
        };

        // Fetch orders from Razorpay (last 30 days) - orders have the notes with userId
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        
        let orders = [];
        let skip = 0;
        const count = 100;
        
        // Paginate through all orders
        console.log('[Razorpay Sync] Fetching orders from Razorpay...');
        try {
            while (true) {
                console.log(`[Razorpay Sync] Fetching orders batch, skip=${skip}...`);
                const batch = await razorpay.orders.all({
                    from: thirtyDaysAgo,
                    count: count,
                    skip: skip
                });
                
                console.log(`[Razorpay Sync] Batch received: ${batch.items?.length || 0} orders`);
                
                if (!batch.items || batch.items.length === 0) break;
                
                orders = orders.concat(batch.items);
                skip += batch.items.length;
                
                if (batch.items.length < count) break;
                
                // Safety limit to prevent infinite loops
                if (orders.length > 1000) {
                    console.log('[Razorpay Sync] Reached safety limit of 1000 orders');
                    break;
                }
            }
        } catch (fetchError) {
            console.error('[Razorpay Sync] Error fetching orders:', fetchError);
            return res.status(500).json({ error: `Failed to fetch orders from Razorpay: ${fetchError.message}` });
        }
        
        results.fetched = orders.length;
        console.log(`[Razorpay Sync] Fetched ${orders.length} orders from Razorpay`);

        const affectedUserIds = new Set();

        for (const order of orders) {
            try {
                // Only process paid orders
                if (order.status !== 'paid') {
                    results.skipped++;
                    continue;
                }

                const orderId = order.id;
                const userId = order.notes?.userId;
                const quantity = parseInt(order.notes?.quantity) || 1;
                const amountSGD = parseFloat(order.notes?.amountSGD) || (quantity * 0.27);
                const createdAt = new Date(order.created_at * 1000).toISOString();

                if (!userId) {
                    console.warn(`[Razorpay Sync] No userId in order ${orderId} notes, skipping`);
                    results.skipped++;
                    continue;
                }

                // Check if user exists
                const user = prepare('SELECT id FROM users WHERE id = ?').get(userId);
                if (!user) {
                    console.warn(`[Razorpay Sync] User ${userId} not found, skipping`);
                    results.skipped++;
                    continue;
                }

                // Get payment ID for this order (fetch payments for the order)
                let paymentId = null;
                try {
                    const payments = await razorpay.orders.fetchPayments(orderId);
                    if (payments.items && payments.items.length > 0) {
                        // Get the first captured payment
                        const capturedPayment = payments.items.find(p => p.status === 'captured');
                        if (capturedPayment) {
                            paymentId = capturedPayment.id;
                        }
                    }
                } catch (e) {
                    console.warn(`[Razorpay Sync] Could not fetch payments for order ${orderId}:`, e.message);
                }

                // Check if this order already exists in purchases
                const existingPurchase = prepare(`
                    SELECT id, quantity, amount_sgd FROM purchases WHERE razorpay_order_id = ?
                `).get(orderId);

                affectedUserIds.add(userId);

                if (existingPurchase) {
                    // Always update to ensure created_at is correct
                    prepare(`
                        UPDATE purchases 
                        SET quantity = ?, amount_sgd = ?, razorpay_payment_id = COALESCE(?, razorpay_payment_id), created_at = ?
                        WHERE razorpay_order_id = ?
                    `).run(quantity, amountSGD, paymentId, createdAt, orderId);
                    
                    if (existingPurchase.quantity !== quantity || Math.abs(existingPurchase.amount_sgd - amountSGD) > 0.01) {
                        results.updated++;
                        console.log(`[Razorpay Sync] Updated purchase ${orderId}: qty=${quantity}, amt=${amountSGD}, date=${createdAt}`);
                    } else {
                        results.skipped++;
                    }
                } else {
                    // Create new purchase record
                    const purchaseId = `pur_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    prepare(`
                        INSERT INTO purchases (id, user_id, quantity, amount_sgd, razorpay_order_id, razorpay_payment_id, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
                    `).run(purchaseId, userId, quantity, amountSGD, orderId, paymentId, createdAt);
                    results.created++;
                    console.log(`[Razorpay Sync] Created purchase ${paymentId}: user=${userId}, qty=${quantity}, amt=${amountSGD}`);
                }

            } catch (e) {
                console.error(`[Razorpay Sync] Error processing order ${orderId}:`, e.message);
                results.errors.push(`Error processing ${orderId}: ${e.message}`);
            }
        }

        // Recalculate totals for affected users
        for (const userId of affectedUserIds) {
            try {
                // Sum all purchases for this user
                const totals = prepare(`
                    SELECT 
                        SUM(quantity) as total_shields,
                        SUM(amount_sgd) as total_spent
                    FROM purchases 
                    WHERE user_id = ?
                `).get(userId);

                const totalShields = totals?.total_shields || 0;
                const totalSpent = totals?.total_spent || 0;

                // Get the first purchase date (earliest purchase)
                const firstPurchase = prepare(`
                    SELECT created_at FROM purchases 
                    WHERE user_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT 1
                `).get(userId);
                
                const firstPurchaseDate = firstPurchase?.created_at || new Date().toISOString();
                
                // Calculate monthly spent based on CURRENT CALENDAR MONTH
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
                
                console.log(`[Razorpay Sync] User ${userId}: checking purchases between ${currentMonthStart} and ${nextMonthStart}`);
                
                // Debug: List all purchases for this user
                const allPurchases = prepare(`SELECT created_at, amount_sgd FROM purchases WHERE user_id = ?`).all(userId);
                console.log(`[Razorpay Sync] User ${userId} purchases:`, JSON.stringify(allPurchases));
                
                // Sum purchases in current calendar month
                const monthlyTotals = prepare(`
                    SELECT SUM(amount_sgd) as monthly_spent
                    FROM purchases 
                    WHERE user_id = ? AND created_at >= ? AND created_at < ?
                `).get(userId, currentMonthStart, nextMonthStart);
                
                console.log(`[Razorpay Sync] User ${userId} monthly totals:`, JSON.stringify(monthlyTotals));
                
                const monthlySpent = monthlyTotals?.monthly_spent || 0;
                
                // Reset date is the first day of next month
                const purchaseResetDate = nextMonthStart;

                // Update user totals
                prepare(`
                    UPDATE users 
                    SET 
                        total_shields_purchased = ?,
                        total_spent = ?,
                        shields = ?,
                        monthly_spent = ?,
                        first_purchase_date = ?,
                        purchase_reset_date = ?
                    WHERE id = ?
                `).run(totalShields, totalSpent, totalShields, monthlySpent, firstPurchaseDate, purchaseResetDate, userId);

                results.usersRecalculated++;
                console.log(`[Razorpay Sync] Recalculated user ${userId}: shields=${totalShields}, spent=${totalSpent}, monthly=${monthlySpent}, resetDate=${purchaseResetDate}`);

            } catch (e) {
                console.error(`[Razorpay Sync] Error recalculating user ${userId}:`, e.message);
                results.errors.push(`Error recalculating user ${userId}: ${e.message}`);
            }
        }

        saveDatabase();

        console.log(`[Razorpay Sync] Complete: fetched=${results.fetched}, created=${results.created}, updated=${results.updated}, skipped=${results.skipped}, usersRecalculated=${results.usersRecalculated}`);

        res.json({
            success: true,
            message: 'Sync completed',
            results
        });

    } catch (error) {
        console.error('[Razorpay Sync] Fatal error:', error);
        res.status(500).json({ error: error.message });
    }
};
