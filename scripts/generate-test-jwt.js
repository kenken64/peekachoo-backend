#!/usr/bin/env node
/**
 * Generate a long-lived test JWT for ZAP security scanning
 * 
 * Usage:
 *   node scripts/generate-test-jwt.js
 * 
 * Environment variables required:
 *   JWT_SECRET - The same secret used by the backend
 * 
 * The generated token should be added as a GitHub secret: TEST_JWT_TOKEN
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';

// Test user configuration - this should match an actual user in your database
// or you can create a dedicated test user
const testUser = {
  userId: 'zap-test-user-001',
  username: 'zap_security_tester',
  createdAt: new Date().toISOString()
};

// Generate token with 1 year expiry
const token = jwt.sign(
  {
    userId: testUser.userId,
    username: testUser.username,
    purpose: 'zap-security-scan',
    environment: 'testing'
  },
  JWT_SECRET,
  {
    expiresIn: '365d',
    issuer: 'peekachoo-backend',
    subject: testUser.userId
  }
);

console.log('='.repeat(60));
console.log('ZAP Security Scan Test JWT Generator');
console.log('='.repeat(60));
console.log('');
console.log('Test User Details:');
console.log(`  User ID:  ${testUser.userId}`);
console.log(`  Username: ${testUser.username}`);
console.log('');
console.log('Token expires in: 365 days');
console.log('');
console.log('Generated JWT Token:');
console.log('-'.repeat(60));
console.log(token);
console.log('-'.repeat(60));
console.log('');
console.log('Next steps:');
console.log('1. Create this test user in your database (if not exists)');
console.log('2. Add this token as a GitHub secret named: TEST_JWT_TOKEN');
console.log('   - Go to: https://github.com/kenken64/peekachoo/settings/secrets/actions');
console.log('   - Click "New repository secret"');
console.log('   - Name: TEST_JWT_TOKEN');
console.log('   - Value: (paste the token above)');
console.log('');
console.log('⚠️  SECURITY NOTE: This token is for testing only.');
console.log('    Never use it in production or expose it publicly.');
console.log('='.repeat(60));
