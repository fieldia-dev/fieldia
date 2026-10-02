import type { Locale } from '@fieldia/core';
import { FieldiaForm, useFormState, type FieldComponentProps, type SlotComponentProps } from '@fieldia/react';
import { gridWidgets } from '@fieldia/grid';
import type { Skin } from '@fieldia/viewer';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { clicked, greeting, shout } from '../shared/custom-page';
import { pages, sampleDataSource } from '../shared/sample-data';

/** The same demo as the plain one, mounted by React. StrictMode on, as apps run it. */
const params = new URLSearchParams(location.search);
const page = pages[params.get('page') ?? 'signup'] ?? pages['signup'];
const dataSource = sampleDataSource();
const actions: string[] = [];

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

function Activity() {
  return (
    <div className="demo-feed">
      <h3>Activity</h3>
      <p>
        <b>Mona Adel</b> confirmed order SO0018.
      </p>
      <p>
        <b>You</b> raised the credit limit to 250,000.
      </p>
    </div>
  );
}

function Demo() {
  return (
    <FieldiaForm
      page={page}
      dataSource={dataSource}
      recordId={page.data.kind === 'record' ? 1 : null}
      skin={(params.get('skin') as Skin) ?? 'underline'}
      dir={params.get('dir') === 'rtl' ? 'rtl' : undefined}
      locale={(params.get('locale') as Locale | null) ?? undefined}
      onAction={(request) => void actions.push(request.action)}
      fieldTypes={{ 'char.shout': Shout }}
      widgets={gridWidgets}
      slots={{ chatter: Activity, note: Note }}
      onReady={(handle) => Object.assign(window, { fieldiaDemo: { handle, dataSource, actions } })}
    />
  );
}

createRoot(document.getElementById('app') as HTMLElement).render(
  <StrictMode>
    <Demo />
  </StrictMode>
);
