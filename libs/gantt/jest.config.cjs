module.exports = {
  displayName: 'gantt',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/gantt',
  // A test mounts a whole plan and draws another to compare; on a CI runner busy with every suite one passed 5 s.
  // Speed itself is gated in the browser's perf job (counts at scale), not here.
  testTimeout: 20000,
};
