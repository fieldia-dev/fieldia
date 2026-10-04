import { dependencyOrder } from './order';

describe('dependencyOrder', () => {
  it('puts each field after the worked-out fields it reads, and ignores plain values', () => {
    const reads = new Map([
      ['grand', ['total', 'tax']],
      ['tax', ['total', 'rate']],
      ['total', ['price', 'qty']],
    ]);
    expect(dependencyOrder(reads)).toEqual({ order: ['total', 'tax', 'grand'], cycles: [] });
  });

  it('keeps the page’s order where nothing depends on anything', () => {
    expect(dependencyOrder(new Map([['b', ['x']], ['a', []]])).order).toEqual(['b', 'a']);
  });

  it('names the fields of a circle, and still lists each field once', () => {
    const { order, cycles } = dependencyOrder(new Map([['a', ['b']], ['b', ['c']], ['c', ['a']], ['d', ['a']]]));
    expect(cycles).toEqual([['a', 'b', 'c', 'a']]);
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(order.indexOf('d')).toBeGreaterThan(order.indexOf('a'));
  });

  it('names a field that reads itself', () => {
    expect(dependencyOrder(new Map([['a', ['a', 'x']]])).cycles).toEqual([['a', 'a']]);
  });
});
