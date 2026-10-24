/**
 * npm's advisories for what an app installs with Fieldia: `release.mjs check` installs the packs into an empty project
 * — the frameworks and tools an app brings itself (the packages' peers) as its devDependencies — and runs
 * `npm audit --omit=dev` there, so the packages' own dependencies are audited as an app gets them, the newest each range
 * allows (the workspace's audit cannot: most of them are its devDependencies). A high or critical advisory refuses the
 * release, unless it is in tools/audit-allowed.json: reviewed, with why it cannot reach an app, until a date — after
 * which it refuses again, to be looked at anew.
 */

const REFUSED = new Set(['high', 'critical']);

/**
 * Every high or critical advisory in an `npm audit --json` report that no exception in `allowed` covers on `today`
 * (YYYY-MM-DD), in words. A package vulnerable only through another (`via` a name) is that one's advisory, said there.
 */
export function auditProblems(report, allowed, today) {
  for (const one of allowed) {
    if (!one.advisory || !one.package || !one.why || !one.until) throw new Error(`an exception in tools/audit-allowed.json needs advisory, package, why and until: ${JSON.stringify(one)}`);
  }
  const problems = [];
  for (const [name, { via = [] }] of Object.entries(report.vulnerabilities ?? {})) {
    for (const found of via) {
      if (typeof found !== 'object' || !REFUSED.has(found.severity)) continue;
      const said = `${name}: ${found.severity} — ${found.title} (${found.url})`;
      const exception = allowed.find((one) => one.advisory === found.url && one.package === name);
      if (!exception) problems.push(said);
      else if (exception.until < today) problems.push(`${said}, allowed until ${exception.until} (${exception.why}): look at it again — upgrade, or review it and allow it anew`);
    }
  }
  return problems;
}
