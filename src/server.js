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
    try {
        console.log('Starting initialization...');
        
        // Initialize SQLite database
        console.log('Initializing database...');
        await initDatabase();
        console.log('Database initialized successfully');

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize WebSocket server
        console.log('Initializing WebSocket service...');
        websocketService.initialize(server);

        // Start server - bind to 0.0.0.0 for Docker compatibility
        console.log(`Attempting to bind server to port ${port}...`);
        server.listen(port, '0.0.0.0', () => {
            console.log(`Server is running on http://0.0.0.0:${port}`);
            console.log(`WebSocket available at ws://0.0.0.0:${port}/ws`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Handle error events on the server
        server.on('error', (e) => {
            console.error('Server error:', e);
            if (e.code === 'EADDRINUSE') {
                console.error('Address in use, retrying...');
                setTimeout(() => {
                    server.close();
                    server.listen(port, '0.0.0.0');
                }, 1000);
            }
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
    } catch (error) {
        console.error('Fatal error during startup:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
