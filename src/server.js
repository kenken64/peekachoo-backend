// Polyfill for Web Crypto API (required by @simplewebauthn/server)
console.log('Server script started. Loading modules...');
try {
    const { webcrypto } = require('crypto');
    if (!globalThis.crypto) {
        globalThis.crypto = webcrypto;
    }

    const http = require('http');
    const app = require('./app');
    const { port } = require('./config/config');
    const { initDatabase } = require('./config/sqlite');
    const websocketService = require('./services/websocketService');

    console.log('Modules loaded. Defining start function...');

    // Initialize database and start server
    async function start() {
        let server;
        try {
            console.log('Starting initialization sequence...');

            // Create HTTP server immediately to satisfy health checks
            console.log('Creating HTTP server...');
            server = http.createServer(app);

            // Start server - bind to 0.0.0.0 for Docker compatibility
            // We start listening BEFORE DB init so the container appears "healthy" to the platform
            // even if DB takes a moment to load.
            console.log(`Attempting to bind server to port ${port}...`);
            await new Promise((resolve, reject) => {
                server.listen(port, '0.0.0.0', () => {
                    console.log(`Server successfully listening on http://0.0.0.0:${port}`);
                    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                    resolve();
                });
                server.on('error', (err) => {
                    console.error('Error during listener startup:', err);
                    reject(err);
                });
            });
            
            // Initialize SQLite database
            console.log('Server is up. Now initializing database...');
            await initDatabase();
            console.log('Database initialized successfully');

            // Initialize WebSocket server
            console.log('Initializing WebSocket service...');
            websocketService.initialize(server);
            console.log(`WebSocket available at ws://0.0.0.0:${port}/ws`);

            // Handle separate error events after startup
            server.on('error', (e) => {
                console.error('Runtime Server error:', e);
            });
            
            // Log for Railway to catch
            console.log('APPLICATION STARTED SUCCESSFULLY');

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
            console.error('Fatal error in start() function:', error);
            console.error(error.stack);
            if (server) server.close();
            process.exit(1);
        }
    }

    // Global error handlers
    process.on('uncaughtException', (err) => {
        console.error('UNCAUGHT EXCEPTION:', err);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
        // application specific logging, throwing an error, or other logic here
    });

    console.log('Invoking start()...');
    start().catch(err => {
        console.error('Failed to start server (promise rejection):', err);
        process.exit(1);
    });
} catch (loadError) {
    console.error('Detailed Error loading modules:', loadError);
    console.error(loadError.stack);
    process.exit(1);
}
