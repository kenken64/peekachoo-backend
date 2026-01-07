/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.js', '**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Entry point
    '!src/config/*.js', // Configuration files
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  testTimeout: 10000,
  verbose: true,
  // Handle async operations cleanup
  forceExit: true,
  detectOpenHandles: true,
};
