import type { SectionNode } from './layout';
import { wideColumns } from './columns';

/**
 * A group's own widths and controls, checked as a page is shown: its columns'
 * widths one for each column, its fold control where it can fold, its ⤢
 * where a heading can hold it. Plain checks, no validation library: the
 * viewer runs them too.
 */

/** A column's width: pixels ("274px"), a share of the row ("50%") or of what is left ("1fr"). */
export const SECTION_TRACK = /^\d+(\.\d+)?(px|%|fr)$/;

export function checkSectionTracks(node: SectionNode, path: string, report: (path: string, message: string) => void): void {
  if (node.tracks !== undefined) {
    const columns = wideColumns(node.columns);
    if (node.style === 'inline') report(`${path}.tracks`, 'parts on one line take no column widths: each is as wide as it needs');
    else if (node.columns === undefined) report(`${path}.tracks`, 'column widths need columns: give the group as many columns as widths');
    else if (node.tracks.length !== columns) report(`${path}.tracks`, `the group has ${columns} column${columns === 1 ? '' : 's'} and ${node.tracks.length} width${node.tracks.length === 1 ? '' : 's'}: give one width for each column`);
    node.tracks.forEach((track, i) => {
      if (typeof track !== 'string' || !SECTION_TRACK.test(track)) report(`${path}.tracks[${i}]`, `"${track}" is no width: write pixels ("274px"), a share of the row ("50%") or of what is left ("1fr")`);
    });
  }
  if (node.foldAt !== undefined && !node.collapsible) report(`${path}.foldAt`, 'the fold control’s place needs a group that folds: collapsible: true');
  if (node.maximise && !node.title) report(`${path}.maximise`, 'a group is maximised from its heading: give it a title');
  if (node.maximise && node.style === 'inline') report(`${path}.maximise`, 'a line of parts has no heading to maximise it from');
}
