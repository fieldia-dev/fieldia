import { mountChatter, type ChatterHandle } from './chatter';
import { createMemoryChatter } from './memory';
import type { ChatterSource } from './source';

const me = { id: 1, name: 'Ramy Fathi' };
const mona = { id: 2, name: 'Mona Adel' };
const order = { model: 'sale.order', id: 7 };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function source() {
  return createMemoryChatter({
    me,
    people: [me, mona],
    now: () => new Date('2026-10-02T09:30:00Z'),
    records: {
      'sale.order:7': {
        messages: [
          { id: 2, kind: 'message', author: mona, date: '2026-10-01T10:00:00Z', body: '<p>Sent the <b>quotation</b>.<script>alert(1)</script><img src=x onerror="alert(2)"></p>' },
          { id: 1, kind: 'event', author: mona, date: '2026-10-01T08:00:00Z', body: '', tracking: [{ field: 'state', label: 'Status', from: 'Quotation', to: 'Quotation sent' }] },
        ],
      },
    },
  });
}

let handle: ChatterHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(chatter: ChatterSource = source(), record: { model: string; id: number } | null = order) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountChatter(host, { source: chatter, record });
  await flush();
  await flush();
  return host;
}
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
const messages = (root: Element) => [...root.querySelectorAll('.fd-message')] as HTMLElement[];
function type(box: HTMLTextAreaElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('the conversation', () => {
  it('shows the record’s messages newest first: who, when, what, and a tracked change as from → to', async () => {
    const host = await mount();
    const [sent, event] = messages(host);
    expect(sent.querySelector('.fd-message-author')?.textContent).toBe('Mona Adel');
    expect(sent.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T10:00:00Z');
    expect(sent.querySelector('.fd-message-body')?.textContent).toBe('Sent the quotation.');
    expect(event.querySelector('.fd-tracking')?.textContent).toBe('Status: Quotation → Quotation sent');
    expect(host.querySelector('[aria-label="Conversation"]')).not.toBeNull();
  });

  it('cleans a message’s HTML before showing it, keeping its formatting', async () => {
    const host = await mount();
    const body = messages(host)[0].querySelector('.fd-message-body') as HTMLElement;
    expect(body.querySelector('b')?.textContent).toBe('quotation');
    expect(body.querySelector('script')).toBeNull();
    expect(body.innerHTML).not.toContain('onerror');
  });

  it('sends a message to the followers from what was typed, as text, and shows it at the top', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    expect(box.placeholder).toBe('Write to the followers…');
    type(box, 'Delivery moved to the 11th.\nThe <b>van</b> is booked.');
    button(host, 'Send')!.click();
    await flush();
    await flush();
    expect(chatter.posted[0]).toEqual(expect.objectContaining({ kind: 'message', body: '<p>Delivery moved to the 11th.<br>The &lt;b&gt;van&lt;/b&gt; is booked.</p>' }));
    expect(messages(host)[0].querySelector('.fd-message-body')?.textContent).toBe('Delivery moved to the 11th.The <b>van</b> is booked.');
    expect(host.querySelector('.fd-composer')?.hasAttribute('hidden')).toBe(true);
  });

  it('logs a note for the team, marked as one, with Ctrl+Enter', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Log note')!.click();
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    expect(box.placeholder).toBe('Log an internal note…');
    type(box, 'Client prefers mornings.');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await flush();
    await flush();
    expect(chatter.posted[0].kind).toBe('note');
    expect(messages(host)[0].classList.contains('fd-message-note')).toBe(true);
    expect(messages(host)[0].querySelector('.fd-message-kind')?.textContent).toBe('Note');
  });

  it('sends nothing when nothing was typed, and Escape closes the composer', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, '   ');
    button(host, 'Send')!.click();
    await flush();
    expect(chatter.posted).toEqual([]);
    (host.querySelector('.fd-composer textarea') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.querySelector('.fd-composer')?.hasAttribute('hidden')).toBe(true);
  });

  it('waits for a record that is not saved yet, then shows its conversation', async () => {
    const host = await mount(source(), null);
    expect(host.textContent).toContain('The conversation starts once the record is saved.');
    expect(button(host, 'Send message')).toBeUndefined();
    await handle!.setRecord(order);
    await flush();
    expect(messages(host)).toHaveLength(2);
    expect(button(host, 'Send message')).toBeDefined();
  });

  it('says so when there is nothing yet', async () => {
    const host = await mount(source(), { model: 'sale.order', id: 99 });
    expect(host.querySelector('.fd-chatter-empty')?.textContent).toBe('No messages yet.');
  });
});

