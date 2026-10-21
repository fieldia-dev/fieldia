import { createForm, createMemoryDataSource, type Page } from '@fieldia/core';
import { filesPart, textPart } from '@fieldia/widgets';
import { mountChatter } from './chatter';
import { channelsPart, discussionPart, historyPart } from './chatter-parts';
import { historySlot } from './history-slot';
import { createMemoryChatter } from './memory';
import { chatterSlot } from './slot';
import type { Attachment, ChatterSource, RecordRef } from './source';

/**
 * Before their parts have come (parts.ts in @fieldia/widgets): a Discussion
 * and a History are drawn once their code — and the Discussion's editor — has
 * come, for the record the form shows by then; a chatter of messages and notes
 * needs neither, and is drawn at once — its composer's files on their way come
 * with the files part, the first time one is chosen. This file starts with no
 * part loaded.
 */

const me = { id: 1, name: 'Ramy Fathi' };
const page = {
  fieldia: '0.1',
  id: 'item',
  title: 'Item',
  data: { kind: 'record', model: 'work.item' },
  fields: { title: { type: 'char', label: 'Title' }, state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }] } },
  layout: { type: 'sections', id: 's', children: [] },
} as unknown as Page;
const message = (id: number, body: string) => ({ id, kind: 'message' as const, author: me, date: '2026-10-01T10:00:00Z', body });
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(check()).toBeTruthy();
}

afterEach(() => document.body.replaceChildren());

describe('a chatter slot before its parts came', () => {
  it('draws a chatter of messages at once, asking for no part', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    const stop = chatterSlot({ source: createMemoryChatter({ me }) })(element, { form });
    expect(element.querySelector('.fd-chatter')).not.toBeNull();
    expect([discussionPart.loaded, historyPart.loaded, textPart.loaded, channelsPart.loaded]).toEqual([undefined, undefined, undefined, undefined]);
    stop();
  });

  it('draws a Discussion once its code and its editor have come, for the record shown by then', async () => {
    const source = createMemoryChatter({ me, records: { 'work.item:2': { messages: [message(1, '<p>On the second.</p>')] } } });
    const dataSource = createMemoryDataSource({ records: { 'work.item': { 1: { title: 'One' }, 2: { title: 'Two' } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = chatterSlot({ source, look: 'discussion' })(element, { form });
    expect(element.children).toHaveLength(0);
    // The form moves to another record before the code has come: the Discussion is drawn for that one.
    await form.openRecord(2);
    await until(() => element.querySelector('.fd-comment-card'));
    expect(element.querySelector('.fd-comment-body')?.textContent).toBe('On the second.');
    expect(discussionPart.loaded && textPart.loaded).toBeTruthy();
    stop();
  });

  it('draws a History once its code has come; destroyed before, never', async () => {
    const source = createMemoryChatter({ me });
    const form = createForm({ page, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: { title: 'One' } } } }), recordId: 1 });
    await form.load();
    const gone = document.createElement('div');
    document.body.append(gone);
    historySlot({ source })(gone, { form })();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = historySlot({ source })(element, { form });
    expect(element.children).toHaveLength(0);
    await until(() => element.querySelector('.fd-history'));
    expect(gone.children).toHaveLength(0);
    // From now on, at once.
    const now = document.createElement('div');
    const again = historySlot({ source })(now, { form });
    expect(now.querySelector('.fd-history')).not.toBeNull();
    again();
    stop();
  });
});

describe('a composer’s files before the files part came', () => {
  it('holds no list of files on their way; a file chosen asks for the part, then goes with its bar, in the part’s sheet', async () => {
    expect(filesPart.loaded).toBeUndefined();
    const sent: string[] = [];
    // A store that keeps each file on its way: the test looks at it going.
    const upload = (_record: RecordRef, file: File) => new Promise<Attachment>(() => sent.push(file.name));
    const source = { ...createMemoryChatter({ me, records: { 'sale.order:7': { messages: [] } } }), upload } as ChatterSource;
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountChatter(host, { source, record: { model: 'sale.order', id: 7 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Send message') as HTMLButtonElement).click();
    expect(host.querySelector('.fd-composer .fd-files')).toBeNull();
    expect(filesPart.loaded).toBeUndefined();
    const input = host.querySelector('.fd-composer input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['%PDF'], 'Quote.pdf', { type: 'application/pdf' })], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => host.querySelector('.fd-composer .fd-file-going'));
    expect(filesPart.loaded).toBeDefined();
    expect(host.querySelector('.fd-composer .fd-files .fd-file-going .fd-file-name')?.textContent).toBe('Quote.pdf');
    expect(document.getElementById('fieldia-files-styles')).not.toBeNull();
    expect(sent).toEqual(['Quote.pdf']);
    handle.destroy();
  });
});

describe('a conversation that knows its channels, before the channels part came', () => {
  it('sends nothing before it knows them, and draws its messages, their channels and its choice of channel once the part is in', async () => {
    expect(channelsPart.loaded).toBeUndefined();
    const mona = { id: 2, name: 'Mona Adel' };
    const source = createMemoryChatter({
      me,
      records: { 'enquiry:1': { messages: [{ id: 1, kind: 'message', author: mona, date: '2026-10-20T08:30:00Z', body: '<p>Is it still for sale?</p>', channel: 'whatsapp', direction: 'in' }] } },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountChatter(host, { source, record: { model: 'enquiry', id: 1 }, channels: [{ id: 'whatsapp', label: 'WhatsApp' }] });
    const send = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Send message') as HTMLButtonElement;
    expect(send.hidden).toBe(true);
    await until(() => host.querySelector('.fd-message'));
    expect(channelsPart.loaded).toBeDefined();
    expect(host.querySelector('.fd-message-channel')?.textContent).toBe('WhatsApp');
    expect(document.getElementById('fd-chatter-channels-styles')).not.toBeNull();
    expect(send.hidden).toBe(false);
    send.click();
    expect(host.querySelector('.fd-send-by input:checked')?.closest('label')?.textContent).toBe('WhatsApp');
    handle.destroy();
  });
});
