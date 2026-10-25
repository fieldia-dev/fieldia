module.exports = {
  displayName: 'map',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  // Arabic's, German's and French's words in before the tests (src/test-words.ts).
  setupFilesAfterEnv: ['<rootDir>/src/test-words.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/map',
};
