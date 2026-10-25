/**
 * npm's advisories for what an app installs with Fieldia (the release check's `npm audit --omit=dev`, in the empty
 * project the packs are installed into): high and critical refuse a release, unless reviewed and allowed for a time.
 *   node --test tools/release-audit.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditProblems } from './release-audit.mjs';

const advisory = (id, name, severity, title) => ({ source: 1, name, dependency: name, title, url: `https://github.com/advisories/${id}`, severity, range: '<=1.0.0' });
/** npm audit --json, as npm 10 and 11 write it: each vulnerable package, the advisories that make it so (`via`). */
const REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {
    dompurify: { name: 'dompurify', severity: 'critical', via: [advisory('GHSA-cg2g-xh64-v4q7', 'dompurify', 'critical', 'SAFE_FOR_TEMPLATES bypass'), advisory('GHSA-mrv2-3pqr-j5jr', 'dompurify', 'high', 'IN_PLACE hook'), advisory('GHSA-c6gr-qvv4-5v3f', 'dompurify', 'low', 'SMIL')] },
    // A package vulnerable only through another: its advisories are that one's, said there.
    'monaco-editor': { name: 'monaco-editor', severity: 'critical', via: ['dompurify'] },
    leftpad: { name: 'leftpad', severity: 'moderate', via: [advisory('GHSA-0000-0000-0001', 'leftpad', 'moderate', 'slow')] },
  },
};
const ALLOWED = [
  { advisory: 'https://github.com/advisories/GHSA-cg2g-xh64-v4q7', package: 'dompurify', why: 'monaco never sets SAFE_FOR_TEMPLATES', until: '2026-12-31' },
  { advisory: 'https://github.com/advisories/GHSA-mrv2-3pqr-j5jr', package: 'dompurify', why: 'monaco never sets IN_PLACE', until: '2026-12-31' },
];

test('a high or critical advisory refuses the release, named with its package and link; moderate and low do not', () => {
  const problems = auditProblems(REPORT, [], '2026-10-24');
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.match(problems[0], /dompurify: critical — SAFE_FOR_TEMPLATES bypass \(https:\/\/github\.com\/advisories\/GHSA-cg2g-xh64-v4q7\)/);
  assert.match(problems[1], /dompurify: high — IN_PLACE hook/);
});

test('an advisory reviewed and allowed until a date passes until then, and refuses again after it', () => {
  assert.deepEqual(auditProblems(REPORT, ALLOWED, '2026-10-24'), []);
  assert.deepEqual(auditProblems(REPORT, ALLOWED, '2026-12-31'), []);
  const later = auditProblems(REPORT, ALLOWED, '2027-01-01');
  assert.equal(later.length, 2);
  assert.match(later[0], /allowed until 2026-12-31 \(monaco never sets SAFE_FOR_TEMPLATES\): look at it again/);
});

test('an exception names the advisory, the package, why and until when — or it is no exception', () => {
  assert.throws(() => auditProblems(REPORT, [{ advisory: 'https://github.com/advisories/GHSA-cg2g-xh64-v4q7', package: 'dompurify' }], '2026-10-24'), /an exception in tools\/audit-allowed\.json needs advisory, package, why and until/);
});

test('the exceptions kept in the repository each say why, and end within six months', () => {
  const kept = JSON.parse(readFileSync(join(import.meta.dirname, 'audit-allowed.json'), 'utf8'));
  for (const one of kept) {
    assert.match(one.advisory, /^https:\/\/github\.com\/advisories\/GHSA-/);
    assert.ok(one.why.length > 40, `${one.advisory}: say why it cannot reach an app`);
    assert.match(one.until, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(new Date(one.until) - new Date(one.reviewed) <= 183 * 86400000, `${one.advisory} is allowed for more than six months from its review`);
  }
});
