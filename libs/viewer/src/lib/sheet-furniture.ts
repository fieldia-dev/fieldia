import { plainWords, type ButtonNode, type DataSource, type FieldNode, type Form, type FormState, type JsonValue, type LineField, type Locale, type Page, type RunResult, type SheetNode, type Values } from '@fieldia/core';
import { displayValue, drawIcon, type IconSet, type Widget } from '@fieldia/widgets';
import { attachmentPreview } from './attachment-preview';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installSheetStyles } from './sheet-styles';
import { valueWords, type ValueWriter } from './value-words';

/** What a sheet's furniture is drawn with: the viewer's own (viewer.ts), as a record's head is (record-head.ts). */
export interface SheetKit {
  doc: Document;
  el: El;
  form: Form;
  page: Page;
  labels: ViewerLabels;
  locale: Locale;
  icons?: IconSet;
  dataSource: DataSource | undefined;
  uid(id: string): string;
  fill(template: string, values: Record<string, string | number>): string;
  withIcon(name: string | undefined, text: string | (Node | string)[]): (Node | string)[];
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  buttonItem(node: ButtonNode): HTMLElement;
  hideWhen(element: HTMLElement, id: string): void;
  hiddenAfterPress(element: HTMLElement, hidden: () => boolean): void;
  /** What draws again as the form's state changes. */
  watch(update: (state: FormState) => void): void;
  cleanups: (() => void)[];
  /** How a field's value reads inside the page's own words: the answers part's, where it came. */
  asSaid(): ValueWriter | undefined;
  /** A field's widget, made as the viewer makes the page's own (its words, its dialogs, its errors kept to it). */
  widget(node: FieldNode, id: string): Widget;
  /** Whether the record is only to be read now (the viewer's `setReadonly`). */
  locked(): boolean;
  /** Said over the page: a part of it could not load (the files part, for the attachment's files). */
  unloaded(): void;
}

/** A sheet's furniture, by where it goes: drawn by the sheet part, in place — at once where it came, else as it comes. */
export interface Furniture {
  /** In the header bar, after its buttons: the statusbar, unless it is under the title. */
  header: HTMLElement[];
  /** At the card's top: its ribbons, then its stat buttons. */
  top: HTMLElement[];
  alerts: HTMLElement[];
  badges: HTMLElement[];
  /** Under the title: the statusbar placed there. */
  underTitle: HTMLElement[];
  /** Beside the sheet: its attachment. */
  beside: HTMLElement[];
}

/**
 * A record sheet's furniture, as Flectra draws it (the sheet part's: viewer-parts.ts, `sheetPart`): the ribbons in its
 * corner, its stat buttons, its alerts, its badges, its statusbar, its attachment beside it. The sheet itself — its
 * header, Save and Discard, its card, its title, its parts — is the viewer's own, drawn without it: a sheet page that
 * waits for no other part is drawn at once, its furniture put in its place as it comes.
 */
