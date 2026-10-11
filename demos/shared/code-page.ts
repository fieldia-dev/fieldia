import type { MemoryDataSourceOptions, Page } from '@fieldia/core';

/**
 * Code in its own language, in both editors: CodeMirror (`@fieldia/code`,
 * `"widget": "code"`) for SQL, Python, CSS, YAML, a one-line JavaScript
 * condition and JSON; VS Code's editor (`@fieldia/monaco`,
 * `"widget": "monaco"`) for TypeScript, JSON and Markdown. Each language's
 * grammar loads only as a field shows it. One of each is read-only. The
 * fields before and after are plain, for Tab to move through.
 */

const field = (id: string, name: string, widget: 'code' | 'monaco', language?: string, extra: Record<string, unknown> = {}) => ({
  type: 'field' as const,
  id: `f-${id}`,
  field: name,
  widget,
  ...(language ? { options: { language } } : {}),
  ...extra,
});

export const codePage: Page = {
  fieldia: '0.1',
  id: 'code',
  title: 'Nightly job',
  description: 'Code fields, each coloured in its own language.',
  data: { kind: 'record', model: 'demo.code.job' },
  fields: {
    name: { type: 'char', label: 'Job name' },
    query: { type: 'text', label: 'Nightly query' },
    script: { type: 'text', label: 'Cleanup script' },
    styles: { type: 'text', label: 'Badge styles' },
    runner: { type: 'text', label: 'Runner settings' },
    condition: { type: 'char', label: 'Run when' },
    access: { type: 'json', label: 'Access settings' },
    generated: { type: 'text', label: 'Generated code', readonly: true },
    handler: { type: 'text', label: 'Webhook handler' },
    payload: { type: 'json', label: 'Sample payload' },
    notes: { type: 'text', label: 'Release notes' },
    approved: { type: 'text', label: 'Approved handler', readonly: true },
    owner: { type: 'char', label: 'Owner' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'section', id: 's-job', columns: 1, children: [{ type: 'field', id: 'f-name', field: 'name' }] },
      {
        type: 'section',
        id: 's-codemirror',
        title: 'CodeMirror',
        columns: 1,
        children: [
          field('query', 'query', 'code', 'sql'),
          field('script', 'script', 'code', 'python'),
          field('styles', 'styles', 'code', 'css'),
          field('runner', 'runner', 'code', 'yaml'),
          field('condition', 'condition', 'code', 'javascript', { placeholder: 'order.total > 100' }),
          field('access', 'access', 'code'),
          field('generated', 'generated', 'code', 'python'),
        ],
      },
      {
        type: 'section',
        id: 's-monaco',
        title: 'VS Code’s editor',
        columns: 1,
        children: [
          field('handler', 'handler', 'monaco', 'typescript'),
          field('payload', 'payload', 'monaco'),
          field('notes', 'notes', 'monaco', 'markdown'),
          field('approved', 'approved', 'monaco', 'typescript'),
        ],
      },
      { type: 'section', id: 's-end', columns: 1, children: [{ type: 'field', id: 'f-owner', field: 'owner' }] },
    ],
  },
  translations: {
    ar: {
      'Nightly job': 'المهمة الليلية',
      'Code fields, each coloured in its own language.': 'حقول برمجية، كل منها ملوّن بلغته.',
      'Job name': 'اسم المهمة',
      'Nightly query': 'الاستعلام الليلي',
      'Cleanup script': 'برنامج التنظيف',
      'Badge styles': 'أنماط الشارات',
      'Runner settings': 'إعدادات المشغّل',
      'Run when': 'التشغيل عندما',
      'Access settings': 'إعدادات الدخول',
      'Generated code': 'الشيفرة المولّدة',
      'Webhook handler': 'معالج الإشعارات',
      'Sample payload': 'بيانات نموذجية',
      'Release notes': 'ملاحظات الإصدار',
      'Approved handler': 'المعالج المعتمد',
      Owner: 'المسؤول',
      CodeMirror: 'CodeMirror',
      'VS Code’s editor': 'محرّر VS Code',
    },
  },
};

export const codeData: Pick<MemoryDataSourceOptions, 'records'> = {
  records: {
    'demo.code.job': {
      1: {
        name: 'Close stale orders',
        query: "SELECT id, total\nFROM orders\nWHERE status = 'open'\n  AND created_at < now() - interval '30 days';",
        script: 'def close_stale(orders):\n    """Close what has waited a month."""\n    for order in orders:\n        if order.days_open > 30:\n            order.close()\n    return len(orders)',
        styles: '.badge {\n  color: #0a3069;\n  padding: 2px 6px;\n}',
        runner: 'schedule: "0 2 * * *"\nretries: 3\nnotify:\n  - ops@example.com',
        condition: 'order.total > 100 && !order.paid',
        access: { badge_readers: 4, zones: ['reception', 'lab'] },
        generated: '# Written by the scheduler: read only.\nJOB_ID = 42\nENABLED = True',
        handler: 'export async function handle(event: OrderEvent): Promise<void> {\n  if (event.type === "order.closed") {\n    await notify(event.orderId);\n  }\n}',
        payload: { type: 'order.closed', orderId: 1042, total: 129.5, paid: false },
        notes: '# Release 2.4\n\n- **Faster** nightly job\n- Closes orders after *30 days*',
        approved: 'export const approved = true;\nexport const reviewer = "ops";',
        owner: 'Operations',
      },
    },
  },
};
