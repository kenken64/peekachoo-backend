# Peekachoo Backend

A well-structured Express.js backend API following MVC pattern and best practices.

## Project Structure

```
📁 peekachoo-backend
├── 📁 src
│   ├── 📁 config          # Configuration files (database, environment)
│   ├── 📁 controllers     # Request handlers (business logic)
│   ├── 📁 models          # Database models & schemas
│   ├── 📁 routes          # API route definitions
│   ├── 📁 middlewares     # Custom middleware (logging, error handling)
│   ├── 📁 services        # Business logic layer
│   ├── 📁 utils           # Helper functions and utilities
│   ├── app.js             # Express app setup
│   └── server.js          # Server initialization
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore file
├── package.json           # Dependencies and scripts
└── README.md              # Project documentation
```

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Update the environment variables as needed

```bash
cp .env.example .env
```

## Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Peekachoos
- `GET /api` - API welcome message
- `GET /api/peekachoos` - Get all peekachoos
- `GET /api/peekachoos/:id` - Get peekachoo by ID
- `POST /api/peekachoos` - Create a new peekachoo
- `PUT /api/peekachoos/:id` - Update a peekachoo
- `DELETE /api/peekachoos/:id` - Delete a peekachoo

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment mode | development |
| MONGO_URI | MongoDB connection string | - |
| JWT_SECRET | JWT secret key | - |
