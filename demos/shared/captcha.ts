import type { BotReport, Form } from '@fieldia/core';
import type { SlotRenderer } from '@fieldia/viewer';

/**
 * A stand-in for an app's captcha (Cloudflare Turnstile, Google reCAPTCHA, hCaptcha), drawn in the sign-up's
 * `captcha` slot as an app draws its own: a tick that "checks" for a moment, then hands its token to the form
 * (`form.botCheck({ captcha })`), which sends it with the answers. A real one is the service's own script in its place:
 *
 *   captcha: (element, { form }) => {
 *     const id = turnstile.render(element, { sitekey, callback: (token) => form.botCheck({ captcha: token }),
 *       'expired-callback': () => form.botCheck({ captcha: null }) });
 *     const spent = form.on('send', () => turnstile.reset(id));
 *     return () => (spent(), turnstile.remove(id));
 *   },
 *
 * A token is spent once sent: after each send the stand-in is unticked, as a service's widget is reset.
 */
export const captchaSlot: SlotRenderer = (element, { form }) => {
  const doc = element.ownerDocument;
  element.classList.add('demo-captcha');
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.id = 'demo-captcha-tick';
  box.className = 'fd-checkbox';
  const label = doc.createElement('label');
  label.htmlFor = box.id;
  label.textContent = 'I am a person';
  const said = doc.createElement('span');
  said.className = 'demo-captcha-said';
  said.setAttribute('role', 'status');
  const note = doc.createElement('small');
  note.textContent = 'A stand-in for your app’s captcha: Turnstile, reCAPTCHA or hCaptcha.';
  element.append(box, label, said, note);
  let timer: ReturnType<typeof setTimeout> | undefined;
  box.addEventListener('change', () => {
    clearTimeout(timer);
    form.botCheck({ captcha: null });
    said.textContent = box.checked ? 'Checking…' : '';
    if (!box.checked) return;
    timer = setTimeout(() => {
      form.botCheck({ captcha: `demo.${Math.random().toString(36).slice(2, 12)}` });
      said.textContent = 'Checked';
    }, 400);
  });
  // Spent once sent: unticked, as a service's widget is reset for the next response.
  const spent = form.on('send', () => {
    box.checked = false;
    said.textContent = '';
  });
  return () => {
    clearTimeout(timer);
    spent();
  };
};

/**
 * What the app was told with each response, in words: whether it looks like a bot, and why — the hidden box filled,
 * sent too soon after the page opened, the captcha ticked or not — as an app reads its bot check's report. The report
 * itself, as an app's data source gets it (`SubmitRequest.bot`), is under Details. An app keeps a response aside, asks
 * its captcha's service, or refuses it there.
 */
export function botLog(doc: Document, form: Form): HTMLElement {
  const element = doc.createElement('section');
  element.className = 'demo-error-log demo-bot-log';
  element.setAttribute('aria-labelledby', 'demo-bot-log-title');
  const title = doc.createElement('h2');
  title.id = 'demo-bot-log-title';
  title.textContent = 'What the app was told with each response';
  const empty = doc.createElement('p');
  empty.textContent = 'Nothing sent yet.';
  const list = doc.createElement('ol');
  element.append(title, empty, list);
  form.on('send', ({ bot }) => {
    empty.hidden = true;
    const item = doc.createElement('li');
    const said = doc.createElement('p');
    said.textContent = botWords(bot);
    const details = doc.createElement('details');
    const summary = doc.createElement('summary');
    summary.textContent = 'Details';
    const code = doc.createElement('code');
    code.textContent = JSON.stringify({ bot } satisfies { bot?: BotReport });
    details.append(summary, code);
    item.append(said, details);
    list.append(item);
  });
  return element;
}

/**
 * A bot check's report in a sentence, as an app would read it out: "Looks like a bot: a hidden field was filled; sent
 * 0.4 s after the page opened, sooner than a person can; the captcha was not ticked."
 */
export function botWords(bot: BotReport | undefined): string {
  if (!bot) return 'No bot check on this page.';
  const after = `${bot.seconds.toLocaleString('en', { maximumFractionDigits: 1 })} s after the page opened`;
  const why = [
    ...(bot.honeypot ? ['a hidden field was filled, which no person sees'] : []),
    bot.tooFast ? `sent ${after}, sooner than a person can` : `sent ${after}`,
    ...(bot.captcha === undefined ? [] : [bot.captcha ? 'the captcha was ticked' : 'the captcha was not ticked']),
  ];
  const verdict = bot.honeypot || bot.tooFast ? 'Looks like a bot' : bot.captcha === null ? 'Probably a person, but unchecked' : 'Looks like a person';
  return `${verdict}: ${why.join('; ')}.`;
}
