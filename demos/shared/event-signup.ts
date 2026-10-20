import { dayIn, type LimitsResult, type MemoryDataSource, type Page } from '@fieldia/core';
import eventSignup from '../../examples/pages/event-signup.page.json';

/**
 * The founders' evening's sign-up (examples/pages/event-signup.page.json): a page of responses with open and close
 * dates, the most responses, one from each person, and places for each session and extra — counted by the demo's
 * memory source as an app's server would (`limits`), starting from the sign-ups already in.
 */

const DAY = 86400000;
/** Cairo's day `offset` days from now: the sign-up's dates follow the real clock, so a visit any day finds it open. */
const cairoDay = (offset: number) => dayIn(Date.now() + offset * DAY, 'Africa/Cairo');

/**
 * The page as the app gives it: it opened three weeks ago at 09:00 and closes in three weeks at 18:00, Cairo time.
 * The demos' clock (`?now=`) opens it before sign-ups open or after they close.
 */
export function eventSignupPage(): Page {
  const page = eventSignup as Page;
  return { ...page, limits: { ...page.limits, opens: `${cairoDay(-21)}T09:00`, closes: `${cairoDay(21)}T18:00` } };
}

/** What the server has counted already: 147 sign-ups, the morning two places from full, the afternoon full, the parking taken. */
export const EVENT_COUNTS: Record<string, LimitsResult> = {
  'event-signup': { responses: 147, perChoice: { session: { morning: 28, afternoon: 25, evening: 94 }, extras: { lunch: 39, parking: 15 } } },
};

/**
 * A bar over the sign-up: two people take the morning workshop's last places on other screens, as can happen while
 * someone fills it in. The page asks the server again as the answers go: a morning picked here is said full, never sent.
 */
export function lastPlacesBar(dataSource: MemoryDataSource): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fd-button';
  button.textContent = 'Two people sign up for the morning workshop';
  const said = document.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  said.textContent = 'Sign-ups that land on other screens while this one is filled in.';
  button.addEventListener('click', () => {
    dataSource.answeredElsewhere('event-signup', { session: 'morning' });
    dataSource.answeredElsewhere('event-signup', { session: 'morning' });
    button.hidden = true;
    said.textContent = 'Two people signed up for the morning workshop on other screens: its last two places are taken. This page finds out as it sends its answers.';
  });
  bar.append(button, said);
  return bar;
}
