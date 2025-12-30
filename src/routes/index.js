const express = require('express');
const peekachooRoutes = require('./peekachooRoutes');
const authRoutes = require('./authRoutes');
const pokemonRoutes = require('./pokemonRoutes');
const gameRoutes = require('./gameRoutes');

const router = express.Router();

// API welcome route
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Peekachoo API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            peekachoos: '/api/peekachoos',
            pokemon: '/api/pokemon',
            games: '/api/games'
        }
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/peekachoos', peekachooRoutes);
router.use('/pokemon', pokemonRoutes);
router.use('/games', gameRoutes);

module.exports = router;
