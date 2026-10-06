/**
 * Whether a person holding `held` sees a part shown to `roles`, as Flectra
 * decides its `groups=`: holding any `!` role hides it; otherwise any role
 * named without `!` shows it, and a part naming only `!` roles shows to
 * everyone else. No roles named, everyone sees it.
 *
 * Roles only decide what a page shows. What a person may read or change is
 * the app's server's to enforce.
 */
export function rolesAllow(roles: readonly string[] | undefined, held: readonly string[]): boolean {
  if (!roles?.length) return true;
  const shown = roles.filter((role) => !role.startsWith('!'));
  if (roles.some((role) => role.startsWith('!') && held.includes(role.slice(1)))) return false;
  return !shown.length || shown.some((role) => held.includes(role));
}
