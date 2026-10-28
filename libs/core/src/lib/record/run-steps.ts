import type { ActionStep, OpenStep, ValueMap } from '../format/actions';
import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import type { Modifier, Tone } from '../format/layout';
import { compileExpression, type CompiledExpression } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { FIELD_NAME } from '../format/names';
import { plainWords, splitValues } from '../format/words';
import { fitTo } from './compute';
import { resolveFilter } from './filter';
import { emptyValue, sameValue, structuredCopy, type Line, type RecordId, type RelatedRecord, type Value, type Values } from './values';
import { LINK_URL, safeUrl } from '../safe-url';
import { askOf, DONE, takenNow, type ActionRequest, type ActionResult, type OpenRequest, type OpenResult, type RunForm, type RunResult, type RunScope, type RunStop, type Stopped, type UndoKit } from './run';

/**
 * The engine that runs steps against a form (run.ts names what it runs and how a run ends): in a part of its own with
 * what draws a dialog, a page opened and a question asked (the acts part, `formActsPart`) — no page draws from it, so
 * it is asked for once the page is drawn and its whole check has come, or by the first press or moment that runs steps.
 */

/** The kinds of field an expression gives a value to; the rest hold records, lines or files, and take a field named alone whole. */
const EXPRESSIBLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

const wordsOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Steps run against one form. Expressions are read once and kept. */
export function createRunner(form: RunForm) {
  const expressions = new Map<string, CompiledExpression>();
  const conditions = new Map<string, CompiledModifier>();

  /** The app's functions the form's expressions call: one table for the form's life. */
  const functions = () => form.reading().env.functions;
  const expression = (source: string) => {
    let found = expressions.get(source);
    if (!found) expressions.set(source, (found = compileExpression(source, functions())));
    return found;
  };

  function holds(when: Modifier): boolean {
    if (typeof when === 'boolean') return when;
    let found = conditions.get(when);
    if (!found) conditions.set(when, (found = compileModifier(when, functions())));
    const { context, env } = form.reading();
    return found.evaluate(context, env);
  }

  /** A field named alone, when its value is taken whole. */
  const named = (source: string) => {
    const name = source.trim();
    return FIELD_NAME.test(name) ? name : null;
  };

  /** An expression over this form's values. A field named alone is taken whole when `whole` — a link with its name, the lines themselves. */
  function read(source: string, whole: boolean): unknown {
    const name = named(source);
    if (whole && name !== null && name in form.fields) return structuredCopy(form.values()[name]);
    const { context, env } = form.reading();
    return expression(source).evaluate(context, env);
  }

  /** The name this form knows a record by, from a link to the same model it holds. */
  function knownLabel(relation: string, id: RecordId): string | undefined {
    const values = form.values();
    for (const [name, def] of Object.entries(form.fields)) {
      if ((def.type !== 'many2one' && def.type !== 'many2many') || def.relation !== relation) continue;
      const held = values[name];
      const records = (Array.isArray(held) ? held : held ? [held] : []) as RelatedRecord[];
      const found = records.find((record) => record && record.id === id);
      if (found) return found.label;
    }
    return undefined;
  }

  /** What a value from an expression, the app or another form becomes in a field: a link from an id or a record, anything else as `compute` fits it. */
  function fit(def: Field | LineField, raw: unknown, label: (id: RecordId) => string | undefined = () => undefined): Value {
    const link = (item: unknown): RelatedRecord | null => {
      if (item === null || item === undefined || item === false || item === '') return null;
      const relation = (def as { relation: string }).relation;
      const labelOf = (id: RecordId) => label(id) ?? knownLabel(relation, id) ?? String(id);
      if (typeof item === 'number' || typeof item === 'string') return { id: item, label: labelOf(item) };
      if (typeof item === 'object' && !Array.isArray(item) && 'id' in item) {
        const record = item as { id: RecordId; label?: unknown };
        return { id: record.id, label: typeof record.label === 'string' ? record.label : labelOf(record.id) };
      }
      return null;
    };
    if (def.type === 'many2one') return link(raw);
    if (def.type === 'many2many') return (Array.isArray(raw) ? raw : [raw]).map(link).filter((record): record is RelatedRecord => record !== null);
    return fitTo(def, raw);
  }

  function fieldOf(name: string): Field {
    const def = form.fields[name];
    if (!def) throw new Error(`The page has no field "${name}"`);
    return def;
  }

  /** Write as a step does, noting in the run what each field held before its first write and what it holds now. */
  function writeIn(scope: RunScope, names: readonly string[], write: () => void) {
    const journal = (scope.wrote ??= new Map());
    const before = new Map(names.filter((name) => !journal.has(name)).map((name) => [name, { before: structuredCopy(form.values()[name] ?? null) as Value, mine: form.mine(name) }]));
    write();
    for (const name of names) {
      const first = journal.get(name) ?? before.get(name);
      if (first) journal.set(name, { before: first.before, mine: first.mine, after: structuredCopy(form.values()[name] ?? null) as Value });
    }
  }

  /** Words a run says: held, for a press that offers Undo, to be said as it ends; else said now. */
  function tell(scope: RunScope | null, message: string, tone: Tone) {
    if (scope?.taken) scope.taken.said.push({ message, tone });
    else form.host?.say(message, tone);
  }

  /**
   * The run's save was refused: what its steps wrote since its last save is put back, each field only while it
   * still holds what they wrote — a change made since by anyone else stays.
   */
  function putBack(scope: RunScope) {
    const journal = scope.wrote;
    if (!journal?.size) return;
    const back: Values = {};
    const mine: string[] = [];
    // On the record it wrote to: another shown since holds none of it.
    if (form.generation() === scope.generation) {
      for (const [name, { before, mine: was, after }] of journal) {
        if (!sameValue(form.values()[name], after)) continue;
        back[name] = before;
        if (was) mine.push(name);
      }
    }
    journal.clear();
    if (Object.keys(back).length) form.putBack(back, mine);
  }

  const ask = (message: string, yes?: string): Promise<boolean> => askOf(form, message, yes);

  function cannot(message: string): Stopped {
    return { reason: 'cannot', message };
  }

  /**
   * THE rule for every wait a step makes — a page opened, the app's call, the source archiving, copying, deleting:
   * what follows it is for the record the run is on, and is done only while that one is still shown. Another shown
   * meanwhile — by the pager, the app, anything but the run's own steps — the answer is laid on no record.
   */
  const replaced = (scope: RunScope) => form.generation() !== scope.generation;

  /** Open a page through the host, take its answers back, and run its `then`. */
  async function open(step: Omit<OpenStep, 'do' | 'when'>, scope: RunScope): Promise<Stopped | null> {
    const host = form.host;
    if (!host) return cannot(`Nothing can open "${step.page}" here: the form has no host`);
    const record = step.record !== undefined ? read(step.record, false) : null;
    const request: OpenRequest = {
      page: step.page,
      ...(step.version !== undefined ? { version: step.version } : {}),
      as: step.as ?? 'dialog',
      ...(step.side && step.as === 'panel' ? { side: step.side } : {}),
      ...(step.title !== undefined ? { title: plainWords(step.title) } : {}),
      recordId: typeof record === 'number' || (typeof record === 'string' && record !== '') ? record : null,
      ...(step.values ? { values: readMap(step.values) } : {}),
      ...(step.filter ? { filter: resolveFilter(step.filter, form.reading().context) } : {}),
    };
    let result: OpenResult;
    try {
      result = await host.open(request);
    } catch (error) {
      return { reason: 'cannot', message: wordsOf(error), error };
    }
    if (!result.saved) return { reason: 'closed' };
    // Its answers are for the record that opened it: another shown meanwhile takes none of them.
    if (replaced(scope)) return form.gone();
    if (step.into) {
      const values = into(step.into, result);
      writeIn(scope, Object.keys(values), () => form.write(values, scope.chain));
    }
    if (!step.then) return null;
    const then = await runSteps(step.then, scope, true);
    return then.done ? null : { reason: then.reason as RunStop, message: then.message, step: then.step, error: then.error };
  }

  /** What a new page starts with: each an expression over this form's values, a field named alone taken whole. */
  function readMap(map: ValueMap): Values {
    const values: Values = {};
    for (const [name, source] of Object.entries(map)) values[name] = (read(source, true) ?? null) as Value;
    return values;
  }

  /**
   * This form's fields from an opened page's answers: each an expression over
   * its values, where `id` is the record it saved. A link set to that record
   * is labelled by the host's `label`, else its `display_name`, else its
   * `name`, else its id.
   */
  function into(map: ValueMap, result: OpenResult): Values {
    const answers = result.values ?? {};
    const id = result.recordId ?? null;
    const context: Record<string, unknown> = { ...asRead(answers), id };
    const title = [result.label, answers['display_name'], answers['name']].find((text): text is string => typeof text === 'string' && text !== '');
    const label = (other: RecordId) => (other === id ? title : undefined);
    const values: Values = {};
    for (const [name, source] of Object.entries(map)) {
      const def = fieldOf(name);
      const alone = named(source);
      const raw = alone === 'id' ? id : alone !== null && !EXPRESSIBLE.has(def.type) && alone in answers ? answers[alone] : expression(source).evaluate(context, { today: form.today, functions: functions() });
      values[name] = fit(def, raw, label);
    }
    return values;
  }

  async function call(step: { action: string; params?: { [key: string]: JsonValue } }, scope: RunScope): Promise<Stopped | null> {
    const request: ActionRequest = {
      id: scope.id,
      action: step.action,
      ...(step.params ? { params: structuredCopy(step.params) } : {}),
      recordId: form.recordId(),
      values: structuredCopy(form.values() as Values),
      ...(scope.recordIds ? { recordIds: [...scope.recordIds] } : {}),
      ...(scope.line ? { line: structuredCopy(scope.line) } : {}),
      ...(scope.lines ? { lines: structuredCopy(scope.lines) } : {}),
    };
    if (!form.onAction) return null;
    let answer: ActionResult | undefined;
    try {
      answer = (await form.onAction(request)) ?? undefined;
    } catch (error) {
      return { reason: 'app', message: wordsOf(error), error };
    }
    form.answered(request, answer);
    // A press offering Undo whose call the app answered with no way back: Fieldia cannot take it back by itself.
    if (scope.taken && !answer?.undo) scope.taken.beyond = 'call';
    if (!answer) return null;
    // The app's own undo for what it did: its words are held to be said with Undo.
    if (answer.undo) (scope.taken ??= takenNow()).app.push(answer.undo);
    return answered(answer, scope);
  }

  /** The app's answer to a call, or to its own undo, laid over the form: values, words, a reload, another record… */
  async function answered(answer: ActionResult, scope: RunScope): Promise<Stopped | null> {
    // Answered for a record no longer shown: nothing of it is laid over the one shown now. Its words to the person are
    // laid over no record, and are said still — a dialog's "Payment … posted", answered as it closed, as before.
    if (replaced(scope)) {
      if (answer.say !== undefined) {
        const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
        tell(scope, said.message, said.tone ?? 'info');
      }
      return form.gone();
    }
    // The server's record first, then what the app says over it.
    if (answer.reload) {
      const reloaded = await ownMove(scope, () => form.reload(scope.chain));
      if (reloaded) return reloaded;
    }
    if (answer.stored) {
      const known: Values = {};
      for (const [name, value] of Object.entries(answer.stored)) if (name in form.fields) known[name] = fit(form.fields[name], value);
      form.store(known);
    }
    if (answer.values) {
      const known: Values = {};
      for (const [name, value] of Object.entries(answer.values)) if (name in form.fields) known[name] = fit(form.fields[name], value);
      writeIn(scope, Object.keys(known), () => form.write(known, scope.chain));
    }
    if (answer.say !== undefined) {
      const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
      tell(scope, said.message, said.tone ?? 'info');
    }
    if (answer.post !== undefined) {
      const posted = typeof answer.post === 'string' ? { message: answer.post } : answer.post;
      const stopped = await post(posted.message, posted.kind ?? 'note', false);
      if (stopped) return stopped;
      // Posted while another record was shown: the rest of the answer is not for that one.
      if (replaced(scope)) return form.gone();
    }
    if (answer.record !== undefined) {
      const moved = await ownMove(scope, () => form.showRecord(answer.record as RecordId | null, scope.chain));
      if (moved) return moved;
    }
    if (answer.file) {
      const host = form.host;
      if (!host?.file) return cannot(`Nothing can show the file "${answer.file.name}" here: the form has no host that shows files`);
      await host.file(answer.file);
    }
    if (answer.open) {
      const opened = await open(answer.open, scope);
      if (opened) return opened;
    }
    if (answer.stop) {
      if (typeof answer.stop === 'string') tell(scope, answer.stop, 'warning');
      return { reason: 'app', ...(typeof answer.stop === 'string' ? { message: answer.stop } : {}) };
    }
    return null;
  }

  /** Words posted: a `post` step's with each `{field}` filled in, or the app's as they are. */
  async function post(message: string, kind: 'note' | 'message', filled: boolean): Promise<Stopped | null> {
    const parts = filled ? splitValues(message) : [{ text: message }];
    // A field empty says its words while empty, where the page gives some ({field|words}).
    const said = (part: { text: string; field?: string; fallback?: string }) => (part.field ? form.wordsOf(part.field) || (part.fallback ?? '') : part.text);
    const text = parts.map(said).join('');
    // An html field's value comes as HTML; the rest are escaped, a line each.
    const body = parts.map((part) => (part.field && form.fields[part.field]?.type === 'html' && form.values()[part.field] ? String(form.values()[part.field]) : escapeHtml(said(part)))).join('');
    const posted = await form.post({ kind, text, body: `<p>${body}</p>` });
    return posted ? null : cannot('Nothing can post a message here: no conversation is beside this record');
  }

  /** A record step the data source cannot do: the app's action of its name, answered as a call is. */
  async function instead(name: 'archive' | 'unarchive' | 'duplicate' | 'delete', method: string, scope: RunScope): Promise<Stopped | null> {
    if (!form.onAction) return cannot(`Nothing can ${name} this record here: the data source has no ${method}, and the app takes no actions`);
    return call({ action: name }, scope);
  }

  /** Archive the record or bring it back, copy it, or delete it: through the data source when it can, else the app. */
  async function recordStep(name: 'archive' | 'unarchive' | 'duplicate' | 'delete', scope: RunScope): Promise<Stopped | null> {
    const id = form.recordId();
    if (id == null) return cannot(`A new record cannot be ${name === 'duplicate' ? 'duplicated' : name === 'delete' ? 'deleted' : `${name}d`}: it is not saved yet`);
    // Not when the record's source says this person may not: neither it nor the app is asked.
    const barred = form.barred?.(name === 'unarchive' ? 'archive' : name);
    if (barred) return cannot(barred);
    if (name === 'archive' || name === 'unarchive') {
      if (!form.archive) return instead(name, 'archive', scope);
      // Loaded again once archived: the person's work is asked about before anything is.
      const kept = await form.letGo(scope.chain);
      if (kept) return kept;
      await form.archive(name === 'archive');
      if (scope.taken) scope.taken.archived = scope.taken.archived === undefined ? name === 'archive' : undefined;
      form.told({ archived: name === 'archive' }, id);
      // Archived once another record is shown: that one is not loaded again over what is typed in it.
      if (replaced(scope)) return form.gone();
      return ownMove(scope, () => form.reload(scope.chain));
    }
    if (name === 'duplicate') {
      // What was changed goes with the copy: it is saved first. What that save could not take — changes Reload set
      // aside, a change made while it ran — goes only when the person says so, before any copy is made; and a change
      // made while the copy is made, before the copy shows.
      // A record the person may not change has nothing to save: what is changed in it is asked about instead.
      if (form.changed() && !form.barred?.('edit')) {
        const saved = await form.save(scope.chain);
        if (saved) return saved;
        scope.wrote?.clear();
      }
      const kept = await form.letGo(scope.chain);
      if (kept) return kept;
      if (!form.copy) {
        const stopped = await instead(name, 'copy', scope);
        const now = form.recordId();
        if (!stopped && now != null && now !== id) form.told({ copied: now }, id);
        return stopped;
      }
      const copied = await form.copy();
      // Copied once another record is shown: the copy is made, and told; the form stays on the one shown, with what is typed in it.
      if (replaced(scope)) {
        form.told({ copied }, id);
        return form.gone();
      }
      const moved = await ownMove(scope, () => form.showRecord(copied, scope.chain));
      if (moved) return moved;
      form.told({ copied }, id);
      return null;
    }
    // Deleted: what the person had not saved in it goes with it, unasked — they chose to delete it. Refused, it stays.
    if (!form.remove) {
      const stopped = await form.deleting(() => instead(name, 'delete', scope), (out) => !out);
      return stopped ?? told(scope, { deleted: true }, id);
    }
    const remove = form.remove;
    await form.deleting(() => remove(), () => true);
    return told(scope, { deleted: true }, id);
  }

  /**
   * The record deleted, told: a pager showing it moves on at once, and that move is this run's own. Deleted once
   * another record is shown, the run stops there: that one is not left, nor its steps run on it.
   */
  function told(scope: RunScope, event: { deleted: true }, id: RecordId): Stopped | null {
    const late = replaced(scope);
    form.told(event, id);
    if (late) return form.gone();
    scope.generation = form.generation();
    return null;
  }

  /** A step of this run showing another record (or this one loaded again): the run goes on, on that one. */
  async function ownMove(scope: RunScope, move: () => Promise<Stopped | null>): Promise<Stopped | null> {
    const stopped = await move();
    scope.generation = form.generation();
    // The record as it is now, loaded or another: what was written before is no longer the run's to put back.
    scope.wrote?.clear();
    return stopped;
  }

  async function runStep(step: ActionStep, scope: RunScope): Promise<Stopped | null> {
    switch (step.do) {
      case 'set': {
        const def = fieldOf(step.field);
        const value = fit(def, read(step.value, !EXPRESSIBLE.has(def.type)));
        writeIn(scope, [step.field], () => form.write({ [step.field]: value }, scope.chain));
        return null;
      }
      case 'clear': {
        const value = emptyValue(fieldOf(step.field));
        writeIn(scope, [step.field], () => form.write({ [step.field]: value }, scope.chain));
        return null;
      }
      case 'addLine': {
        const def = fieldOf(step.field);
        if (def.type !== 'one2many') return cannot(`"${step.field}" is a ${def.type}; a line is added to a one2many`);
        const values: Values = {};
        for (const [name, source] of Object.entries(step.values ?? {})) {
          const sub = def.fields[name];
          if (!sub) return cannot(`The lines of "${step.field}" have no field "${name}"`);
          values[name] = fit(sub, read(source, !EXPRESSIBLE.has(sub.type)));
        }
        writeIn(scope, [step.field], () => form.addLine(step.field, values));
        return null;
      }
      case 'check':
        return form.check(step.fields);
      case 'save': {
        const stopped = await form.save(scope.chain, scope.yes);
        // Saved: what the steps wrote is the record's now.
        if (!stopped) scope.wrote?.clear();
        return stopped;
      }
      case 'reset':
        return form.reset(scope.chain);
      case 'goTo': {
        const stepped = await form.goTo(step.target, scope.chain);
        if (stepped !== undefined) return stepped;
        const show = form.host?.show;
        if (!show) return cannot(`Nothing can show "${step.target}" here: the form has no host that shows tabs`);
        form.showing(scope.chain, () => show.call(form.host, step.target));
        return null;
      }
      // The page's own words, as a person reads them: an escaped brace a brace.
      case 'say':
        tell(scope, plainWords(step.message), step.tone ?? 'info');
        return null;
      case 'ask':
        // Yes goes on with what was pressed: its words.
        return (await ask(plainWords(step.message), scope.yes)) ? null : { reason: 'no', message: plainWords(step.message) };
      case 'call':
        return call(step, scope);
      case 'open':
        return open(step, scope);
      case 'close':
        if (!form.host?.close) return cannot('Nothing can close this form: it has no host, or was not opened in a dialog or panel');
        return form.close(scope.chain);
      case 'reload':
        return ownMove(scope, () => form.reload(scope.chain));
      case 'openUrl': {
        const openUrl = form.host?.openUrl;
        if (!openUrl) return cannot('Nothing can open a web address here: the form has no host that opens one');
        const url = read(step.url, false);
        if (typeof url !== 'string' || !url.trim()) return cannot(`"${step.url}" gives no address to open`);
        // A web, mail or phone address, or a path of this site — never a script, whoever wrote it: the page or a value.
        const address = safeUrl(url, LINK_URL);
        if (!address) return cannot(form.messages.addressRefused);
        // In this tab, the page goes: the person's work is asked about first.
        if (step.newTab === false) {
          const kept = await form.letGo(scope.chain);
          if (kept) return kept;
        }
        openUrl.call(form.host, address, step.newTab ?? true);
        return null;
      }
      case 'archive':
      case 'unarchive':
      case 'duplicate':
      case 'delete':
        return recordStep(step.do, scope);
      case 'post':
        return post(step.message, step.kind ?? 'note', true);
      case 'print': {
        const host = form.host;
        if (!host?.print) return cannot('Nothing can print here: the form has no host that prints');
        await host.print();
        return null;
      }
    }
  }

  /**
   * A run the person or the app set off reads what is typed before its first step that reads the form or hands its
   * values on: THE one place a run of steps meets the input rules, whatever its steps are. The line its button was
   * pressed on is taken again then, as what was typed in it reads.
   */
  async function typedFirst(scope: RunScope): Promise<Stopped | null> {
    scope.typed = 'read';
    const stopped = await form.typedFirst();
    if (stopped) return stopped;
    const linesOf = (field: string) => (form.values()[field] as Line[] | null | undefined) ?? [];
    if (scope.line) {
      const { field, key } = scope.line;
      const now = linesOf(field).find((line) => line.key === key);
      if (now) scope.line = { field, key, values: structuredCopy(now.values) };
    }
    if (scope.lines) {
      const { field, keys } = scope.lines;
      const now = keys.map((key) => linesOf(field).find((line) => line.key === key));
      if (now.every(Boolean)) scope.lines = { ...scope.lines, values: now.map((line) => structuredCopy((line as Line).values)) };
    }
    return null;
  }

  /** Run steps; a run's own (not an open step's `then`, which its open step answers for) puts back what it wrote when its save is refused. */
  async function runSteps(steps: readonly ActionStep[], scope: RunScope, inner = false): Promise<RunResult> {
    scope.generation ??= form.generation();
    for (let at = 0; at < steps.length; at++) {
      const step = steps[at];
      let stopped: Stopped | null;
      try {
        // The record it ran on was replaced by something else meanwhile: the rest is not for the one shown now.
        if (form.generation() !== scope.generation) stopped = form.gone();
        // Asked only where it reads: a run with nothing to read goes on in the same tick, as ever.
        else if (scope.typed === 'first' && readsForm(step) && (stopped = await typedFirst(scope))) {
          // What is typed does not read: nothing is done with the values under it.
        } else if (step.when !== undefined && !holds(step.when)) continue;
        else stopped = await runStep(step, scope);
      } catch (error) {
        stopped = { reason: 'cannot', message: wordsOf(error), error };
      }
      if (stopped) {
        if (!inner && (stopped.reason === 'save' || stopped.reason === 'check') && savesIn(steps)) putBack(scope);
        return {
          done: false,
          stoppedAt: at,
          step: stopped.step ?? step,
          reason: stopped.reason,
          ...(stopped.message !== undefined ? { message: stopped.message } : {}),
          ...(stopped.error !== undefined ? { error: stopped.error } : {}),
        };
      }
    }
    return DONE;
  }

  /** What a press's Undo takes back with, in the undo part (press-undo.ts): the runner's own ways, on this form. */
  const kit: UndoKit = { form, answered, recordStep, replaced, tell, runSteps };
  return { runSteps, ask, kit };
}

