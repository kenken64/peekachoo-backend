const app = require('./app');
const { port } = require('./config/config');
const connectDB = require('./config/db');
const { initDatabase } = require('./config/sqlite');

// Initialize databases and start server
async function start() {
    // Initialize SQLite database
    await initDatabase();

    // Connect to MongoDB (optional)
    connectDB();

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
