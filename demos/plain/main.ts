import { mountViewer, type Skin } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import { clicked, greeting, shout } from '../shared/custom-page';
import { pages, sampleDataSource } from '../shared/sample-data';

/**
 * Fieldia with no framework at all: one script, one call. The page, skin and
 * direction come from the query string, so tests and people see the same thing.
 */
const params = new URLSearchParams(location.search);
const name = params.get('page') ?? 'signup';
const page = pages[name] ?? pages['signup'];
const dataSource = sampleDataSource();
const actions: string[] = [];

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

const handle = mountViewer(document.getElementById('app') as HTMLElement, {
  page,
  dataSource,
  recordId: page.data.kind === 'record' ? 1 : null,
  skin: (params.get('skin') as Skin) ?? 'underline',
  dir: params.get('dir') === 'rtl' ? 'rtl' : 'ltr',
  onAction: (request) => void actions.push(request.action),
  widgets: { 'char.shout': shoutWidget },
  slots: {
    chatter: (element) => {
      element.innerHTML =
        '<div class="demo-feed"><h3>Activity</h3><p><b>Mona Adel</b> confirmed order SO0018.</p><p><b>You</b> raised the credit limit to 250,000.</p></div>';
    },
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

Object.assign(window, { fieldiaDemo: { handle, dataSource, actions } });
