import type { ActionRequest, Locale } from '@fieldia/core';
import { FieldiaForm, useFormState, type FieldComponentProps, type SlotComponentProps } from '@fieldia/react';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import type { Skin } from '@fieldia/viewer';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { chatterSlot } from '@fieldia/chatter';
import { sampleChatter } from '../shared/sample-chatter';
import { createRoot } from 'react-dom/client';
import { clicked, greeting, shout } from '../shared/custom-page';
import { appPages, openRecord, optionsFromQuery, pageFromQuery, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { answerAction } from '../shared/order-desk';

/** The same demo as the plain one, mounted by React. StrictMode on, as apps run it. */
const params = new URLSearchParams(location.search);
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The "shout" field, as a React component. */
function Shout({ id, value, readonly, onChange }: FieldComponentProps) {
  return (
    <span className="demo-shout">
      <input id={id} className="fd-input" value={String(value ?? '')} readOnly={readonly} onChange={(e) => onChange(e.target.value || null)} />
      <output>{shout(value)}</output>
    </span>
  );
}

/** The "note" slot, as a React component with its own state. */
function Note({ form }: SlotComponentProps) {
  const [clicks, setClicks] = useState(0);
  const state = useFormState(form);
  return (
    <>
      <p className="demo-hello">{greeting(state.values['nickname'])}</p>
      <button type="button" className="fd-button" onClick={() => setClicks((n) => n + 1)}>
        {clicked(clicks)}
      </button>
    </>
  );
}

const chatter = sampleChatter();

/** The chatter in a React slot: a box it mounts into, for as long as the slot lives. */
function Chatter({ form }: SlotComponentProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => (box.current ? chatterSlot({ source: chatter, locale: (params.get('locale') as Locale | null) ?? undefined })(box.current, { form }) : undefined), [form]);
  return <div ref={box} />;
}

function Demo() {
  return (
    <FieldiaForm
      page={page}
      dataSource={dataSource}
      recordId={recordFromQuery(params, page)}
      onOpenRecord={(id) => openRecord(params, id)}
      skin={(params.get('skin') as Skin) ?? 'underline'}
      dir={params.get('dir') === 'rtl' ? 'rtl' : undefined}
      locale={(params.get('locale') as Locale | null) ?? undefined}
      onAction={(request) => {
        actions.push(request.action);
        requests.push(request);
        // The shop's answers to the pages' steps: the stock checked for "Order by phone".
        return answerAction(request, params.get('locale') ?? undefined);
      }}
      fieldTypes={{ 'char.shout': Shout }}
      widgets={{ ...gridWidgets, ...codeWidgets }}
      pages={appPages}
      {...optionsFromQuery(params)}
      slots={{ chatter: Chatter, note: Note }}
      onReady={(handle) => Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, requests, chatter } })}
    />
  );
}

createRoot(document.getElementById('app') as HTMLElement).render(
  <StrictMode>
    <Demo />
  </StrictMode>
);
