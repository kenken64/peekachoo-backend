// Polyfill for Web Crypto API (required by @simplewebauthn/server)
const { webcrypto } = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

const app = require('./app');
const { port } = require('./config/config');
const { initDatabase } = require('./config/sqlite');

// Initialize database and start server
async function start() {
    // Initialize SQLite database
    await initDatabase();

    // Start server
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
