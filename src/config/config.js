require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoURI: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET || 'peekachoo-super-secret-key-change-in-production',
    rpName: process.env.RP_NAME || 'Peekachoo',
    rpID: process.env.RP_ID || 'localhost',
    origin: process.env.ORIGIN || 'http://localhost:3001',
    adminApiKey: process.env.ADMIN_API_KEY || 'peekachoo-admin-api-key-change-in-production',
    razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret',
        webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || 'your_razorpay_webhook_secret'
    }
};