/** Picks files in a file box, as a person would. */
function choose(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('attachments', () => {
  it('uploads chosen files, shows them in the composer, and sends them: an image as a preview, a file as a link', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    const input = host.querySelector('.fd-composer input[type=file]') as HTMLInputElement;
    expect(button(host, 'Attach a file')).toBeDefined();
    choose(input, [new File(['png'], 'site.png', { type: 'image/png' }), new File(['plan'], 'plan.pdf', { type: 'application/pdf' })]);
    await until(() => host.querySelectorAll('.fd-composer .fd-attachment').length === 2);
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, 'Photos from the site.');
    button(host, 'Send')!.click();
    await until(() => chatter.posted.length);
    await flush();
    expect(chatter.posted[0].attachments?.map((a) => a.name)).toEqual(['site.png', 'plan.pdf']);
    const sent = messages(host)[0];
    expect(sent.querySelector('.fd-attachment img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    const file = sent.querySelector('a.fd-attachment-file') as HTMLAnchorElement;
    expect(file.textContent).toContain('plan.pdf');
    expect(file.textContent).toContain('4 bytes');
    expect(file.getAttribute('href')).toMatch(/^data:application\/pdf/);
    expect(host.querySelectorAll('.fd-composer .fd-attachment')).toHaveLength(0);
  });

  it('takes a file away before sending', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Log note')!.click();
    choose(host.querySelector('.fd-composer input[type=file]') as HTMLInputElement, [new File(['x'], 'old.txt', { type: 'text/plain' })]);
    await until(() => host.querySelector('.fd-composer .fd-attachment'));
    (host.querySelector('.fd-composer button[aria-label="Remove old.txt"]') as HTMLButtonElement).click();
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, 'Nothing attached after all.');
    button(host, 'Log')!.click();
    await until(() => chatter.posted.length);
    expect(chatter.posted[0].attachments).toEqual([]);
  });

  it('offers no attaching when the source cannot store files', async () => {
    const chatter = { ...source(), upload: undefined };
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    expect(button(host, 'Attach a file')).toBeUndefined();
  });
});

describe('reactions, replies and mentions', () => {
  it('shows each message’s reactions, and turns the person’s own on and off', async () => {
    const chatter = source();
    const host = await mount(chatter);
    const first = () => messages(host)[0];
    (first().querySelector('button[aria-label="Add a reaction"]') as HTMLButtonElement).click();
    (first().querySelector('.fd-reaction-picker button[data-emoji="🎉"]') as HTMLButtonElement).click();
    await until(() => first().querySelector('.fd-reaction'));
    const chip = first().querySelector('.fd-reaction') as HTMLButtonElement;
    expect(chip.textContent).toBe('🎉 1');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.click();
    await until(() => !first().querySelector('.fd-reaction'));
    expect(first().querySelector('.fd-reaction')).toBeNull();
  });

  it('offers no reactions when the source cannot keep them', async () => {
    const host = await mount({ ...source(), react: undefined });
    expect(messages(host)[0].querySelector('button[aria-label="Add a reaction"]')).toBeNull();
  });

  it('answers a message, saying whom to, and the answer says so too', async () => {
    const chatter = source();
    const host = await mount(chatter);
    (messages(host)[0].querySelector('button[aria-label="Reply"]') as HTMLButtonElement).click();
    expect(host.querySelector('.fd-composer .fd-replying')?.textContent).toBe('Replying to Mona Adel');
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, 'Thanks, received.');
    button(host, 'Send')!.click();
    await until(() => chatter.posted.length);
    await flush();
    expect(chatter.posted[0].parentId).toBe(2);
    expect(messages(host)[0].querySelector('.fd-message-parent')?.textContent).toBe('Replying to Mona Adel');
  });

  it('suggests people after an @, takes the one picked, and sends who was mentioned', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    type(box, 'Over to you @mo');
    box.setSelectionRange(box.value.length, box.value.length);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => host.querySelector('.fd-mentions [role=option]'));
    const options = [...host.querySelectorAll('.fd-mentions [role=option]')].map((o) => o.textContent);
    expect(options).toEqual(['Mona Adel']);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(box.value).toBe('Over to you @Mona Adel ');
    expect(host.querySelector('.fd-mentions')?.hasAttribute('hidden')).toBe(true);
    button(host, 'Send')!.click();
    await until(() => chatter.posted.length);
    expect(chatter.posted[0]).toEqual(expect.objectContaining({ mentions: [mona] }));
  });
});

