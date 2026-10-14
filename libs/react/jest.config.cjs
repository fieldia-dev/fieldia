module.exports = {
  displayName: 'react',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  // The parts loaded on first use, in before the tests (src/test-parts.ts).
  setupFilesAfterEnv: ['<rootDir>/src/test-parts.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/react',
};
