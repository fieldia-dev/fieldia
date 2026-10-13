module.exports = {
  displayName: 'viewer',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  // The parts loaded on first use, in before the tests (src/test-parts.ts).
  setupFilesAfterEnv: ['<rootDir>/src/test-parts.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/viewer',
};