/**
 * Whether a step reads the form's values or hands them on — what is typed is read before it, for a run the person or
 * the app set off: a `when`; `set` and `addLine`, which work values out; a `call`, handing them to the app; an `open`
 * with values, a record or a filter from them; `post`, `openUrl`; `print`, which prints them as words. A save, a check and a step forward read on their own;
 * the ways out (`reload`, `close`, `reset`, another record) ask about what is typed instead; `archive`, `duplicate`
 * and `delete` act on the record as stored.
 */
function readsForm(step: ActionStep): boolean {
  if (step.when !== undefined) return true;
  switch (step.do) {
    case 'set':
    case 'addLine':
    case 'call':
    case 'post':
    case 'openUrl':
    case 'print':
      return true;
    case 'open':
      return step.values !== undefined || step.record !== undefined || step.filter !== undefined;
    default:
      return false;
  }
}

/** Whether steps save, themselves or in an opened page's `then`. */
function savesIn(steps: readonly ActionStep[]): boolean {
  return steps.some((step) => step.do === 'save' || (step.do === 'open' && !!step.then && savesIn(step.then)));
}

/** What an expression reads in another form's answers, its fields unknown: a link as its id, links as their ids, a reference as "model,id", lines by their keys, a file by its name. */
function asRead(values: Values): Record<string, unknown> {
  const read: Record<string, unknown> = {};
  const one = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if ('key' in object && 'values' in object) return object['key'];
    if ('model' in object && 'id' in object) return `${object['model']},${object['id']}`;
    if ('id' in object) return object['id'];
    if ('name' in object && 'type' in object && 'size' in object) return object['name'];
    return value;
  };
  for (const [name, value] of Object.entries(values)) read[name] = Array.isArray(value) ? value.map(one) : one(value);
  return read;
}

/** Words as HTML: every character that means something there escaped, each line break a <br>. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string).replace(/\n/g, '<br>');
}
