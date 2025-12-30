require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoURI: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET || 'peekachoo-super-secret-key-change-in-production',
    rpName: process.env.RP_NAME || 'Peekachoo',
    rpID: process.env.RP_ID || 'localhost',
    origin: process.env.ORIGIN || 'http://localhost:3001'
};
