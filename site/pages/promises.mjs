import { markdownPage } from '../markdown.mjs';

/** What Fieldia promises: docs/promises.md, drawn as a page of the site (site/markdown.mjs), held to its gates by tools/promises.test.mjs. */
const { title, body } = markdownPage('docs/promises.md');

export default {
  path: '/promises/',
  title,
  description: 'What Fieldia guarantees in the browser and what your server must still check, how it changes between versions, how fast it is, and the browsers it runs in — each promise with the test that holds it.',
  body,
};
