import { comparable, type BotCheck, type FieldNode, type LayoutNode, type Page, type SheetNode } from '@fieldia/core';
import { countriesIn } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { allSections } from './page-tree';
import { setting } from './panel-controls';
import { pageLookSettings } from './panel-look';
import type { PropertiesView } from './screen-properties';
import { formMoments } from './steps-panel';
import { headSettings } from './head-properties';
import { settingNumber } from './number-box';
import { zoneBox } from './zone-setting';
import { recordsSettings } from './records-settings';

/**
 * Nothing picked: the screen itself — its description and a sheet's title
 * (Content), whether it is sections or a record sheet and, for a sheet, what
 * sits around it — the pager and breadcrumbs the app gives, the attachment
 * and the side panel beside it (Layout) — its look (Look), and what it does
 * at its moments (Rules).
 */
export function pageProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const w = designer.words.panel;
  const description = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.description, rows: '2', placeholder: w.wordsUnderTitle });
  description.addEventListener('input', () => designer.setPageInfo({ description: description.value }));
  const layout = el('select', { class: 'fd-input fd-select', 'aria-label': w.layout }, el('option', { value: 'sections' }, w.sections), el('option', { value: 'sheet' }, w.recordSheet));
  layout.addEventListener('change', () => designer.setLayoutKind(layout.value as 'sections' | 'sheet'));
  const title = el('select', { class: 'fd-input fd-select', 'aria-label': w.titleField });
  title.addEventListener('change', () => designer.setTitleField(title.value === '' ? null : title.value === CURRENT_TITLE ? ((designer.getPage().layout as SheetNode).title?.field ?? null) : title.value));
  const titleRow = setting(el, 'content', 'Title field', title, { hint: w.titleFieldHint, words: w.titleField });
  const titleLabel = el('input', { class: 'fd-input', 'aria-label': w.titleLabel, placeholder: w.optional }) as HTMLInputElement;
  titleLabel.addEventListener('input', () => designer.setTitleLabel(titleLabel.value));
  const titleLabelRow = setting(el, 'content', 'Words over the title', titleLabel, { hint: w.titleLabelHint, words: w.titleLabel });
  // Around a record: the pager and the trail the app gives, shown unless the page says no; the attachment and the side panel beside it.
  const check = (label: string) => el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': label }) as HTMLInputElement;
  const pager = check(w.pagerShown);
  pager.addEventListener('change', () => designer.setRecordToolbar({ pager: pager.checked }));
  const crumbs = check(w.breadcrumbsShown);
  crumbs.addEventListener('change', () => designer.setRecordToolbar({ breadcrumbs: crumbs.checked }));
  const pagerRow = setting(el, 'layout', 'Pager over the record', pager, { words: w.pagerShown });
  const crumbsRow = setting(el, 'layout', 'Breadcrumbs over the record', crumbs, { hint: w.aroundHint, words: w.breadcrumbsShown });
  const preview = el('select', { class: 'fd-input fd-select', 'aria-label': w.attachmentBeside }) as HTMLSelectElement;
  preview.addEventListener('change', () => designer.setAttachmentPreview(preview.value === NONE ? null : preview.value));
  const previewRow = setting(el, 'layout', 'Attachment beside the sheet', preview, { hint: w.attachmentHint, words: w.attachmentBeside });
  const beside = el('select', { class: 'fd-input fd-select', 'aria-label': w.sideBeside }, el('option', { value: 'wide' }, w.sideBesides.wide), el('option', { value: 'always' }, w.sideBesides.always)) as HTMLSelectElement;
  beside.addEventListener('change', () => designer.setSidePanelBeside(beside.value as 'wide' | 'always'));
  const besideRow = setting(el, 'layout', 'Side panel beside the sheet', beside, { words: w.sideBeside });
  // A public page's bot check: a box only bots fill, the fewest seconds a person takes, the app's captcha in a slot.
  const checked = (): BotCheck => designer.getPage().botCheck ?? {};
  const bot = check(w.botCheckOn);
  bot.addEventListener('change', () => designer.setBotCheck(bot.checked ? {} : null));
  const botRow = setting(el, 'rules', 'Bot check', bot, { hint: w.botCheckHint, words: w.botCheck });
  const trap = check(w.honeypot);
  trap.addEventListener('change', () => {
    const { honeypot: _, ...rest } = checked();
    designer.setBotCheck(trap.checked ? rest : { ...rest, honeypot: false });
  });
  const trapRow = setting(el, 'rules', 'Hidden box for bots', trap, { words: w.honeypot });
  const seconds = settingNumber(el, designer, {
    label: w.minSeconds,
    attrs: { class: 'fd-input', 'aria-label': w.minSeconds },
    min: 0,
    max: 3600,
    saved: () => checked().minSeconds ?? 3,
    commit: (n) => {
      const { minSeconds: _, ...rest } = checked();
      return designer.setBotCheck(n === null || n === 3 ? rest : { ...rest, minSeconds: n });
    },
  });
  const secondsRow = setting(el, 'rules', 'Fewest seconds to fill', seconds.input, { hint: w.minSecondsHint, words: w.minSeconds });
  const captcha = el('select', { class: 'fd-input fd-select', 'aria-label': w.captchaIn }) as HTMLSelectElement;
  captcha.addEventListener('change', () => {
    const { captcha: _, ...rest } = checked();
    designer.setBotCheck(captcha.value ? { ...rest, captcha: captcha.value } : rest);
  });
  const captchaRow = setting(el, 'rules', 'Captcha drawn in', captcha, { hint: w.captchaHint, words: w.captchaIn });
  // A record page's possible duplicates: the fields records like the one typed are found by, and when they are asked for.
  const sameBy = el('div', { class: 'fd-q-required-row', role: 'group', 'aria-label': w.duplicates });
  const noneBy = el('p', { class: 'fd-properties-hint', hidden: '' }, w.duplicatesNone);
  const sameRow = setting(el, 'rules', 'Possible duplicates', [sameBy, noneBy], { hint: w.duplicatesHint, words: w.duplicates });
  const sameOn = el('select', { class: 'fd-input fd-select', 'aria-label': w.duplicatesOn }, el('option', { value: 'type' }, w.duplicatesOnAs.type), el('option', { value: 'save' }, w.duplicatesOnAs.save)) as HTMLSelectElement;
  sameOn.addEventListener('change', () => designer.setDuplicates({ on: sameOn.value === 'save' ? 'save' : null }));
  const sameOnRow = setting(el, 'rules', 'Duplicates asked for', sameOn, { words: w.duplicatesOn });
  // What its records are called in Fieldia's own sentences (records-settings.ts).
  const records = recordsSettings(el, designer);
  // Its phone numbers: as typed, or checked by their country — the country they start on, and how they are shown.
  const phones = el('select', { class: 'fd-input fd-select', 'aria-label': w.phones }, el('option', { value: '' }, w.phonesAs.typed), el('option', { value: 'checked' }, w.phonesAs.checked)) as HTMLSelectElement;
  phones.addEventListener('change', () => designer.setPhone({ on: phones.value === 'checked' }));
  const phonesRow = setting(el, 'content', 'Phone numbers', phones, { hint: w.phonesHint, words: w.phones });
  const phoneCountry = el('select', { class: 'fd-input fd-select', 'aria-label': w.phoneCountry }, el('option', { value: '' }, w.noPhoneCountry)) as HTMLSelectElement;
  phoneCountry.addEventListener('change', () => designer.setPhone({ country: phoneCountry.value || null }));
  const phoneCountryRow = setting(el, 'content', 'Phone country to start on', phoneCountry, { words: w.phoneCountry });
  const phoneShown = el('select', { class: 'fd-input fd-select', 'aria-label': w.phoneShown }, el('option', { value: 'international' }, w.phoneShownAs.international), el('option', { value: 'national' }, w.phoneShownAs.national)) as HTMLSelectElement;
  phoneShown.addEventListener('change', () => designer.setPhone({ shown: phoneShown.value === 'national' ? 'national' : null }));
  const phoneShownRow = setting(el, 'content', 'Phone numbers shown', phoneShown, { words: w.phoneShown });
  // The zone every date and time on the page is on the clock of: empty, the browser's own.
  const zone = zoneBox(el, w.pageTimeZone, w.browserZone);
  zone.addEventListener('change', () => designer.setTimeZone(null, zone.value.trim() || null));
  const zoneRow = setting(el, 'content', 'Time zone', zone, { hint: w.pageTimeZoneHint, words: w.pageTimeZone });
  // On paper: the words over and under every printout of the page, and the app's logo over it.
  const printHeader = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.printHeader, rows: '2', placeholder: w.optional });
  printHeader.addEventListener('input', () => designer.setPrint({ header: printHeader.value }));
  const printFooter = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.printFooter, rows: '2', placeholder: w.optional });
  printFooter.addEventListener('input', () => designer.setPrint({ footer: printFooter.value }));
  const printLogo = el('input', { class: 'fd-input', 'aria-label': w.printLogo, placeholder: 'https://…/logo.svg' }) as HTMLInputElement;
  printLogo.addEventListener('change', () => designer.setPrint({ logo: printLogo.value }));
  const printRows = [
    setting(el, 'content', 'Printout’s header', printHeader, { hint: w.printHeaderHint, words: w.printHeader }),
    setting(el, 'content', 'Printout’s footer', printFooter, { hint: w.printFooterHint, words: w.printFooter }),
    setting(el, 'content', 'Logo’s address', printLogo, { hint: w.printLogoHint, words: w.printLogo }),
  ];
  const look = pageLookSettings(el, designer);
  // steps lane: what the form does at its moments — opened, saved or sent, a tab or step shown.
  const moments = formMoments(el, designer);
  // A record's head, as a work item's: its kind, row, buttons, band and "Updated by" (head-properties.ts).
  const head = headSettings(el, designer);
  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Description', description, { words: w.description }),
    zoneRow,
    ...records.rows,
    titleRow,
    titleLabelRow,
    phonesRow,
    phoneCountryRow,
    phoneShownRow,
    ...printRows,
    el('p', { class: 'fd-properties-hint' }, w.nothingPicked),
    setting(el, 'layout', 'Layout', layout, { hint: w.layoutHint, words: w.layout }),
    pagerRow,
    crumbsRow,
    previewRow,
    besideRow,
    ...head.rows,
    ...look.rows,
    botRow,
    trapRow,
    secondsRow,
    captchaRow,
    sameRow,
    sameOnRow,
    moments.element
  );
  return {
    element,
    destroy: () => seconds.destroy(),
    update(page) {
      if (!focused(description)) description.value = page.description ?? '';
      phones.value = page.phone ? 'checked' : '';
      phoneCountryRow.hidden = phoneShownRow.hidden = !page.phone;
      // The countries, by their names in the designer's language, listed once the setting is first shown.
      if (page.phone && phoneCountry.options.length === 1) phoneCountry.append(...countriesIn(designer.locale ?? 'en').map(([code, name]) => el('option', { value: code }, name)));
      phoneCountry.value = page.phone?.country ?? '';
      phoneShown.value = page.phone?.shown ?? 'international';
      if (!focused(zone)) zone.value = page.timeZone ?? '';
      if (!focused(printHeader)) printHeader.value = page.print?.header ?? '';
      if (!focused(printFooter)) printFooter.value = page.print?.footer ?? '';
      if (!focused(printLogo)) printLogo.value = page.print?.logo ?? '';
      records.update(page);
      look.update(page);
      moments.update(page);
      head.update(page);
      // Only a page of responses, open to anyone, checks for bots; its parts once it does.
      const own = page.botCheck;
      botRow.hidden = page.data.kind !== 'responses';
      bot.checked = !!own;
      trapRow.hidden = secondsRow.hidden = captchaRow.hidden = botRow.hidden || !own;
      trap.checked = own?.honeypot !== false;
      seconds.refresh();
      const slots = [...new Set(slotsOf(page.layout).filter((name) => name))];
      const places = [['', w.noCaptcha], ...slots.map((name) => [name, name]), ...(own?.captcha && !slots.includes(own.captcha) ? [[own.captcha, own.captcha]] : [])];
      const placesKey = JSON.stringify(places);
      if (captcha.dataset['choices'] !== placesKey) {
        captcha.dataset['choices'] = placesKey;
        captcha.replaceChildren(...places.map(([value, words]) => el('option', { value }, words)));
      }
      captcha.value = own?.captcha ?? '';
      // Possible duplicates, on a record's own page: a tick for each field records can be compared by, in the page's order.
      sameRow.hidden = page.data.kind !== 'record' || page.layout.type === 'list';
      const by = Object.entries(page.fields).filter(([, def]) => comparable(def));
      const byKey = JSON.stringify(by.map(([name, def]) => [name, def.label]));
      if (sameBy.dataset['choices'] !== byKey) {
        sameBy.dataset['choices'] = byKey;
        sameBy.replaceChildren(
          ...by.map(([name, def]) => {
            const tick = el('input', { type: 'checkbox', 'data-field': name }) as HTMLInputElement;
            tick.addEventListener('change', () => {
              const ticked = new Set([...sameBy.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.dataset['field'] as string));
              designer.setDuplicates({ fields: Object.keys(designer.getPage().fields).filter((field) => ticked.has(field)) });
            });
            return el('label', { class: 'fd-q-required' }, tick, el('span', {}, def.label));
          })
        );
      }
      for (const tick of sameBy.querySelectorAll<HTMLInputElement>('input')) tick.checked = !!page.duplicates?.fields.includes(tick.dataset['field'] as string);
      noneBy.hidden = by.length > 0;
      sameOnRow.hidden = sameRow.hidden || !page.duplicates;
      sameOn.value = page.duplicates?.on ?? 'type';
      const root = page.layout;
      layout.value = root.type === 'sheet' ? 'sheet' : 'sections';
      titleRow.hidden = root.type !== 'sheet';
      titleLabelRow.hidden = root.type !== 'sheet' || !root.title;
      pagerRow.hidden = crumbsRow.hidden = previewRow.hidden = root.type !== 'sheet';
      besideRow.hidden = root.type !== 'sheet' || !root.sidePanel;
      if (root.type !== 'sheet') return;
      pager.checked = root.toolbar?.pager !== false;
      crumbs.checked = root.toolbar?.breadcrumbs !== false;
      // The record's attachments from the app, or a file field's file.
      const files = [...Object.entries(page.fields), ...designer.modelFields().map((m) => [m.name, m.field] as const)].filter(([, f]) => f.type === 'binary' || f.type === 'image');
      const choices = [[NONE, w.attachmentNone], ['', w.attachmentFromApp], ...files.map(([name, f]) => [name, f.label] as const)];
      const key = JSON.stringify(choices);
      if (preview.dataset['choices'] !== key) {
        preview.dataset['choices'] = key;
        preview.replaceChildren(...choices.map(([value, words]) => el('option', { value }, words)));
      }
      preview.value = root.attachmentPreview ? (root.attachmentPreview.field ?? '') : NONE;
      beside.value = root.sidePanelBeside ?? 'wide';
      if (!focused(titleLabel)) titleLabel.value = root.title?.label ?? '';
      // The text fields that could be the title, and the one that is.
      const texts = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && page.fields[n.field]?.type === 'char'));
      title.replaceChildren(
        el('option', { value: '' }, w.noTitle),
        ...(root.title ? [el('option', { value: CURRENT_TITLE }, page.fields[root.title.field]?.label ?? root.title.field)] : []),
        ...texts.map((n) => el('option', { value: n.id }, n.label ?? page.fields[n.field].label))
      );
      title.value = root.title ? CURRENT_TITLE : '';
    },
  };
}

/** The names of the slots a page's layout places, where an app's own part — a captcha — is drawn. */
function slotsOf(root: Page['layout']): string[] {
  const out: string[] = [];
  const walk = (nodes: readonly LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'slot') out.push(node.name);
      const inner = (node as { children?: LayoutNode[] }).children;
      if (Array.isArray(inner)) walk(inner);
    }
  };
  if ('children' in root && Array.isArray(root.children)) walk(root.children as LayoutNode[]);
  return out;
}

/** No attachment beside the sheet, in its list: '' is the app's attachments. */
const NONE = '#none';

/** The title's own entry in the list: it has no node, being out of every section. */
const CURRENT_TITLE = '#title';
