const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Peekachoo backend is running!' });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Welcome to Peekachoo API',
    version: '1.0.0'
  });
});

// Sample endpoint
app.get('/api/peekachoo', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Peekachoo',
      description: 'A fun backend service'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
