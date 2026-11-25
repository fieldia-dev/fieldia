import type { ActionRequest, ActionResult, FieldNode, MenuItem, Page, SheetNode, Values } from '@fieldia/core';
import { wiHeadPage } from './wi-header';

/**
 * A bug's tags, menus and texts (`?page=wi-more`, and over itself in a large
 * popup with `&open=dialog`): the record head lane's page (wi-header.ts) with
 * the three things an app moving to Fieldia asked for — tags inline in the
 * head's row (here the box typed in, as an app may draw them; the backlog's
 * bug has Add Tag), a ⋮ menu as a work tracker's with dividers and Templates ›
 * holding the app's templates (`menuFrom`), Save and Close's own menu holding
 * a menu, and a Description read first, Edit at its heading's end. For their
 * browser gate, in `mountViewer` and `openFormDialog` alike: record 1 has two
 * tags and a Description, 2 none and nothing written, 3 eight tags. Invented.
 */

const head = wiHeadPage.layout as SheetNode;
const sheetHead = head.head as NonNullable<SheetNode['head']>;

/** The tracker's ⋮, as its menu reads; Templates' own item, then the app's, as it opens. */
const MENU: MenuItem[] = [
  { id: 'm-new-linked', label: 'New linked work item', action: 'new-linked' },
  { id: 'm-change-type', label: 'Change type…', action: 'change-type' },
  { id: 'm-move', label: 'Move to team project…', action: 'move-project' },
  { id: 'm-copy', label: 'Create copy of work item…', icon: 'copy', builtin: 'duplicate' },
  { id: 'm-email', label: 'Email work item', icon: 'mail', action: 'email' },
  { id: 'm-delete', label: 'Delete', builtin: 'delete' },
  { id: 'm-copy-link', label: 'Copy link', icon: 'link', action: 'copy-link' },
  { id: 'm-rule-1', type: 'divider' },
  { id: 'm-templates', label: 'Templates', icon: 'file', menuFrom: 'templates', params: { project: 'Portal' }, menu: [{ id: 'm-capture', label: 'Capture…', action: 'capture-template' }, { id: 'm-rule-templates', type: 'divider' }] },
  { id: 'm-rule-2', type: 'divider' },
  { id: 'm-branch', label: 'New branch…', icon: 'branch', action: 'new-branch', invisible: "state == 'closed'" },
  { id: 'm-rule-3', type: 'divider' },
  { id: 'm-customize', label: 'Customize', icon: 'settings', action: 'customize' },
];

/** A text group as the tracker's: its heading's ⤢, ^, and the text's own Edit and Done; the text read first. */
const textGroup = (id: string, title: string, field: string, placeholder: string): Page['layout'] => ({
  type: 'section',
  id,
  title,
  style: 'line',
  collapsible: true,
  foldAt: 'end',
  maximise: true,
  children: [{ type: 'field', id: `f-${field}`, field, labels: 'hidden', placeholder, options: { editor: 'rich', edit: 'button', toolbar: 'focus', toolbarAt: 'top', tools: ['bold', 'italic', 'underline', 'bulletList', 'numberList', 'link', 'image', 'mention'], mention: { model: 'wi.user' } } }],
}) as unknown as Page['layout'];

const details = (head.children[0] as { children: { children: unknown[] }[] }).children[0];