export function sheetFurniture(kit: SheetKit, node: SheetNode): Furniture {
  const { el, form, page, locale } = kit;
  installSheetStyles(kit.doc);
  const underTitle = node.statusbar?.position === 'title';
  const furniture: Furniture = { header: [], top: [], alerts: sheetAlerts(kit, node), badges: [], underTitle: [], beside: [] };
  if (node.statusbar) (underTitle ? furniture.underTitle : furniture.header).push(underTitle ? el('div', { class: 'fd-title-statusbar' }, statusbar(kit, node.statusbar)) : statusbar(kit, node.statusbar));
  const ribbons = [...(node.ribbon ? [node.ribbon] : []), ...(node.ribbons ?? [])];
  if (ribbons.length) {
    // The ribbons are clipped to the card's corner by their own frame, so the card itself never clips: lists open past it.
    const frame = el('div', { class: 'fd-ribbon-frame' });
    const drawn = ribbons.map((ribbon) => {
      const element = el('div', { class: `fd-ribbon fd-tone-${ribbon.tone ?? 'muted'}`, 'data-node': ribbon.id, title: plainWords(ribbon.tooltip) }, plainWords(ribbon.label));
      frame.append(element);
      return { ribbon, element };
    });
    // One corner, one ribbon: the first whose condition holds; its words from a field when the field holds any.
    kit.watch((state) => {
      let shown = false;
      for (const { ribbon, element } of drawn) {
        const show: boolean = !shown && !form.node(ribbon.id).invisible;
        shown ||= show;
        setHidden(element, !show);
        if (!show) continue;
        const from = ribbon.labelField ? displayValue(page.fields[ribbon.labelField] as LineField, state.values[ribbon.labelField], state.values, locale) : '';
        setText(element, from || plainWords(ribbon.label));
      }
    });
    furniture.top.push(frame);
  }
  if (node.statButtons?.length) {
    const stats = el('div', { class: 'fd-stats' });
    /** A field's value as the field shows it: money with its currency, a date, a count grouped. */
    const shownValue = (name: string | undefined, values: Values) => (name && page.fields[name] ? displayValue(page.fields[name] as LineField, values[name], values, locale) : '');
    for (const stat of node.statButtons) {
      const value = el('span', { class: 'fd-stat-value' });
      const label = el('span', { class: 'fd-stat-label' }, plainWords(stat.label));
      // A second value with words of its own: the two one over the other, each after its words.
      const second = stat.secondField && stat.secondLabel !== undefined ? { value: el('span', { class: 'fd-stat-value' }), label: el('span', { class: 'fd-stat-label' }, plainWords(stat.secondLabel)) } : null;
      const icon = drawIcon(kit.doc, stat.icon, kit.icons);
      const words = second
        ? el('span', { class: 'fd-stat-words fd-stat-pair' }, el('span', { class: 'fd-stat-row' }, label, value), el('span', { class: 'fd-stat-row' }, second.label, second.value))
        : el('span', { class: 'fd-stat-words' }, value, label);
      // Its help, as Flectra's help=: its tooltip, and its description for a screen reader — never its name.
      const helpId = stat.help ? kit.uid(`${stat.id}-help`) : undefined;
      const button = el('button', { type: 'button', class: 'fd-stat', 'data-node': stat.id, title: plainWords(stat.help) || undefined, 'aria-describedby': helpId }, ...(icon ? [icon, words] : [words]));
      if (helpId) stats.append(el('span', { class: 'fd-sr-only', id: helpId }, plainWords(stat.help as string)));
      button.addEventListener('click', () => void kit.press(button, () => form.runAction(stat.id)));
      kit.watch((state) => {
        setHidden(button, form.node(stat.id).invisible);
        const values = state.values as Values;
        const unit = shownValue(stat.unitField, values) || plainWords(stat.unit) || '';
        const first = shownValue(stat.field, values);
        const other = shownValue(stat.secondField, values);
        if (second) {
          setText(value, first);
          setText(second.value, [other, unit].filter(Boolean).join(' '));
        } else setText(value, [[first, other].filter(Boolean).join(' / '), first || other ? unit : ''].filter(Boolean).join(' '));
        setText(label, shownValue(stat.labelField, values) || plainWords(stat.label));
      });
      stats.append(button);
    }
    // No empty row while every button is hidden, as with the badges.
    kit.watch(() => {
      setHidden(stats, [...stats.querySelectorAll<HTMLElement>(':scope > .fd-stat')].every((stat) => stat.hidden));
    });
    furniture.top.push(stats);
  }
  if (node.badges?.length) {
    const badges = el('div', { class: 'fd-badges' });
    for (const badge of node.badges) {
      const chip = el('span', { class: `fd-badge fd-tone-${badge.tone ?? 'muted'}`, 'data-node': badge.id }, ...kit.withIcon(badge.icon, plainWords(badge.label)));
      kit.hideWhen(chip, badge.id);
      badges.append(chip);
    }
    // Their row with them: shown or hidden as their conditions say, when they are (shownAsItsCondition).
    const all = node.badges;
    kit.watch(() => kit.hiddenAfterPress(badges, () => all.every((badge) => form.node(badge.id).invisible)));
    furniture.badges.push(badges);
  }
  if (node.attachmentPreview) {
    // Beside the sheet on a wide form, the side panel then under the sheet; under the sheet on a narrow one.
    const preview = attachmentPreview({ doc: kit.doc, el, form, page, node: node.attachmentPreview, dataSource: kit.dataSource, labels: kit.labels, fill: kit.fill, unloaded: kit.unloaded });
    kit.watch(preview.update);
    kit.cleanups.push(preview.destroy);
    furniture.beside.push(preview.element);
  }
  return furniture;
}

/** The sheet's alerts: its words with the values they name, or a field's words while it holds any; its buttons after them, as links unless styled. */
export function sheetAlerts(kit: SheetKit, node: SheetNode): HTMLElement[] {
  const { el, form, page, labels } = kit;
  if (node.alerts?.length) installSheetStyles(kit.doc);
  return (node.alerts ?? []).map((alert) => {
    const words = valueWords(kit.doc, page.fields, alert.message, kit.locale, kit.asSaid());
    const message = el('span', { class: 'fd-alert-message' }, ...words.nodes);
    let fromField = false;
    const box = el('div', { class: `fd-alert fd-tone-${alert.tone ?? 'info'}`, role: 'status', 'data-node': alert.id }, message);
    if (alert.buttons?.length) box.append(el('span', { class: 'fd-alert-actions' }, ...alert.buttons.map((button) => kit.buttonItem({ ...button, style: button.style ?? 'link' }))));
    kit.watch((state) => {
      words.update(state.values);
      const from = alert.messageField ? state.values[alert.messageField] : null;
      const said = typeof from === 'string' ? from.trim() : '';
      if (said) setText(message, said);
      else if (fromField) message.replaceChildren(...words.nodes);
      fromField = !!said;
    });
    if (alert.dismissible) {
      // Closed, it stays closed while the page is open, whatever its condition does.
      let dismissed = false;
      const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': labels.dismiss }, '×');
      close.addEventListener('click', () => {
        dismissed = true;
        box.hidden = true;
      });
      box.append(close);
      kit.watch(() => {
        setHidden(box, dismissed || form.node(alert.id).invisible);
      });
    } else kit.hideWhen(box, alert.id);
    return box;
  });
}

/** The sheet header's statusbar: the same widget a form can place anywhere. */
function statusbar(kit: SheetKit, config: NonNullable<SheetNode['statusbar']>): HTMLElement {
  const { form } = kit;
  const barOptions: { [key: string]: JsonValue } = { clickable: config.clickable === true };
  if (config.visibleStates) barOptions['visibleStates'] = config.visibleStates;
  for (const key of ['durationsField', 'fold', 'saves'] as const) if (config[key] !== undefined) barOptions[key] = config[key];
  const node: FieldNode = { type: 'field', id: '#statusbar', field: config.field, widget: 'statusbar', options: barOptions };
  const widget = kit.widget(node, kit.uid('statusbar'));
  if (widget.destroy) kit.cleanups.push(() => widget.destroy?.());
  kit.watch((state) => {
    // Hidden while its own condition holds, or from people outside its roles.
    setHidden(widget.element, form.node('#statusbar').invisible);
    widget.update({ value: state.values[config.field], values: state.values, readonly: form.node('#statusbar').readonly || kit.locked(), required: false, invalid: false });
  });
  return widget.element;
}
