import type { Page, SectionNode, StepNode } from '@fieldia/core';
import { pages } from './sample-data';

/**
 * The 500-field page (examples/pages/big.page.json) for the survey editor:
 * each section a page of the survey, its questions one under another. The
 * same fields, rules and words; only the layout is a survey's.
 */
export function bigSurvey(): Page {
  const page = pages['big'];
  const sections = (page.layout as { children: SectionNode[] }).children;
  const steps: StepNode[] = sections.map((section) => ({
    type: 'step',
    id: section.id.replace('section', 'page'),
    label: section.title ?? '',
    // A survey's question takes the page's width: no columns to span.
    children: section.children.map((node) => {
      if (node.type !== 'field') return node;
      const { colspan: _colspan, ...rest } = node;
      return rest;
    }),
  }));
  return { ...page, id: 'supplier-survey', layout: { type: 'wizard', id: 'pages', children: steps } };
}
