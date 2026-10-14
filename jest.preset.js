const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // CI runs several suites at once on a few cores: two workers each, so tests timed by a clock do not
  // starve (as this Mac runs them, --maxWorkers=2). Locally, Jest still chooses unless told.
  ...(process.env.CI ? { maxWorkers: 2 } : {}),
  // Each CSS selector compiled once per file, not on every computed style (jest.selectors.js).
  setupFiles: [require.resolve('./jest.selectors.js')],
};
