import type { Page } from '../format/page';
import { scoreOf } from './score';

/** A quiz's points: each option chosen adds its score, out of the most the answers could earn. */

const page = (fields: Record<string, unknown>) =>
  ({
    fieldia: '0.1',
    id: 'quiz',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((field) => ({ type: 'field', id: `n-${field}`, field })) },
  }) as unknown as Page;

const capital = {
  type: 'selection',
  label: 'Capital of Egypt?',
  other: true,
  options: [
    { value: 'cairo', label: 'Cairo', score: 2 },
    { value: 'giza', label: 'Giza', score: 0 },
    { value: 'luxor', label: 'Luxor', score: -1 },
  ],
};
const rivers = {
  type: 'selection',
  label: 'Which are rivers?',
  multiple: true,
  options: [
    { value: 'nile', label: 'Nile', score: 1 },
    { value: 'congo', label: 'Congo', score: 1.5 },
    { value: 'sahara', label: 'Sahara', score: -0.5 },
    { value: 'none', label: 'Not sure' },
  ],
};
const grid = (multiple = false) => ({
  type: 'matrix',
  label: 'True or false',
  multiple,
  rows: [{ value: 'a', label: 'Ice floats' }, { value: 'b', label: 'Fire is cold' }],
  columns: [{ value: 't', label: 'True', score: 1 }, { value: 'f', label: 'False', score: 0.5 }],
});

describe('scoreOf', () => {
  it('is nothing for a page without points', () => {
    expect(scoreOf(page({ name: { type: 'char', label: 'Name' }, pick: { type: 'selection', label: 'Pick', options: [{ value: 1, label: 'One' }] } }), {})).toBeNull();
  });

  it('adds the score of the one option chosen, out of the best option’s', () => {
    const quiz = page({ capital });
    expect(scoreOf(quiz, { capital: 'cairo' })).toEqual({ score: 2, max: 2 });
    expect(scoreOf(quiz, { capital: 'luxor' })).toEqual({ score: -1, max: 2 });
    // Not answered, or answered in one's own words: nothing.
    expect(scoreOf(quiz, { capital: null })).toEqual({ score: 0, max: 2 });
    expect(scoreOf(quiz, {})).toEqual({ score: 0, max: 2 });
    expect(scoreOf(quiz, { capital: 'Alexandria' })).toEqual({ score: 0, max: 2 });
  });

  it('earns at most nothing from a question whose every option costs points', () => {
    const traps = page({ trap: { type: 'selection', label: 'Pick one', options: [{ value: 'a', label: 'A', score: -1 }, { value: 'b', label: 'B', score: -2 }] } });
    expect(scoreOf(traps, { trap: 'a' })).toEqual({ score: -1, max: 0 });
  });

  it('adds every option chosen of several, out of all the options worth something', () => {
    const quiz = page({ rivers });
    expect(scoreOf(quiz, { rivers: ['nile', 'congo'] })).toEqual({ score: 2.5, max: 2.5 });
    expect(scoreOf(quiz, { rivers: ['nile', 'sahara', 'none'] })).toEqual({ score: 0.5, max: 2.5 });
    expect(scoreOf(quiz, { rivers: 'nile' })).toEqual({ score: 0, max: 2.5 });
  });

  it('adds a matrix’s columns chosen in each row, out of the best column for each row', () => {
    expect(scoreOf(page({ grid: grid() }), { grid: { a: 't', b: 'f' } })).toEqual({ score: 1.5, max: 2 });
    expect(scoreOf(page({ grid: grid() }), { grid: { a: 'f' } })).toEqual({ score: 0.5, max: 2 });
    // Several a row: every column chosen, out of every column worth something.
    expect(scoreOf(page({ grid: grid(true) }), { grid: { a: ['t', 'f'], b: ['f'] } })).toEqual({ score: 2, max: 3 });
    expect(scoreOf(page({ grid: grid() }), { grid: 'nonsense' })).toEqual({ score: 0, max: 2 });
  });

  it('adds up the whole page, its decimals summed without a computer’s crumbs', () => {
    const quiz = page({ capital, rivers, grid: grid(), name: { type: 'char', label: 'Name' } });
    expect(scoreOf(quiz, { capital: 'cairo', rivers: ['nile', 'congo', 'sahara'], grid: { a: 't', b: 'f' } })).toEqual({ score: 5.5, max: 6.5 });
    const tenths = page({ a: { type: 'selection', label: 'A', options: [{ value: 1, label: 'x', score: 0.1 }] }, b: { type: 'selection', label: 'B', options: [{ value: 1, label: 'x', score: 0.2 }] } });
    expect(scoreOf(tenths, { a: 1, b: 1 })).toEqual({ score: 0.3, max: 0.3 });
  });
});
