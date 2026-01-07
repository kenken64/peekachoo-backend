const { authMiddleware, optionalAuth, adminApiKeyAuth } = require('../src/middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should return 401 if no authorization header', () => {
      authMiddleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No authorization header provided' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 if no token in header', () => {
      mockReq.headers.authorization = 'Bearer ';

      authMiddleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      authMiddleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 if token is expired', () => {
      // Create an already expired token
      const payload = { userId: '123', username: 'testuser' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1s' });
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should call next and set user if token is valid', () => {
      const payload = { userId: '123', username: 'testuser' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe('123');
      expect(mockReq.user.username).toBe('testuser');
    });
  });

  describe('optionalAuth', () => {
    it('should call next without user if no token', () => {
      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should set user if valid token provided', () => {
      const payload = { userId: '456', username: 'optional-user' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe('456');
    });

    it('should call next without user if invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      optionalAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  describe('adminApiKeyAuth', () => {
    it('should return 401 if no API key', () => {
      adminApiKeyAuth(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No API key provided' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 403 if API key is invalid', () => {
      mockReq.headers['x-api-key'] = 'wrong-key';

      adminApiKeyAuth(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should call next if API key is valid', () => {
      mockReq.headers['x-api-key'] = process.env.ADMIN_API_KEY;

      adminApiKeyAuth(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });
});
