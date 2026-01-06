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
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_sg_hqvjt7HayPwnsJ',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'KZ1ieslUpRRRsA4yaeASb8NV',
        webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || 'dd6725ae574bd42cf332ee2c2d769e3b294e83e779e8740019395ff15d3c6cfa'
    }
};
