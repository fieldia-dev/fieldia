/**
 * The environment the release's checks run in: the release's own, without any way to publish. `release.mjs` installs
 * the packs and their peers into an empty project and runs node and tsc there — third-party code, the newest each range
 * allows — so none of it is given the npm token: not `NPM_TOKEN`, not `NODE_AUTH_TOKEN`, not an npm config setting that
 * carries auth (`npm_config__authToken`, `npm_config_//registry.npmjs.org/:_authToken`, `NPM_CONFIG_TOKEN`, a
 * password, a username). Only `npm publish` is handed the token (release.mjs).
 */

/** Whether an environment variable carries a way to publish to npm. */
export function carriesAuth(name) {
  if (name === 'NPM_TOKEN' || name === 'NODE_AUTH_TOKEN') return true;
  if (!/^npm_config_/i.test(name)) return false;
  return /auth|token|password|passwd|username|_pass$|\/\//i.test(name);
}

/** A copy of `env` with every variable that carries a way to publish to npm left out. */
export function withoutAuth(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !carriesAuth(name)));
}
