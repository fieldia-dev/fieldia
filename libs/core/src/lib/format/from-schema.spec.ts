import { pageFromSchema, schemaChoices, schemaNoteWords, wordsOf } from './from-schema';
import { validatePage } from './validate';

/**
 * A starting page from what an app already has — a JSON Schema, an OpenAPI document, a model's fields: each property a
 * field of its kind with its words and rules, the page valid as Fieldia reads it, and what could not be taken as it is
 * said, never dropped quietly.
 */

const valid = (result: { page: unknown }) => {
  const checked = validatePage(result.page);
  if (!checked.ok) throw new Error(checked.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return checked.page;
};

const enquiry = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Property enquiry',
  type: 'object',
  required: ['name', 'email', 'kind'],
  properties: {
    name: { type: 'string', title: 'Your name', maxLength: 80, minLength: 2 },
    email: { type: 'string', format: 'email', description: 'We answer here.' },
    phone: { type: ['string', 'null'], format: 'phone' },
    kind: { type: 'string', enum: ['villa', 'apartment', 'office_space'], default: 'villa' },
    bedrooms: { type: 'integer', minimum: 1, maximum: 9, exclusiveMaximum: 10 },
    budget: { type: 'number', minimum: 0, multipleOf: 0.01 },
    moveIn: { type: 'string', format: 'date' },
    callAt: { type: 'string', format: 'date-time' },
    newsletter: { type: 'boolean', default: false },
    code: { type: 'string', pattern: '^[A-Z]{2}-\\d{4}$' },
    contains: { type: 'string', pattern: '\\d' },
    notes: { type: 'string', maxLength: 2000 },
    features: { type: 'array', items: { type: 'string', enum: ['garden', 'pool', 'garage'] }, uniqueItems: true },
    photos: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: 10 },
    'site-id': { type: 'string', format: 'uuid', readOnly: true },
    address: {
      type: 'object',
      title: 'Address',
      properties: { street: { type: 'string' }, city: { type: 'string', enum: ['Cairo', 'Giza'] } },
      required: ['city'],
    },
    viewings: {
      type: 'array',
      items: { type: 'object', title: 'Viewing', properties: { day: { type: 'string', format: 'date' }, with: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['day'] },
    },
    tags: { type: 'array', items: { type: 'string' } },
    extra: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    source: { const: 'website' },
  },
};

