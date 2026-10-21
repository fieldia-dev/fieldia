import type { Values } from '@fieldia/core';
import { demoNow } from './calendar';
import { area } from './areas';

/**
 * A sales team's buyer leads, for the queue that counts its filters (leads-queue): each with its next follow-up counted
 * from now — the reader's own, or `?now=2026-10-14T09:40` as the browser tests pin it — so five are always late, three
 * due today, the rest coming or not planned yet; a few with no agent yet, a few won. The same leads on every visit.
 */

const AGENTS = ['Mona Adel', 'Karim Samir', 'Salma Hany', 'Youssef Nabil'];
const SOURCES = ['website', 'whatsapp', 'walk_in', 'referral'];

/** Who is buying, what, the next follow-up and when they came in (days from today), their stage, agent and budget. */
const LEADS: [name: string, next: number | null, came: number, stage: string, agent: number | null, budget: number][] = [
  ['Omar Nabil — 3-bedroom flat, New Cairo', -9, -40, 'visit', 0, 6_500_000],
  ['Hana Wael — villa with a garden, Sheikh Zayed', -6, -21, 'offer', 1, 24_000_000],
  ['Tamer Said — 2-bedroom flat, Maadi', -4, -12, 'new', null, 3_200_000],
  ['Laila Mostafa — penthouse, Zamalek', -2, -9, 'visit', 2, 18_500_000],
  ['Ziad Kamal — duplex, Heliopolis', -1, -5, 'new', 3, 7_800_000],
  ['Mariam Ezz — flat near a school, Nasr City', -12, -60, 'won', 0, 4_100_000],
  ['Ahmed Fathy — studio, Dokki', -3, -30, 'won', 1, 1_900_000],
  ['Nour Hassan — 4-bedroom villa, New Cairo', 0, -14, 'offer', 2, 16_000_000],
  ['Rana Fouad — 3-bedroom flat, Mohandessin', 0, -3, 'new', null, 5_400_000],
  ['Sherif Emad — flat with a view, Garden City', 0, -7, 'visit', 3, 9_900_000],
  ['Dina Sherif — 2-bedroom flat, 6th of October', 1, -2, 'new', 0, 2_700_000],
  ['Amr Gamal — villa, Sheikh Zayed', 2, -18, 'visit', 1, 21_000_000],
  ['Mahmoud Reda — family flat, Maadi', 3, -1, 'new', null, 4_800_000],
  ['Salma Ali — penthouse, New Cairo', 5, -25, 'offer', 2, 12_500_000],
  ['Youssef Adel — flat to let out, Nasr City', 8, -4, 'new', 3, 3_000_000],
  ['Hassan Ali — duplex with a roof, Zamalek', 10, -33, 'visit', 0, 14_200_000],
  ['Karima Nabil — 3-bedroom flat, Heliopolis', 14, -6, 'new', 1, 5_900_000],
  ['Fady Samir — villa by the golf course, New Cairo', 21, -45, 'offer', null, 27_000_000],
  ['Ola Hany — small flat, Dokki', null, 0, 'new', null, 2_200_000],
  ['Mostafa Tarek — 2-bedroom flat, Mohandessin', null, -1, 'new', 2, 3_600_000],
  ['Yasmin Said — garden flat, Maadi', 30, -50, 'visit', 3, 6_100_000],
  ['Khaled Ezz — villa, 6th of October', -20, -90, 'won', 0, 11_000_000],
];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayFrom = (today: Date, days: number) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));

export function sampleLeads(now = demoNow()): Record<number, Values> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Object.fromEntries(
    LEADS.map(([name, next, came, stage, agent, budget], i) => [
      i + 1,
      {
        name,
        phone: `+20 10 ${String(1200 + i * 37).padStart(4, '0')} ${String(4400 + i * 53).padStart(4, '0')}`,
        stage,
        agent: agent === null ? null : AGENTS[agent],
        budget,
        next_on: next === null ? null : dayFrom(today, next),
        came_on: dayFrom(today, came),
        source: SOURCES[i % SOURCES.length],
        email: null,
        commission: 2.5,
        // What the first lead wants: all of Nasr City, and two neighbourhoods of New Cairo (shared/areas.ts).
        areas: i === 0 ? ['Nasr City', 'Rehab', 'Madinaty'].map(area) : [],
        notes: null,
        active: true,
      },
    ])
  );
}
