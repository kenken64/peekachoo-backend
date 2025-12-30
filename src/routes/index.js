const express = require('express');
const peekachooRoutes = require('./peekachooRoutes');

const router = express.Router();

// API welcome route
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Peekachoo API',
        version: '1.0.0',
        endpoints: {
            peekachoos: '/api/peekachoos'
        }
    });
});

// Mount routes
router.use('/peekachoos', peekachooRoutes);

module.exports = router;
