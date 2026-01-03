# Peekachoo API Endpoint Security

This document outlines the authentication requirements for all backend API endpoints.

## Authentication Methods

| Method | Description | Header |
|--------|-------------|--------|
| **None** | Public endpoint, no authentication required | - |
| **JWT Token** | Requires valid JWT token from login | `Authorization: Bearer <token>` |
| **API Key** | Requires admin API key | `X-API-Key: <api_key>` |

---

## 🔓 Public Endpoints (No Authentication Required)

### Auth Routes (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/config` | WebAuthn configuration |
| GET | `/api/auth/check-username/:username` | Check if username exists |
| POST | `/api/auth/register/start` | Start passkey registration |
| POST | `/api/auth/register/complete` | Complete passkey registration |
| POST | `/api/auth/login/start` | Start passkey login |
| POST | `/api/auth/login/complete` | Complete passkey login |

---

## 🔐 Protected Endpoints (JWT Token Required)

All requests must include the header:
```
Authorization: Bearer <jwt_token>
```

### Auth Routes (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current authenticated user |

### Leaderboard Routes (`/api/leaderboard`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard/global` | Get global leaderboard |
| GET | `/api/leaderboard/level/:level` | Get level leaderboard |
| GET | `/api/leaderboard/game/:gameId` | Get game leaderboard |
| GET | `/api/leaderboard/around-me` | Get scores around current user |
| POST | `/api/leaderboard/scores` | Submit a score |
| POST | `/api/leaderboard/sessions` | Start a game session |
| POST | `/api/leaderboard/sessions/:sessionId/end` | End a game session |

### Quiz Routes (`/api/quiz`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quiz/generate` | Generate quiz question for Pokemon |

### Peekachoos Routes (`/api/peekachoos`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/peekachoos` | Get all peekachoos |
| GET | `/api/peekachoos/:id` | Get peekachoo by ID |
| POST | `/api/peekachoos` | Create peekachoo |
| PUT | `/api/peekachoos/:id` | Update peekachoo |
| DELETE | `/api/peekachoos/:id` | Delete peekachoo |

### Games Routes (`/api/games`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games` | Create a new game |
| GET | `/api/games/my-games` | Get current user's games |
| GET | `/api/games/published` | Get all published games |
| GET | `/api/games/:id` | Get game by ID |
| PUT | `/api/games/:id` | Update game |
| PATCH | `/api/games/:id/publish` | Toggle publish status |
| DELETE | `/api/games/:id` | Delete game |
| POST | `/api/games/:id/play` | Increment play count |

### Stats Routes (`/api/stats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/me` | Get current user's stats |
| GET | `/api/stats/player/:userId` | Get specific player's stats |
| GET | `/api/stats/history` | Get game history |
| GET | `/api/stats/collection` | Get Pokemon collection |

### Pokemon Routes (`/api/pokemon`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pokemon/sync` | Sync Pokemon from PokeAPI |
| GET | `/api/pokemon` | Get all Pokemon |
| GET | `/api/pokemon/search` | Search Pokemon by name |
| GET | `/api/pokemon/type/:type` | Get Pokemon by type |
| GET | `/api/pokemon/:id` | Get Pokemon by ID |

### Achievements Routes (`/api/achievements`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/achievements` | Get all achievements with progress |
| GET | `/api/achievements/categories` | Get achievement categories summary |
| GET | `/api/achievements/category/:category` | Get achievements by category |
| GET | `/api/achievements/:achievementId` | Get specific achievement |

---

## 🔑 Admin Endpoints (API Key Required)

All requests must include the header:
```
X-API-Key: <admin_api_key>
```

### Admin Routes (`/api/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users (with pagination & search) |
| GET | `/api/admin/users/count` | Get total user count |
| GET | `/api/admin/users/:id` | Get user by ID |
| DELETE | `/api/admin/users/:id` | Delete user by ID |

---

## Middleware Reference

### `authMiddleware`
- Validates JWT token from `Authorization` header
- Sets `req.user` with decoded token payload
- Returns 401 if token missing, expired, or invalid

### `optionalAuth`
- Validates JWT token if present, but doesn't require it
- Sets `req.user` if valid token provided
- Continues without error if no token

### `adminApiKeyAuth`
- Validates API key from `X-API-Key` header
- Compares against configured `ADMIN_API_KEY` environment variable
- Returns 401 if key missing, 403 if invalid

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `ADMIN_API_KEY` | API key for admin endpoints |
| `RP_NAME` | WebAuthn Relying Party name |
| `RP_ID` | WebAuthn Relying Party ID (domain) |
| `ORIGIN` | Allowed origin for WebAuthn |
