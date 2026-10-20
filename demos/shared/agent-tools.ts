import type { Option, Values } from '@fieldia/core';

/**
 * An AI agent's tools and what starts it (examples/pages/agent-tools.page.json): each line's choices are its
 * connection's, from the app's own lists — `connection_tools` and `connection_events` — asked by the line's
 * connection, as nexibi's agents ask for an integration's tools. A list answers after a moment, as a server does.
 */

/** The company's connections, each to one service. */
const CONNECTIONS: Record<number, { name: string; service: Service }> = {
  1: { name: 'Gmail — sales@niletraders.example', service: 'gmail' },
  2: { name: 'Slack — Nile Traders', service: 'slack' },
  3: { name: 'Google Drive — Shared drive', service: 'drive' },
  4: { name: 'HubSpot — Sales', service: 'hubspot' },
};
type Service = 'gmail' | 'slack' | 'drive' | 'hubspot';

/** What each service lets an agent do. "Search" is every service's, in its own words: a line keeps it when its connection changes. */
const TOOLS: Record<Service, Option[]> = {
  gmail: [
    { value: 'search', label: 'Search mail' },
    { value: 'send_email', label: 'Send an email' },
    { value: 'draft_reply', label: 'Draft a reply' },
    { value: 'add_label', label: 'Add a label' },
  ],
  slack: [
    { value: 'search', label: 'Search messages' },
    { value: 'post_message', label: 'Post in a channel' },
    { value: 'direct_message', label: 'Send a direct message' },
  ],
  drive: [
    { value: 'search', label: 'Search files' },
    { value: 'read_file', label: 'Read a file' },
    { value: 'create_document', label: 'Create a document' },
  ],
  hubspot: [
    { value: 'search', label: 'Search contacts' },
    { value: 'create_deal', label: 'Create a deal' },
    { value: 'log_call', label: 'Log a call' },
  ],
};

/** What starts an agent, by service. */
const EVENTS: Record<Service, Option[]> = {
  gmail: [
    { value: 'new_email', label: 'A new email arrives' },
    { value: 'starred', label: 'An email is starred' },
  ],
  slack: [
    { value: 'mention', label: 'Someone mentions the agent' },
    { value: 'new_message', label: 'A new message in a channel' },
  ],
  drive: [{ value: 'file_added', label: 'A file is added' }],
  hubspot: [
    { value: 'deal_stage', label: 'A deal changes stage' },
    { value: 'new_contact', label: 'A new contact' },
  ],
};

/** A list answers after a moment, as one from a server does, so its loading shows. */
const LIST_DELAY_MS = 400;
const later = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LIST_DELAY_MS));
const serviceOf = (values: Values) => CONNECTIONS[Number((values['connection_id'] as { id?: unknown } | null)?.id)]?.service;

/** The app's lists the agent's lines ask, by the line's values: its connection. */
export const agentLists = {
  connection_tools: (values: Values) => later(TOOLS[serviceOf(values) as Service] ?? []),
  connection_events: (values: Values) => later(EVENTS[serviceOf(values) as Service] ?? []),
};

const link = (id: number) => ({ id, label: CONNECTIONS[id].name });

/** The connections, and the agent with its tools and starts. */
export const agentRecords = {
  'ai.connection': Object.fromEntries(Object.entries(CONNECTIONS).map(([id, { name }]) => [id, { name }])),
  'ai.agent': {
    1: {
      name: 'Sales inbox helper',
      instructions: 'Answers customers who write to the sales inbox, finds them in HubSpot, and tells the team in Slack.',
      tool_ids: [
        { key: 't1', id: 1, values: { connection_id: link(1), tool: 'send_email', ask_first: true } },
        { key: 't2', id: 2, values: { connection_id: link(1), tool: 'search', ask_first: false } },
        { key: 't3', id: 3, values: { connection_id: link(4), tool: 'search', ask_first: false } },
        { key: 't4', id: 4, values: { connection_id: link(2), tool: 'post_message', ask_first: false } },
      ],
      trigger_ids: [
        { key: 's1', id: 1, values: { connection_id: link(1), event: 'new_email', only_when: 'From a customer' } },
        { key: 's2', id: 2, values: { connection_id: link(2), event: 'mention', only_when: null } },
      ],
    },
  },
};
