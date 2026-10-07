module.exports = {
  displayName: 'designer',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // The Angular editors have a set-up of their own: jest.angular.config.cjs.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/angular/'],
  coverageDirectory: '../../coverage/libs/designer',
  // Each test mounts whole pages in jsdom; on a CI runner busy with every suite at once one can pass 5 s.
  // Speed itself is gated in the browser (e2e/perf.spec.ts), not here.
  testTimeout: 20000,
};
