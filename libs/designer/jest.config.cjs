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
};
