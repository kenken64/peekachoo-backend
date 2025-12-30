const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { prepare, saveDatabase } = require('../config/sqlite');
const { jwtSecret, rpName, rpID, origin } = require('../config/config');

// WebAuthn configuration
const rpConfig = {
    rpName: rpName || 'Peekachoo',
    rpID: rpID || 'localhost',
    origin: origin || 'http://localhost:3001'
};

// Helper to convert buffer to base64url
const bufferToBase64url = (buffer) => {
    return Buffer.from(buffer).toString('base64url');
};

// Helper to convert base64url to buffer
const base64urlToBuffer = (base64url) => {
    return Buffer.from(base64url, 'base64url');
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username },
        jwtSecret,
        { expiresIn: '24h' }
    );
};

// Check if username exists
exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.params;
        const user = prepare('SELECT id FROM users WHERE username = ?').get(username);
        res.json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Start registration - generate options
exports.startRegistration = async (req, res) => {
    try {
        const { username, displayName } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if user already exists
        let user = prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (user) {
            return res.status(400).json({ error: 'Username already exists. Please login instead.' });
        }

        // Create new user
        const userId = uuidv4();
        prepare('INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
            userId,
            username,
            displayName || username
        );
        user = { id: userId, username, display_name: displayName || username };

        // Get existing credentials for user
        const userCredentials = prepare('SELECT id FROM credentials WHERE user_id = ?').all(user.id);

        const options = await generateRegistrationOptions({
            rpName: rpConfig.rpName,
            rpID: rpConfig.rpID,
            userID: new TextEncoder().encode(user.id),
            userName: username,
            userDisplayName: displayName || username,
            attestationType: 'none',
            excludeCredentials: userCredentials.map(cred => ({
                id: cred.id,
                type: 'public-key'
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            }
        });

        // Store challenge
        const challengeId = uuidv4();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
        prepare('INSERT INTO challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?, ?)').run(
            challengeId,
            user.id,
            options.challenge,
            'registration',
            expiresAt
        );

        res.json({ 
            options,
            challengeId,
            userId: user.id
        });
    } catch (error) {
        console.error('Registration start error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Complete registration - verify response
exports.completeRegistration = async (req, res) => {
    try {
        const { userId, challengeId, response } = req.body;

        // Get challenge
        const challengeRecord = prepare(
            'SELECT * FROM challenges WHERE id = ? AND user_id = ? AND type = ?'
        ).get(challengeId, userId, 'registration');

        if (!challengeRecord) {
            return res.status(400).json({ error: 'Challenge not found or expired' });
        }

        if (new Date(challengeRecord.expires_at) < new Date()) {
            prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);
            return res.status(400).json({ error: 'Challenge expired' });
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: rpConfig.origin,
            expectedRPID: rpConfig.rpID,
            requireUserVerification: false
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Verification failed' });
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // Store credential - store public key as base64
        prepare(`
            INSERT INTO credentials (id, user_id, public_key, counter, device_type, backed_up, transports)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            credential.id,
            userId,
            Buffer.from(credential.publicKey).toString('base64'),
            credential.counter,
            credentialDeviceType,
            credentialBackedUp ? 1 : 0,
            JSON.stringify(response.response.transports || [])
        );

        // Delete challenge
        prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);

        // Get user and generate token
        const user = prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const token = generateToken(user);

        res.json({
            verified: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name
            }
        });
    } catch (error) {
        console.error('Registration complete error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Start authentication - generate options
exports.startAuthentication = async (req, res) => {
    try {
        const { username } = req.body;

        let allowCredentials = [];
        let userId = null;

        if (username) {
            // Get user
            const user = prepare('SELECT * FROM users WHERE username = ?').get(username);
            if (!user) {
                return res.status(400).json({ error: 'User not found' });
            }
            userId = user.id;

            // Get user credentials
            const credentials = prepare('SELECT id, transports FROM credentials WHERE user_id = ?').all(user.id);
            allowCredentials = credentials.map(cred => ({
                id: cred.id,
                type: 'public-key',
                transports: JSON.parse(cred.transports || '[]')
            }));
        }

        const options = await generateAuthenticationOptions({
            rpID: rpConfig.rpID,
            allowCredentials,
            userVerification: 'preferred'
        });

        // Store challenge
        const challengeId = uuidv4();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        prepare('INSERT INTO challenges (id, user_id, challenge, type, expires_at) VALUES (?, ?, ?, ?, ?)').run(
            challengeId,
            userId,
            options.challenge,
            'authentication',
            expiresAt
        );

        res.json({
            options,
            challengeId
        });
    } catch (error) {
        console.error('Authentication start error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Complete authentication - verify response
exports.completeAuthentication = async (req, res) => {
    try {
        const { challengeId, response } = req.body;

        // Get challenge
        const challengeRecord = prepare(
            'SELECT * FROM challenges WHERE id = ? AND type = ?'
        ).get(challengeId, 'authentication');

        if (!challengeRecord) {
            return res.status(400).json({ error: 'Challenge not found' });
        }

        if (new Date(challengeRecord.expires_at) < new Date()) {
            prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);
            return res.status(400).json({ error: 'Challenge expired' });
        }

        // Get credential
        const credential = prepare('SELECT * FROM credentials WHERE id = ?').get(response.id);
        if (!credential) {
            return res.status(400).json({ error: 'Credential not found' });
        }

        // Decode public key from base64
        const publicKeyBuffer = Buffer.from(credential.public_key, 'base64');

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: rpConfig.origin,
            expectedRPID: rpConfig.rpID,
            credential: {
                id: credential.id,
                publicKey: publicKeyBuffer,
                counter: credential.counter,
                transports: JSON.parse(credential.transports || '[]')
            },
            requireUserVerification: false
        });

        if (!verification.verified) {
            return res.status(400).json({ error: 'Verification failed' });
        }

        // Update counter
        prepare('UPDATE credentials SET counter = ? WHERE id = ?').run(
            verification.authenticationInfo.newCounter,
            credential.id
        );

        // Delete challenge
        prepare('DELETE FROM challenges WHERE id = ?').run(challengeId);

        // Get user and generate token
        const user = prepare('SELECT * FROM users WHERE id = ?').get(credential.user_id);
        const token = generateToken(user);

        res.json({
            verified: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name
            }
        });
    } catch (error) {
        console.error('Authentication complete error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const user = prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
