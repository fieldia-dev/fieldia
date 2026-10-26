import { markdownPage } from '../markdown.mjs';

/** The guide for AI agents writing pages: docs/agents.md, drawn as a page of the site (site/markdown.mjs). */
const { title, body } = markdownPage('docs/agents.md');

export default {
  path: '/agents/',
  title,
  description: 'What a Fieldia page is, how to check one before it is stored, the mistakes the checks catch, and a worked example — for AI agents and the people who write pages.',
  body,
};
