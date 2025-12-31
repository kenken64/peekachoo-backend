// Polyfill for Web Crypto API (required by @simplewebauthn/server)
const { webcrypto } = require('crypto');
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}

const http = require('http');
const app = require('./app');
const { port } = require('./config/config');
const { initDatabase } = require('./config/sqlite');
const websocketService = require('./services/websocketService');

// Initialize database and start server
async function start() {
    // Initialize SQLite database
    await initDatabase();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket server
    websocketService.initialize(server);

    // Start server
    server.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
        console.log(`WebSocket available at ws://localhost:${port}/ws`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully');
        websocketService.shutdown();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully');
        websocketService.shutdown();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
