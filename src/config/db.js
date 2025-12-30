const mongoose = require('mongoose');
const { mongoURI } = require('./config');

const connectDB = async () => {
    try {
        if (!mongoURI) {
            console.log('MongoDB URI not provided, skipping database connection');
            return;
        }
        await mongoose.connect(mongoURI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
