module.exports = {
  displayName: 'map',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  // The maps' parts and Arabic's, German's and French's words in before the tests (src/test-parts.ts).
  setupFilesAfterEnv: ['<rootDir>/src/test-parts.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/map',
};