export const wiMorePage: Page = {
  ...wiHeadPage,
  // Its menu's dividers came in format 0.9: stamped with the format it is written in, as a page read by its stamp is.
  fieldia: '0.13',
  id: 'wi-more',
  data: { kind: 'record', model: 'wi.more' },
  fields: {
    ...wiHeadPage.fields,
    tags: { type: 'many2many', label: 'Tags', relation: 'wi.more.tag' },
    description: { type: 'html', label: 'Description' },
    system_info: { type: 'html', label: 'System Info' },
  },
  layout: {
    ...head,
    id: 'wi-more-bug',
    head: {
      ...sheetHead,
      meta: [...(sheetHead.meta ?? []), { type: 'field', id: 'h-tags', field: 'tags', labels: 'hidden', placeholder: 'Add Tag' } as FieldNode],
      actions: (sheetHead.actions ?? []).map((button) =>
        button.id === 'b-save-close'
          ? { ...button, menu: [...(button.menu ?? []), { id: 'm-save-rule', type: 'divider' }, { id: 'm-save-as', label: 'Save as', menu: [{ id: 'm-save-draft', label: 'Draft', action: 'save-draft' }, { id: 'm-save-copy', label: 'Copy', builtin: 'duplicate' }] }] }
          : button
      ),
    },
    toolbar: { menu: MENU },
    children: [
      {
        ...(head.children[0] as object),
        children: [
          {
            ...(details as object),
            children: [
              {
                type: 'section',
                id: 'd-columns',
                style: 'plain',
                columns: 2,
                tracks: ['60%', '1fr'],
                children: [
                  { type: 'section', id: 'd-texts', style: 'plain', children: [textGroup('g-description', 'Description', 'description', 'Click to add Description.'), textGroup('g-system', 'System Info', 'system_info', 'Click to add System Info.')] },
                  // Planning and the Discussion, as the head lane's bug has them.
                  { type: 'section', id: 'd-side', style: 'plain', children: (details as { children: { children: unknown[] }[] }).children[0].children.slice(1) as object[] },
                ],
              },
            ],
          },
          ...((head.children[0] as { children: unknown[] }).children.slice(1) as object[]),
        ],
      },
    ],
  } as SheetNode,
  translations: {
    ar: { ...wiHeadPage.translations?.['ar'], Tags: 'الوسوم', 'Add Tag': 'إضافة وسم', Description: 'الوصف', 'System Info': 'معلومات النظام', 'Click to add Description.': 'انقر لإضافة وصف.', 'Click to add System Info.': 'انقر لإضافة معلومات النظام.', 'New linked work item': 'بند عمل مرتبط جديد', 'Change type…': 'تغيير النوع…', 'Move to team project…': 'نقل إلى مشروع فريق…', 'Create copy of work item…': 'إنشاء نسخة من بند العمل…', 'Email work item': 'إرسال بند العمل بالبريد', Delete: 'حذف', Templates: 'القوالب', 'Capture…': 'حفظ كقالب…', 'New branch…': 'فرع جديد…', Customize: 'تخصيص', 'Save as': 'حفظ باسم', Draft: 'مسودة', Copy: 'نسخة' },
    de: { ...wiHeadPage.translations?.['de'], Tags: 'Tags', 'Add Tag': 'Tag hinzufügen', Description: 'Beschreibung', 'System Info': 'Systeminformationen', 'Click to add Description.': 'Klicken, um eine Beschreibung hinzuzufügen.', 'Click to add System Info.': 'Klicken, um Systeminformationen hinzuzufügen.', 'New linked work item': 'Neues verknüpftes Arbeitselement', 'Change type…': 'Typ ändern…', 'Move to team project…': 'In Teamprojekt verschieben…', 'Create copy of work item…': 'Kopie des Arbeitselements erstellen…', 'Email work item': 'Arbeitselement per E-Mail senden', Delete: 'Löschen', Templates: 'Vorlagen', 'Capture…': 'Erfassen…', 'New branch…': 'Neuer Branch…', Customize: 'Anpassen', 'Save as': 'Speichern unter', Draft: 'Entwurf', Copy: 'Kopie' },
    fr: { ...wiHeadPage.translations?.['fr'], Tags: 'Balises', 'Add Tag': 'Ajouter une balise', Description: 'Description', 'System Info': 'Informations système', 'Click to add Description.': 'Cliquez pour ajouter une description.', 'Click to add System Info.': 'Cliquez pour ajouter les informations système.', 'New linked work item': 'Nouvel élément de travail lié', 'Change type…': 'Changer le type…', 'Move to team project…': 'Déplacer vers un projet d’équipe…', 'Create copy of work item…': 'Créer une copie de l’élément de travail…', 'Email work item': 'Envoyer l’élément de travail par e-mail', Delete: 'Supprimer', Templates: 'Modèles', 'Capture…': 'Capturer…', 'New branch…': 'Nouvelle branche…', Customize: 'Personnaliser', 'Save as': 'Enregistrer sous', Draft: 'Brouillon', Copy: 'Copie' },
  },
};

const TAG_NAMES = ['Checkout', 'Mobile', 'Stock', 'Pricing', 'Night shift', 'Regression', 'Payments', 'Release 14'];
const tags = (count: number) => TAG_NAMES.slice(0, count).map((label, i) => ({ id: i + 1, label }));
const DESCRIPTION = '<p>Paying from the cart shows <strong>12</strong> left; the shelf has <strong>15</strong>. See <a href="https://example.com/orders/SO-2088">order SO-2088</a>.</p><ul><li>Release 3 of 15</li><li>Open the product</li></ul>';

/** The three bugs: two tags and a Description; none and nothing written; eight tags. Their other values are the head lane's bug's. */
export function wiMoreRecords(base: Values): Record<string, Record<string, Values>> {
  return {
    'wi.more': {
      1: { ...base, tags: tags(2), description: DESCRIPTION, system_info: null },
      2: { ...base, number: 4128, title: 'Count stock again after a partial release', tags: [], description: null, system_info: null, comment_count: 0 },
      3: { ...base, number: 4129, title: 'Night shift scanner counts twice', tags: tags(8), description: DESCRIPTION, system_info: null, comment_count: 2 },
    },
    'wi.more.tag': Object.fromEntries(TAG_NAMES.map((name, i) => [i + 1, { name }])),
  };
}

/** The bug's templates, by its kind and project: given as ⋮ › Templates opens; one picked fills what it says. */
const TEMPLATES = [
  { id: 'crash', label: 'Crash report', values: { severity: '1', priority: '1', system_info: '<p><strong>Browser:</strong> Edge 141 on Windows 11</p>' } },
  { id: 'figures', label: 'Wrong figures', values: { severity: '2', priority: '2' } },
];

/** The app's answers to the page's ⋮: the templates as it opens, one applied; the tracker's others said, as an app's would. */
export function wiMoreAction(request: ActionRequest): ActionResult | undefined {
  if (request.action === 'templates') return { menu: TEMPLATES.map((one) => ({ id: `tpl-${one.id}`, label: one.label, icon: 'file', action: 'apply-template', params: { template: one.id } })) };
  if (request.action === 'apply-template') {
    const found = TEMPLATES.find((one) => one.id === request.params?.['template']);
    return found ? { values: found.values, say: `${found.label}: applied.` } : undefined;
  }
  return undefined;
}
