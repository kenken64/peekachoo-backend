const app = require('./app');
const { port } = require('./config/config');
const connectDB = require('./config/db');

// Connect to database
connectDB();

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
