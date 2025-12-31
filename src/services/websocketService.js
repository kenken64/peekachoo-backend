const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/config');

/**
 * WebSocket Service for real-time notifications
 * Handles connections, authentication, and broadcasting events
 */
class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // Map of userId -> Set of WebSocket connections
        this.heartbeatInterval = null;
    }

    /**
     * Initialize WebSocket server
     * @param {http.Server} server - HTTP server instance
     */
    initialize(server) {
        this.wss = new WebSocket.Server({
            server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, req) => {
            console.log('[WebSocket] New connection attempt');

            // Set initial state
            ws.isAlive = true;
            ws.userId = null;
            ws.isAuthenticated = false;

            // Handle pong responses for heartbeat
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Handle incoming messages
            ws.on('message', (data) => {
                this.handleMessage(ws, data);
            });

            // Handle connection close
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('[WebSocket] Connection error:', error.message);
            });

            // Send welcome message requesting authentication
            this.send(ws, {
                type: 'welcome',
                message: 'Connected to Peekachoo. Please authenticate.',
                timestamp: Date.now()
            });

            // Set authentication timeout (30 seconds)
            ws.authTimeout = setTimeout(() => {
                if (!ws.isAuthenticated) {
                    this.send(ws, {
                        type: 'error',
                        message: 'Authentication timeout'
                    });
                    ws.close(4001, 'Authentication timeout');
                }
            }, 30000);
        });

        // Start heartbeat interval
        this.startHeartbeat();

        console.log('[WebSocket] Server initialized on /ws');
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'auth':
                    this.handleAuth(ws, message.token);
                    break;

                case 'ping':
                    this.send(ws, { type: 'pong', timestamp: Date.now() });
                    break;

                case 'subscribe':
                    this.handleSubscribe(ws, message.channel);
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(ws, message.channel);
                    break;

                default:
                    console.log('[WebSocket] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error.message);
        }
    }

    /**
     * Handle authentication
     */
    handleAuth(ws, token) {
        try {
            if (!token) {
                this.send(ws, {
                    type: 'auth_error',
                    message: 'No token provided'
                });
                return;
            }

            // Verify JWT token
            const decoded = jwt.verify(token, jwtSecret);
            const userId = decoded.userId;

            // Clear auth timeout
            if (ws.authTimeout) {
                clearTimeout(ws.authTimeout);
                ws.authTimeout = null;
            }

            // Set authenticated state
            ws.userId = userId;
            ws.isAuthenticated = true;
            ws.subscriptions = new Set(['global']); // Default subscription

            // Add to clients map
            if (!this.clients.has(userId)) {
                this.clients.set(userId, new Set());
            }
            this.clients.get(userId).add(ws);

            // Send success response
            this.send(ws, {
                type: 'auth_success',
                userId: userId,
                message: 'Authentication successful'
            });

            console.log(`[WebSocket] User ${userId} authenticated`);

            // Notify about online status (optional)
            this.broadcastUserOnline(userId);

        } catch (error) {
            console.error('[WebSocket] Auth failed:', error.message);
            this.send(ws, {
                type: 'auth_error',
                message: 'Invalid token'
            });
        }
    }

    /**
     * Handle channel subscription
     */
    handleSubscribe(ws, channel) {
        if (!ws.isAuthenticated) {
            this.send(ws, {
                type: 'error',
                message: 'Not authenticated'
            });
            return;
        }

        if (!ws.subscriptions) {
            ws.subscriptions = new Set();
        }

        ws.subscriptions.add(channel);
        this.send(ws, {
            type: 'subscribed',
            channel: channel
        });

        console.log(`[WebSocket] User ${ws.userId} subscribed to ${channel}`);
    }

    /**
     * Handle channel unsubscription
     */
    handleUnsubscribe(ws, channel) {
        if (ws.subscriptions) {
            ws.subscriptions.delete(channel);
            this.send(ws, {
                type: 'unsubscribed',
                channel: channel
            });
        }
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(ws) {
        if (ws.authTimeout) {
            clearTimeout(ws.authTimeout);
        }

        if (ws.userId && this.clients.has(ws.userId)) {
            const userConnections = this.clients.get(ws.userId);
            userConnections.delete(ws);

            if (userConnections.size === 0) {
                this.clients.delete(ws.userId);
                // Broadcast offline status
                this.broadcastUserOffline(ws.userId);
            }

            console.log(`[WebSocket] User ${ws.userId} disconnected`);
        }
    }

    /**
     * Start heartbeat to detect dead connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (!this.wss) return;

            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    this.handleDisconnect(ws);
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30 second heartbeat
    }

    /**
     * Send message to a WebSocket client
     */
    send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Send message to a specific user (all their connections)
     */
    sendToUser(userId, data) {
        const connections = this.clients.get(userId);
        if (connections) {
            connections.forEach(ws => {
                this.send(ws, data);
            });
        }
    }

    /**
     * Broadcast to all authenticated clients
     */
    broadcast(data, excludeUserId = null) {
        if (!this.wss) return;

        this.wss.clients.forEach((ws) => {
            if (ws.isAuthenticated && ws.userId !== excludeUserId) {
                this.send(ws, data);
            }
        });
    }

    /**
     * Broadcast to clients subscribed to a channel
     */
    broadcastToChannel(channel, data, excludeUserId = null) {
        if (!this.wss) return;

        this.wss.clients.forEach((ws) => {
            if (ws.isAuthenticated &&
                ws.subscriptions?.has(channel) &&
                ws.userId !== excludeUserId) {
                this.send(ws, data);
            }
        });
    }

    /**
     * Broadcast user online status
     */
    broadcastUserOnline(userId) {
        this.broadcast({
            type: 'user_online',
            userId: userId,
            timestamp: Date.now()
        }, userId);
    }

    /**
     * Broadcast user offline status
     */
    broadcastUserOffline(userId) {
        this.broadcast({
            type: 'user_offline',
            userId: userId,
            timestamp: Date.now()
        });
    }

    // ============================================
    // Game Event Notifications
    // ============================================

    /**
     * Notify about a new high score
     */
    notifyNewScore(scoreData) {
        const { userId, displayName, score, level, rank, isNewPersonalBest } = scoreData;

        // Notify the player
        this.sendToUser(userId, {
            type: 'score_submitted',
            data: scoreData,
            timestamp: Date.now()
        });

        // Broadcast to global channel if it's a notable score
        if (rank <= 100 || isNewPersonalBest) {
            this.broadcastToChannel('global', {
                type: 'leaderboard_update',
                data: {
                    userId,
                    displayName,
                    score,
                    level,
                    rank
                },
                timestamp: Date.now()
            }, userId);
        }
    }

    /**
     * Notify about rank change
     */
    notifyRankChange(userId, oldRank, newRank, displayName) {
        // Notify the player
        this.sendToUser(userId, {
            type: 'rank_change',
            data: {
                oldRank,
                newRank,
                change: oldRank - newRank // Positive means improved
            },
            timestamp: Date.now()
        });

        // Broadcast significant rank changes
        if (newRank <= 10) {
            this.broadcastToChannel('global', {
                type: 'top_rank_change',
                data: {
                    displayName,
                    newRank
                },
                timestamp: Date.now()
            }, userId);
        }
    }

    /**
     * Notify about achievement unlock
     */
    notifyAchievementUnlock(userId, achievement) {
        // Notify the player
        this.sendToUser(userId, {
            type: 'achievement_unlocked',
            data: achievement,
            timestamp: Date.now()
        });
    }

    /**
     * Notify about new Pokemon reveal
     */
    notifyPokemonReveal(userId, pokemon, collectionProgress) {
        this.sendToUser(userId, {
            type: 'pokemon_revealed',
            data: {
                pokemon,
                collectionProgress
            },
            timestamp: Date.now()
        });
    }

    /**
     * Notify about streak milestone
     */
    notifyStreakMilestone(userId, streak, bonus) {
        this.sendToUser(userId, {
            type: 'streak_milestone',
            data: {
                streak,
                bonus
            },
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast live leaderboard position
     */
    broadcastLeaderboardPosition(userId, displayName, position, score) {
        this.broadcastToChannel('leaderboard', {
            type: 'leaderboard_position',
            data: {
                userId,
                displayName,
                position,
                score
            },
            timestamp: Date.now()
        });
    }

    /**
     * Get online user count
     */
    getOnlineCount() {
        return this.clients.size;
    }

    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return this.clients.has(userId);
    }

    /**
     * Cleanup on server shutdown
     */
    shutdown() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.wss) {
            this.wss.clients.forEach((ws) => {
                ws.close(1001, 'Server shutting down');
            });
            this.wss.close();
        }

        console.log('[WebSocket] Server shut down');
    }
}

// Export singleton instance
const websocketService = new WebSocketService();
module.exports = websocketService;
