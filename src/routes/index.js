const express = require('express');
const peekachooRoutes = require('./peekachooRoutes');
const authRoutes = require('./authRoutes');

const router = express.Router();

// API welcome route
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Peekachoo API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            peekachoos: '/api/peekachoos'
        }
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/peekachoos', peekachooRoutes);

module.exports = router;
