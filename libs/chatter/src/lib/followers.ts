import { fill } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Follower, Person } from './source';

/**
 * Who follows the record: a button with their number, opening the list, where
 * each can be taken away and others found by name and added. Every part the
 * source cannot do is left out, and all of it without `followers`.
 */
export function followersPart(context: ChatterContext) {
  const { el, labels, source, doc, icons } = context;
  if (!source.followers) return { button: null, element: null, load: async () => undefined };
  const icon = drawIcon(doc, 'users', icons);
  const count = el('span', { class: 'fd-followers-count' }, '0');
  const button = el('button', { type: 'button', class: 'fd-button fd-followers-toggle', 'aria-expanded': 'false' }, ...(icon ? [icon] : []), count);
  const list = el('ul', { class: 'fd-follower-list' });
  const none = el('p', { class: 'fd-followers-none', hidden: '' }, labels.noFollowers);
  const find = el('input', { type: 'search', class: 'fd-input', placeholder: labels.search, 'aria-label': labels.addFollower });
  const candidates = el('ul', { class: 'fd-follower-candidates', role: 'listbox', 'aria-label': labels.addFollower });
  const adding = source.follow && source.people ? el('div', { class: 'fd-followers-add' }, el('span', { class: 'fd-followers-add-title' }, labels.addFollower), find, candidates) : null;
  const element = el('div', { class: 'fd-followers', hidden: '', role: 'group', 'aria-label': labels.followers }, list, none, ...(adding ? [adding] : []));
  let followers: Follower[] = [];
  let asking = 0;

  function draw() {
    count.textContent = String(followers.length);
    button.setAttribute('aria-label', `${labels.followers}: ${followers.length}`);
    none.hidden = followers.length > 0;
    list.replaceChildren(
      ...followers.map((follower) => {
        const row = el('li', { class: 'fd-follower' }, el('span', { class: 'fd-follower-name' }, follower.person.name));
        if (source.unfollow) {
          const remove = el('button', { type: 'button', class: 'fd-attachment-remove', 'aria-label': fill(labels.removeFollower, { name: follower.person.name }) }, '×');
          remove.addEventListener('click', async () => {
            const record = context.record();
            if (!record || !source.unfollow) return;
            await source.unfollow(record, follower.id);
            await load();
          });
          row.append(remove);
        }
        return row;
      })
    );
  }

  async function suggest() {
    if (!source.people) return;
    const mine = ++asking;
    const people = await source.people(find.value);
    if (mine !== asking) return;
    const following = new Set(followers.map((f) => f.person.id));
    const offered = people.filter((person) => !following.has(person.id)).slice(0, 8);
    candidates.replaceChildren(
      ...(offered.length
        ? offered.map((person: Person) => {
            const option = el('li', { role: 'option', 'aria-selected': 'false' }, person.name);
            option.addEventListener('click', async () => {
              const record = context.record();
              if (!record || !source.follow) return;
              await source.follow(record, person.id);
              find.value = '';
              candidates.replaceChildren();
              await load();
            });
            return option;
          })
        : [el('li', { class: 'fd-empty' }, labels.noOneFound)])
    );
  }

  async function load() {
    const record = context.record();
    if (!record || !source.followers) return;
    followers = await source.followers(record);
    if (context.record() === record) draw();
  }

  button.addEventListener('click', () => {
    element.hidden = !element.hidden;
    button.setAttribute('aria-expanded', String(!element.hidden));
    if (!element.hidden && adding) find.focus();
  });
  find.addEventListener('input', () => void suggest());
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      element.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    }
  });
  draw();
  return { button, element, load };
}
