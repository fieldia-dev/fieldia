module.exports = {
  displayName: 'vue',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  // @vue/test-utils and Vue resolve to their browser builds under jsdom.
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/vue',
};