describe('pageFromSchema: a JSON Schema', () => {
  const result = pageFromSchema(enquiry);
  const page = valid(result);

  it('reads it as a JSON Schema, titled and named from it, a record of its own model', () => {
    expect(result.from).toBe('json-schema');
    expect([page.title, page.id, page.data]).toEqual(['Property enquiry', 'property-enquiry', { kind: 'record', model: 'property.enquiry' }]);
  });

  it('makes each property a field of its kind, with its words, its rules and its default', () => {
    expect(page.fields['name']).toEqual({ type: 'char', label: 'Your name', size: 80, required: true });
    expect(page.fields['email']).toEqual({ type: 'char', label: 'Email', help: 'We answer here.', required: true });
    expect(page.fields['phone']).toEqual({ type: 'char', label: 'Phone' });
    expect(page.fields['kind']).toEqual({ type: 'selection', label: 'Kind', required: true, default: 'villa', options: [{ value: 'villa', label: 'Villa' }, { value: 'apartment', label: 'Apartment' }, { value: 'office_space', label: 'Office space' }] });
    expect(page.fields['bedrooms']).toEqual({ type: 'integer', label: 'Bedrooms', min: 1, max: 9 });
    expect(page.fields['budget']).toEqual({ type: 'float', label: 'Budget', min: 0, digits: [16, 2] });
    expect(page.fields['moveIn']).toEqual({ type: 'date', label: 'Move in' });
    expect(page.fields['callAt']).toEqual({ type: 'datetime', label: 'Call at' });
    expect(page.fields['newsletter']).toEqual({ type: 'boolean', label: 'Newsletter', default: false });
    expect(page.fields['code']).toEqual({ type: 'char', label: 'Code', pattern: '[A-Z]{2}-\\d{4}' });
    expect(page.fields['contains']).toEqual({ type: 'char', label: 'Contains', pattern: '.*(?:\\d).*' });
    expect(page.fields['notes']).toEqual({ type: 'text', label: 'Notes', size: 2000 });
    expect(page.fields['features']).toMatchObject({ type: 'selection', multiple: true, options: [{ value: 'garden' }, { value: 'pool' }, { value: 'garage' }] });
    expect(page.fields['photos']).toEqual({ type: 'binary', label: 'Photos', multiple: true, maxFiles: 10 });
    expect(page.fields['site_id']).toEqual({ type: 'char', label: 'Site id', readonly: true });
    expect(page.fields['source']).toEqual({ type: 'char', label: 'Source', readonly: true, default: 'website' });
  });

  it("shows each as its kind's box, a long one across the form", () => {
    const nodes = (page.layout as { children: { children: { field: string; widget?: string; colspan?: number }[] }[] }).children.flatMap((section) => section.children);
    const node = (field: string) => nodes.find((one) => one.field === field);
    expect([node('email')?.widget, node('phone')?.widget, node('notes')?.colspan, node('viewings')?.colspan]).toEqual(['email', 'phone', 2, 2]);
  });

  it("an object's properties in a section of its own; a list of objects as lines", () => {
    const sections = (page.layout as { children: { title?: string; children: { field: string }[] }[] }).children;
    expect(sections.map((section) => section.title ?? null)).toEqual([null, 'Address']);
    expect(sections[1].children.map((node) => node.field)).toEqual(['address_street', 'address_city']);
    expect(page.fields['address_city']).toMatchObject({ type: 'selection', required: true });
    expect(page.fields['viewings']).toMatchObject({ type: 'one2many', relation: 'viewing', fields: { day: { type: 'date', label: 'Day', required: true }, with: { type: 'char', label: 'With' }, tags: { type: 'json' } } });
  });

  it('says what it kept with a change, and what has no field of its own is kept as JSON', () => {
    expect(result.unmapped).toEqual([]);
    expect(result.notes).toEqual(
      expect.arrayContaining([
        { path: 'name', code: 'limit', detail: 'minLength 2' },
        { path: 'site-id', code: 'renamed', detail: 'site_id' },
        { path: 'address', code: 'flattened' },
        { path: 'tags', code: 'json', detail: 'a list of text' },
        { path: 'extra', code: 'json', detail: 'a value of several kinds' },
        { path: 'viewings[].tags', code: 'json', detail: 'a list inside a line' },
        { path: 'source', code: 'constant', detail: '"website"' },
      ])
    );
    expect(schemaNoteWords({ path: 'name', code: 'limit', detail: 'minLength 2' })).toBe('name: minLength 2 is not checked by the page; your server checks it.');
  });

  it('flattens objects two deep, whatever their names, and keeps one deeper as JSON', () => {
    const deep = { type: 'object', properties: { home_address: { type: 'object', properties: { geo: { type: 'object', properties: { lat: { type: 'number' }, extra: { type: 'object', properties: { note: { type: 'string' } } } } } } } } };
    const result = pageFromSchema(deep, { title: 'Deep' });
    expect(Object.keys(valid(result).fields)).toEqual(['home_address_geo_lat', 'home_address_geo_extra']);
    expect(result.notes).toContainEqual({ path: 'home_address.geo.extra', code: 'json', detail: 'an object' });
  });

  it('as a survey: a step for the page and for each object, sent as responses', () => {
    const survey = valid(pageFromSchema(enquiry, { kind: 'survey', title: 'Tell us what you need' }));
    expect(survey.data).toEqual({ kind: 'responses' });
    expect(survey.layout.type).toBe('wizard');
    expect((survey.layout as { children: { label: string }[] }).children.map((step) => step.label)).toEqual(['Tell us what you need', 'Address']);
  });

  it('follows references inside the document, all of them merged; says one it cannot follow', () => {
    const schema = {
      $defs: { named: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, money: { type: 'number', minimum: 0 } },
      allOf: [{ $ref: '#/$defs/named' }, { type: 'object', properties: { price: { $ref: '#/$defs/money', title: 'Price' }, owner: { $ref: 'https://example.com/owner.json' } } }],
    };
    const result = pageFromSchema(schema, { title: 'Listing' });
    const page = valid(result);
    expect(page.fields).toEqual({ name: { type: 'char', label: 'Name', required: true }, price: { type: 'float', label: 'Price', min: 0 } });
    expect(result.unmapped).toEqual([{ path: 'owner', code: 'reference', detail: 'https://example.com/owner.json' }]);
  });

  it('refuses what is no schema of an object, saying why by a code too', () => {
    expect(() => pageFromSchema('text')).toThrow(expect.objectContaining({ code: 'not-json-object' }));
    expect(() => pageFromSchema('text')).toThrow('A schema is a JSON object');
    expect(() => pageFromSchema({ type: 'string' })).toThrow('not a JSON Schema, an OpenAPI document or a model’s fields');
    expect(() => pageFromSchema({ type: 'object', properties: {} })).toThrow('no properties to ask for');
  });
});

const petstore = {
  openapi: '3.1.0',
  info: { title: 'Lettings', version: '1' },
  paths: {
    '/listings': {
      get: { operationId: 'findListings', summary: 'Find listings', parameters: [{ name: 'city', in: 'query', required: true, schema: { type: 'string' } }, { name: 'max_price', in: 'query', schema: { type: 'number' } }] },
      post: { operationId: 'addListing', summary: 'Add a listing', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } } } },
    },
  },
  components: {
    schemas: {
      Listing: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, rent: { type: 'number', minimum: 0 }, furnished: { type: 'boolean' }, id: { type: 'integer', readOnly: true } } },
      Agent: { type: 'object', properties: { name: { type: 'string' } } },
    },
  },
};

