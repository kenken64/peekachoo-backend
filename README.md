# Peekachoo Backend

RESTful API server for the Peekachoo game platform. Provides WebAuthn/Passkey authentication, Pokémon data management, and game creation features.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18.2-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **WebAuthn/Passkey Authentication** - Passwordless login using biometrics or security keys
- **Pokémon Integration** - Sync and serve Pokémon data from PokéAPI
- **Game Management** - Create, publish, and share custom game levels
- **Quiz Generation** - Generate trivia questions with optional OpenAI integration
- **SQLite Database** - Lightweight embedded database

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.18.2 |
| Database | SQLite (sql.js) |
| Authentication | SimpleWebAuthn 10.0.0 |
| Token | JWT (jsonwebtoken) |
| External API | PokéAPI, OpenAI (optional) |

## Prerequisites

- Node.js v18 or higher
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/kenken64/peekachoo-backend.git
cd peekachoo-backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Update .env with your settings
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT signing key | (required) |
| `DATABASE_PATH` | SQLite database path | `./data/peekachoo.db` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:8080` |
| `ORIGIN` | WebAuthn origin | `http://localhost:8080` |
| `RP_ID` | WebAuthn relying party ID | `localhost` |
| `OPENAI_API_KEY` | OpenAI API key (optional) | - |

### WebAuthn Configuration

For production, update these values:
- `RP_ID` - Your domain (e.g., `example.com`)
- `ORIGIN` - Your full URL with HTTPS (e.g., `https://example.com`)

## Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Server runs at `http://localhost:3000` by default.

## API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |
| GET | `/api` | API welcome message |

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/config` | WebAuthn configuration |
| GET | `/auth/check-username/:username` | Check username availability |
| POST | `/auth/register/start` | Start passkey registration |
| POST | `/auth/register/complete` | Complete registration |
| POST | `/auth/login/start` | Start authentication |
| POST | `/auth/login/complete` | Complete authentication |
| GET | `/auth/me` | Get current user (protected) |

### Pokémon (`/api/pokemon`) - Protected
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pokemon/sync` | Sync Pokémon from PokéAPI |
| GET | `/pokemon` | Get all Pokémon (paginated) |
| GET | `/pokemon/search?q=name` | Search by name |
| GET | `/pokemon/type/:type` | Filter by type |
| GET | `/pokemon/:id` | Get by ID |

### Games (`/api/games`) - Protected
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/games` | Create new game |
| GET | `/games/my-games` | Get user's games |
| GET | `/games/published` | Get published games |
| GET | `/games/:id` | Get game by ID |
| PUT | `/games/:id` | Update game |
| PATCH | `/games/:id/publish` | Toggle publish status |
| DELETE | `/games/:id` | Delete game |
| POST | `/games/:id/play` | Increment play count |

### Quiz (`/api/quiz`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quiz/generate` | Generate quiz question |

## Project Structure

```
src/
├── app.js                  # Express app setup
├── server.js               # Server initialization
├── config/
│   ├── config.js           # Environment configuration
│   └── sqlite.js           # Database initialization
├── controllers/
│   ├── authController.js   # WebAuthn authentication
│   ├── pokemonController.js # Pokémon CRUD
│   ├── gameController.js   # Game management
│   └── quizController.js   # Quiz generation
├── routes/
│   ├── index.js            # Main router
│   ├── authRoutes.js       # Auth endpoints
│   ├── pokemonRoutes.js    # Pokémon endpoints
│   ├── gameRoutes.js       # Game endpoints
│   └── quizRoutes.js       # Quiz endpoints
├── middlewares/
│   ├── authMiddleware.js   # JWT verification
│   ├── logger.js           # Request logging
│   └── errorHandler.js     # Error handling
├── services/
│   └── peekachooService.js # Data service
└── utils/
    └── helpers.js          # Utility functions
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (id, username, display_name) |
| `credentials` | Passkeys (public_key, counter, device_type) |
| `challenges` | WebAuthn challenges (temporary) |
| `pokemon` | Cached Pokémon data |
| `games` | User-created games with levels |
| `scores` | Game scores |

## Authentication Flow

### Registration
1. Client requests registration options (`POST /auth/register/start`)
2. Server generates challenge and returns WebAuthn options
3. Client performs WebAuthn ceremony with authenticator
4. Client sends response (`POST /auth/register/complete`)
5. Server verifies and stores credential, returns JWT

### Login
1. Client requests authentication options (`POST /auth/login/start`)
2. Server generates challenge and returns options
3. Client performs WebAuthn ceremony
4. Client sends response (`POST /auth/login/complete`)
5. Server verifies credential, returns JWT

## Docker Deployment

```bash
# Build Docker image
docker build -t peekachoo-backend .

# Run container
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret-key \
  -e CORS_ORIGIN=https://your-frontend.com \
  -e ORIGIN=https://your-frontend.com \
  -e RP_ID=your-frontend.com \
  -v peekachoo-data:/app/data \
  peekachoo-backend
```

**Important**: Mount a volume for `/app/data` to persist the SQLite database.

## Security Considerations

- JWT tokens expire after 24 hours
- WebAuthn prevents phishing attacks
- Counter validation detects cloned authenticators
- CORS restricts cross-origin requests
- Environment variables for sensitive data

## Related

- [peekachoo-frontend](https://github.com/kenken64/peekachoo-frontend) - Game frontend
- [peekachoo](https://github.com/kenken64/peekachoo) - Parent repository

## License

MIT
