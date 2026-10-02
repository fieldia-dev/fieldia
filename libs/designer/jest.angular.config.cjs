/** The Angular editors run under Angular's own test set-up, apart from the rest of the designer. */
module.exports = {
  displayName: 'designer-angular',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/angular'],
  setupFilesAfterEnv: ['<rootDir>/angular/test-setup.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.angular-spec.json', stringifyContentPathRegex: '\\.(html|svg)$' }],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleFileExtensions: ['ts', 'mjs', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/designer-angular',
};