describe('activities', () => {
  function planned() {
    return createMemoryChatter({
      me,
      people: [me, mona],
      now: () => new Date('2026-10-02T09:30:00Z'),
      activityTypes: [
        { id: 'call', name: 'Call', icon: 'phone', daysUntilDue: 2 },
        { id: 'todo', name: 'To-do', icon: 'check', daysUntilDue: 0 },
      ],
      records: {
        'sale.order:7': {
          activities: [
            { id: 51, type: { id: 'todo', name: 'To-do' }, summary: 'Send the floor plan', due: '2026-09-30', assignee: me },
            { id: 52, type: { id: 'call', name: 'Call' }, summary: 'Confirm the van', due: '2026-10-02', assignee: mona },
            { id: 53, type: { id: 'call', name: 'Call' }, summary: 'After-care visit', due: '2026-10-20', assignee: mona },
          ],
        },
      },
    });
  }
  async function mountPlanned(chatter = planned()) {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: chatter, record: order, now: () => new Date('2026-10-02T09:30:00Z') });
    await until(() => host.querySelector('.fd-activity'));
    return host;
  }
  const activities = (host: Element) => [...host.querySelectorAll('.fd-activity')] as HTMLElement[];

  it('lists what is to be done, overdue first, each marked overdue, today or planned', async () => {
    const host = await mountPlanned();
    expect(activities(host).map((a) => a.querySelector('.fd-activity-summary')?.textContent)).toEqual(['Send the floor plan', 'Confirm the van', 'After-care visit']);
    expect(activities(host).map((a) => a.getAttribute('data-when'))).toEqual(['overdue', 'today', 'planned']);
    expect(activities(host)[1].textContent).toContain('Mona Adel');
  });

  it('schedules an activity, its due date taken from its type until one is chosen', async () => {
    const chatter = planned();
    const host = await mountPlanned(chatter);
    button(host, 'Schedule activity')!.click();
    const form = host.querySelector('.fd-activity-form') as HTMLElement;
    await until(() => !form.hidden);
    const type = form.querySelector('select[name="type"]') as HTMLSelectElement;
    const due = form.querySelector('input[name="due"]') as HTMLInputElement;
    expect(due.value).toBe('2026-10-04'); // a call: in two days
    type.value = 'todo';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    expect(due.value).toBe('2026-10-02');
    (form.querySelector('input[name="summary"]') as HTMLInputElement).value = 'Book the electrician';
    (form.querySelector('select[name="assignee"]') as HTMLSelectElement).value = '2';
    button(form, 'Schedule')!.click();
    await until(() => activities(host).length === 4);
    expect(activities(host).map((a) => a.querySelector('.fd-activity-summary')?.textContent)).toContain('Book the electrician');
    expect(form.hidden).toBe(true);
  });

  it('marks one done with what came of it, which joins the conversation, and cancels another', async () => {
    const chatter = planned();
    const host = await mountPlanned(chatter);
    button(activities(host)[1], 'Mark done')!.click();
    const feedback = activities(host)[1].querySelector('textarea') as HTMLTextAreaElement;
    feedback.value = 'They want it on the 11th.';
    button(activities(host)[1], 'Done')!.click();
    await until(() => activities(host).length === 2);
    await until(() => messages(host).length);
    expect(messages(host)[0].textContent).toContain('They want it on the 11th.');
    button(activities(host)[1], 'Cancel activity')!.click();
    await until(() => activities(host).length === 1);
    expect(activities(host)[0].querySelector('.fd-activity-summary')?.textContent).toBe('Send the floor plan');
  });

  it('shows no activities when the source has none to give', async () => {
    const host = await mount({ ...source(), activities: undefined, schedule: undefined });
    expect(button(host, 'Schedule activity')).toBeUndefined();
    expect(host.querySelector('.fd-activities')).toBeNull();
  });
});
