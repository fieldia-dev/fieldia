import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { code } from './layout.mjs';

/**
 * A page of the repository's docs (docs/*.md) drawn as a page of fieldia.dev, so the two never drift: one source,
 * written in the part of Markdown these docs use — headings, paragraphs, lists, tables, fenced code, inline code, bold,
 * links. Anything else is refused as the site is built, rather than drawn wrong. A link to another of these docs goes
 * to its page on the site, one to a file of the repository to it on GitHub.
 */
const REPO = 'https://github.com/fieldia-dev/fieldia/blob/main/';
/** The docs that are pages of the site, by their file: the page each is. */
export const DOC_PAGES = { 'docs/agents.md': '/agents/', 'docs/promises.md': '/promises/' };

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>|`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A link's address as the site reads it, from a doc at `from`. */
function address(href, from) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [path, hash] = href.split('#');
  const file = new URL(path, `file:///${from}`).pathname.slice(1);
  const page = DOC_PAGES[file];
  if (page) return `${page}${hash ? `#${hash}` : ''}`;
  return `${REPO}${file}${hash ? `#${hash}` : ''}`;
}

/** A line's words: inline code, bold, links, the rest escaped. */
function inline(text, from) {
  const out = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    out.push(escape(text.slice(at, match.index)));
    if (match[1] !== undefined) out.push(`<code>${escape(match[1])}</code>`);
    else if (match[2] !== undefined) out.push(`<strong>${inline(match[2], from)}</strong>`);
    else out.push(`<a href="${escape(address(match[4], from))}">${inline(match[3], from)}</a>`);
    at = match.index + match[0].length;
  }
  out.push(escape(text.slice(at)));
  return out.join('');
}

/**
 * A doc of the repository as a page's body: its first heading its title, the rest drawn. `file`, its path from the
 * repository's root.
 */
export function markdownPage(file) {
  const lines = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n');
  const title = /^# (.+)$/.exec(lines[0] ?? '')?.[1];
  if (!title) throw new Error(`${file} starts with its title, as "# …"`);
  const out = [];
  let i = 1;
  const problem = (why) => {
    throw new Error(`${file}:${i + 1}: ${why} — the site draws headings, paragraphs, lists, tables, fenced code, inline code, bold and links`);
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{2,4}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level} id="${slug(heading[2])}">${inline(heading[2], file)}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      if (i >= lines.length) problem('a code block that does not end');
      out.push(code(lang, body.join('\n')));
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
      const cells = (row) => row.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
      if (!/^\|[\s:|-]+\|$/.test(rows[1] ?? '')) problem('a table needs its row of dashes under its heading');
      const head = cells(rows[0]).map((cell) => `<th scope="col">${inline(cell, file)}</th>`).join('');
      const body = rows.slice(2).map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell, file)}</td>`).join('')}</tr>`).join('');
      // Wider than a phone, it scrolls on its own, by keyboard too: named by its heading row.
      const named = escape(cells(rows[0]).join(', ').replace(/`/g, '')).replace(/"/g, '&quot;');
      out.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="${named}"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }
    const bullet = /^(- |\d+\. )/.exec(line);
    if (bullet) {
      const ordered = bullet[1] !== '- ';
      const items = [];
      for (; i < lines.length && lines[i].trim(); i++) {
        const own = /^(- |\d+\. )(.*)$/.exec(lines[i]);
        if (own) items.push(own[2]);
        else if (/^ {2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
        else problem('a list item is "- " or "1. ", a line under it two spaces in');
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((item) => `<li>${inline(item, file)}</li>`).join('')}</${tag}>`);
      continue;
    }
    // A paragraph may start in bold; a "* " list, a quote, HTML or a picture is not drawn.
    if (/^(#|>|\*(?!\*)|\+|<|!\[)/.test(line)) problem(`"${line.slice(0, 20)}" is not drawn`);
    const words = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,4} |```|\||- |\d+\. )/.test(lines[i]); i++) words.push(lines[i].trim());
    out.push(`<p>${inline(words.join(' '), file)}</p>`);
  }
  return { title, body: out.join('\n') };
}
