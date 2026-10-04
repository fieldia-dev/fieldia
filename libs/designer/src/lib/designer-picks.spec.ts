import { employeeDesigner } from './test-layout';

/** Several parts picked at once, alongside the one being edited; what stays picked through undo, redo and removing. */

const picked = (d: ReturnType<typeof employeeDesigner>) => d.getState().picked;

describe('several picked', () => {
  it('picks one, adds more, and lets one go when it is picked again; the one picked last leads', () => {
    const d = employeeDesigner();
    d.pick('f-first_name');
    d.pick('f-last_name', { add: true });
    d.pick('f-email', { add: true });
    expect([picked(d), d.getState().selected]).toEqual([['f-first_name', 'f-last_name', 'f-email'], 'f-email']);
    d.pick('f-email', { add: true });
    expect([picked(d), d.getState().selected]).toEqual([['f-first_name', 'f-last_name'], 'f-last_name']);
    d.pick('f-first_name', { add: true });
    expect([picked(d), d.getState().selected]).toEqual([['f-last_name'], 'f-last_name']);
    d.pick('f-last_name', { add: true });
    expect([picked(d), d.getState().selected]).toEqual([[], null]);
    d.pick('f-mobile', { add: true });
    d.pick('f-city');
    expect([picked(d), d.getState().selected]).toEqual([['f-city'], 'f-city']);
  });

  it('keeps today’s single pick working: select, and an editor that picks what it made', () => {
    const d = employeeDesigner();
    d.pick('f-first_name');
    d.pick('f-last_name', { add: true });
    d.select('f-email');
    expect(picked(d)).toEqual(['f-email']);
    d.select(null);
    expect(picked(d)).toEqual([]);
    d.pick('f-first_name');
    d.pick('f-last_name', { add: true });
    const made = d.addQuestion('short-answer', { after: 'f-confirm' }) as string;
    expect([picked(d), d.getState().selected]).toEqual([[made], made]);
    d.removeNode(made);
    expect([picked(d), d.getState().selected]).toEqual([[], null]);
  });

  it('tells every listener what is picked', () => {
    const d = employeeDesigner();
    const seen: string[][] = [];
    d.subscribe((state) => seen.push(state.picked));
    d.pick('f-first_name');
    d.pick('f-last_name', { add: true });
    expect(seen).toEqual([['f-first_name'], ['f-first_name', 'f-last_name']]);
  });

  it('undo brings back what was picked when what is picked went with the edit', () => {
    const d = employeeDesigner();
    d.pick('f-first_name');
    d.pick('f-last_name', { add: true });
    d.wrap(picked(d), 'group');
    d.undo();
    expect([picked(d), d.getState().selected]).toEqual([['f-first_name', 'f-last_name'], 'f-last_name']);
    // Still on the page after redo: they stay picked.
    d.redo();
    expect(picked(d)).toEqual(['f-first_name', 'f-last_name']);
  });

  it('undo and redo keep what is picked while it is on the page, and come back to a new part once it is back', () => {
    const d = employeeDesigner();
    const id = d.place({ kind: 'email' }, { how: 'into', container: 'emergency' }) as string;
    d.undo();
    expect([picked(d), d.getState().selected]).toEqual([[], null]);
    d.redo();
    expect([picked(d), d.getState().selected]).toEqual([[id], id]);
    d.pick('f-mobile');
    d.undo();
    expect(picked(d)).toEqual(['f-mobile']);
    d.redo();
    expect(picked(d)).toEqual(['f-mobile']);
  });

  it('remove lets go of what it took, and of what was in it', () => {
    const d = employeeDesigner();
    d.pick('f-street');
    d.pick('emergency', { add: true });
    d.pick('f-city', { add: true });
    d.remove(['address']);
    expect([picked(d), d.getState().selected]).toEqual([['emergency'], 'emergency']);
  });
});