describe('pageFromSchema: an OpenAPI document', () => {
  it('offers its operations and its schemas to start from', () => {
    expect(schemaChoices(petstore)).toEqual([
      { value: 'GET /listings', label: 'GET /listings — Find listings' },
      { value: 'POST /listings', label: 'POST /listings — Add a listing' },
      { value: 'Listing', label: 'Listing' },
      { value: 'Agent', label: 'Agent' },
    ]);
    expect(schemaChoices(enquiry)).toEqual([]);
  });

  it("an operation's request body, by its method and path or its id", () => {
    for (const asked of ['POST /listings', 'addListing']) {
      const result = pageFromSchema(petstore, { schema: asked });
      const page = valid(result);
      expect(result.from).toBe('openapi');
      expect(page.title).toBe('Add a listing');
      expect(Object.keys(page.fields)).toEqual(['title', 'rent', 'furnished', 'id']);
      expect(page.fields['id']).toEqual({ type: 'integer', label: 'Id', readonly: true });
    }
  });

  it("an operation's parameters, the first operation by default; a component by its name", () => {
    const page = valid(pageFromSchema(petstore));
    expect(page.title).toBe('Find listings');
    expect(page.fields).toEqual({ city: { type: 'char', label: 'City', required: true }, max_price: { type: 'float', label: 'Max price' } });
    expect(Object.keys(valid(pageFromSchema(petstore, { schema: 'Agent' })).fields)).toEqual(['name']);
    expect(() => pageFromSchema(petstore, { schema: 'Nothing' })).toThrow('no operation or schema “Nothing”');
  });

  it("Swagger 2's definitions and its body parameter", () => {
    const swagger = { swagger: '2.0', paths: { '/pets': { post: { parameters: [{ in: 'body', name: 'pet', schema: { $ref: '#/definitions/Pet' } }] } } }, definitions: { Pet: { type: 'object', properties: { name: { type: 'string' }, born: { type: 'string', format: 'date' } } } } };
    expect(valid(pageFromSchema(swagger)).fields).toEqual({ name: { type: 'char', label: 'Name' }, born: { type: 'date', label: 'Born' } });
  });
});

describe("pageFromSchema: a model's fields", () => {
  it("a backend's field list (Flectra's fields_get): its words, choices and links", () => {
    const result = pageFromSchema({
      name: { type: 'char', string: 'Customer', required: true, size: 64 },
      state: { type: 'selection', string: 'Status', selection: [['draft', 'Draft'], ['done', 'Done']], readonly: true },
      partner_id: { type: 'many2one', string: 'Partner', relation: 'res.partner' },
      amount: { type: 'monetary', string: 'Amount', currency_field: 'currency_id' },
      currency_id: { type: 'many2one', string: 'Currency', relation: 'res.currency' },
      line_ids: { type: 'one2many', string: 'Lines', relation: 'sale.order.line' },
      note: { type: 'html', string: 'Terms' },
      props: { type: 'properties_definition', string: 'Properties' },
    }, { title: 'Sale order', model: 'sale.order' });
    const page = valid(result);
    expect(result.from).toBe('fields');
    expect(page.data).toEqual({ kind: 'record', model: 'sale.order' });
    expect(page.fields['name']).toEqual({ type: 'char', label: 'Customer', required: true, size: 64 });
    expect(page.fields['state']).toEqual({ type: 'selection', label: 'Status', readonly: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] });
    expect(page.fields['amount']).toEqual({ type: 'monetary', label: 'Amount', currencyField: 'currency_id' });
    expect(page.fields['line_ids']).toEqual({ type: 'many2many', label: 'Lines', relation: 'sale.order.line' });
    expect(result.notes).toEqual([{ path: 'line_ids', code: 'links', detail: 'sale.order.line' }]);
    expect(result.unmapped).toEqual([{ path: 'props', code: 'kind', detail: 'properties_definition' }]);
  });

  it("Fieldia's own fields, as they are; a list of them by name", () => {
    const own = { title: { type: 'char', label: 'Title', required: true }, kind: { type: 'selection', label: 'Kind', options: [{ value: 'a', label: 'A' }] } };
    expect(valid(pageFromSchema(own)).fields).toEqual(own);
    expect(valid(pageFromSchema([{ name: 'title', type: 'char', label: 'Title' }])).fields).toEqual({ title: { type: 'char', label: 'Title' } });
  });
});

describe('a name in words', () => {
  it('reads snake, camel and kebab case alike', () => {
    expect(['first_name', 'firstName', 'first-name', 'URL', 'moveInDate', 'id'].map(wordsOf)).toEqual(['First name', 'First name', 'First name', 'URL', 'Move in date', 'Id']);
  });
});
