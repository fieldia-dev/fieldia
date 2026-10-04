import type { ActionRequest, Locale } from '@fieldia/core';
import { mountViewer, type Skin } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { clicked, greeting, shout } from '../shared/custom-page';
import { chatterSlot } from '@fieldia/chatter';
import { sampleChatter } from '../shared/sample-chatter';
import { openRecord, optionsFromQuery, pageFromQuery, recordFromQuery, sampleDataSource, relatedPages } from '../shared/sample-data';
import { timeFirstPaint } from '../shared/timing';

/**
 * Fieldia with no framework at all: one script, one call. The page, skin and
 * direction come from the query string, so tests and people see the same thing.
 */
const params = new URLSearchParams(location.search);
const name = params.get('page') ?? 'signup';
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const chatter = sampleChatter();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The "shout" field, as a plain-DOM widget. */
const shoutWidget: WidgetFactory = ({ form, name: field, id, document }) => {
  const input = document.createElement('input');
  input.id = id;
  input.className = 'fd-input';
  const preview = document.createElement('output');
  const element = document.createElement('span');
  element.className = 'demo-shout';
  element.append(input, preview);
  input.addEventListener('input', () => form.setValue(field, input.value || null));
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const text = String(state.value ?? '');
      if (input.value !== text) input.value = text;
      preview.textContent = shout(state.value);
    },
  };
};

const opened = timeFirstPaint('viewer');
const handle = mountViewer(document.getElementById('app') as HTMLElement, {
  page,
  dataSource,
  recordId: recordFromQuery(params, page),
  onOpenRecord: (id) => openRecord(params, id),
  skin: (params.get('skin') as Skin) ?? 'underline',
  dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
  locale: (params.get('locale') as Locale | null) ?? undefined,
  onAction: (request) => {
    actions.push(request.action);
    requests.push(request);
  },
  widgets: { 'char.shout': shoutWidget, ...gridWidgets, ...codeWidgets },
  relatedPages,
  ...optionsFromQuery(params),
  slots: {
    // The record's conversation, to-dos and followers, beside it.
    chatter: chatterSlot({ source: chatter, locale: (params.get('locale') as Locale | null) ?? undefined, dir: params.get('dir') === 'rtl' ? 'rtl' : undefined }),
    note: (element, { form }) => {
      let clicks = 0;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fd-button';
      button.textContent = clicked(0);
      button.addEventListener('click', () => (button.textContent = clicked(++clicks)));
      const hello = document.createElement('p');
      hello.className = 'demo-hello';
      const show = () => (hello.textContent = greeting(form.getState().values['nickname']));
      show();
      const leave = form.subscribe(show);
      element.className += ' demo-note';
      element.append(hello, button);
      return leave;
    },
  },
});
opened();

Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, requests, chatter } });
