import type { Values } from '@fieldia/core';

/**
 * A ticket to an event, kept for the person who signed up (the event-ticket page): its link shown as a QR code to open
 * it on a phone, its number as a barcode for the door's scanner, the badge's number as a barcode too, and the
 * organisers' desk as a contact card in a QR code. Sample data.
 */
export function eventTickets(): Record<string, Values> {
  return {
    1: {
      attendee: 'Mona Adel',
      event: 'Cairo Real Estate Summit 2026',
      session: 'Thursday 5 November, 10:00 — Selling homes off plan',
      seat: 'Hall B, row 4, seat 12',
      reference: 'TKT-2026-0042',
      ticket_link: 'https://tickets.example/t/TKT-2026-0042',
      badge_number: 20261105,
      // The desk's contact card, as a phone's camera adds it to the contacts.
      organiser_card: ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Summit desk', 'ORG:Cairo Real Estate Summit', 'TEL;TYPE=WORK:+20 2 2537 4100', 'EMAIL:desk@summit.example', 'END:VCARD'].join('\n'),
    },
  };
}
